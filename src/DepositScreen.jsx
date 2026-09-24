/**
 * DepositScreen — Écran de dépôt Céleste (solde achat, via Chariow)
 *
 * Fichier autonome, sur le modèle de Duo.jsx / Groups.jsx / ProfileDashboard.jsx :
 * il ne crée AUCUN client Supabase et ne définit AUCUN thème — il reçoit tout
 * en props (sb, T, Btn, session, notify) exactement comme WalletScreen le fait
 * déjà dans App.jsx.
 *
 * Flux :
 *  1) Charge les paliers depuis `deposit_tiers` (base_amount, ordonnés)
 *  2) Au clic sur un palier -> appelle l'Edge Function `create-deposit-checkout`
 *     (elle crée le checkout Chariow et enregistre la ligne dans `pending_deposits`)
 *  3) Ouvre `checkout_url` dans le navigateur (Capacitor Browser sur mobile,
 *     nouvel onglet sur web)
 *  4) Écoute `pending_deposits` en temps réel (Supabase Realtime) pour afficher
 *     "en attente" / "crédité" sans que l'utilisateur ait à rafraîchir — et un
 *     bouton "Vérifier" en secours si jamais le retour de paiement traîne
 *     (le job `reconcile-deposits` finit de toute façon le travail toutes les 15 min)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { X, Loader2, CheckCircle2, Clock, ExternalLink, RefreshCw } from "lucide-react";

async function openCheckout(url) {
  if (!url) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url, presentationStyle: "popover" });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function fmt(n) {
  return (n || 0).toLocaleString("fr-FR");
}

export default function DepositScreen({ sb, T, Btn, session, notify, onClose, pushNav, popNav }) {
  const [tiers, setTiers] = useState(null);
  const [pending, setPending] = useState([]);
  const [loadingTier, setLoadingTier] = useState(null);
  const [checking, setChecking] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadTiers = useCallback(async () => {
    const { data, error } = await sb.from("deposit_tiers").select("base_amount").order("base_amount", { ascending: true });
    if (!error && mounted.current) setTiers((data || []).map(r => r.base_amount));
  }, [sb]);

  const loadPending = useCallback(async () => {
    const { data } = await sb
      .from("pending_deposits")
      .select("id,base_amount,status,created_at,completed_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (mounted.current) setPending(data || []);
  }, [sb, session.user.id]);

  useEffect(() => { loadTiers(); loadPending(); }, [loadTiers, loadPending]);

  useEffect(() => {
    const ch = sb.channel(`pending_deposits_live_${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_deposits", filter: `user_id=eq.${session.user.id}` }, () => loadPending())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, session.user.id, loadPending]);

  const startDeposit = async (base_amount) => {
    if (loadingTier) return;
    setLoadingTier(base_amount);
    try {
      const { data, error } = await sb.functions.invoke("create-deposit-checkout", { body: { base_amount } });
if (error) {
  let msg = error.message;
  try { const body = await error.context.json(); if (body?.error) msg = body.error; } catch {}
  throw new Error(msg);
}
      if (!data?.checkout_url) throw new Error(data?.error || "Lien de paiement indisponible");
      await openCheckout(data.checkout_url);
      loadPending();
    } catch (e) {
      notify(e.message || "Impossible de démarrer le dépôt");
    } finally {
      if (mounted.current) setLoadingTier(null);
    }
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      await sb.functions.invoke("reconcile-deposits", { body: {} });
    } catch { /* le cron passera de toute façon */ }
    await loadPending();
    if (mounted.current) setChecking(false);
  };

  const surchargePct = 20; // reflète app_settings.deposit_surcharge_percent (affichage informatif)

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg || "#0a0a0a", zIndex: 10050, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 12px", borderBottom: `1px solid ${T.border}` }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>Déposer de l'argent</h2>
        <Btn onClick={() => { popNav?.(); onClose(); }} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}>
          <X size={22} />
        </Btn>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <p style={{ color: T.sub || T.muted, fontSize: 13, lineHeight: 1.5, margin: "0 0 18px" }}>
          Choisis un montant. Il sera ajouté à ton <strong style={{ color: T.goldL }}>solde achat</strong> (utilisable
          pour acheter ou réserver sur Céleste, non retirable). Une majoration de {surchargePct}% couvre les frais
          de paiement tu payes le montant affiché + {surchargePct}%, et c'est le montant affiché qui est crédité.
        </p>

        {tiers === null ? (
  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
    <Loader2 size={24} color={T.gold} style={{ animation: "spin 1s linear infinite" }} />
  </div>
) : (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
    {tiers.map(amount => {
      const isLoading = loadingTier === amount;
      return (
        <button
          key={amount}
          className="dep-tier"
          disabled={!!loadingTier}
          onClick={() => startDeposit(amount)}
          style={{
            height: 84,
            borderRadius: 18,
            border: `1px solid rgba(224,184,74,0.35)`,
            background: "linear-gradient(160deg, rgba(224,184,74,0.16) 0%, rgba(224,184,74,0.04) 60%, rgba(0,0,0,0.15) 100%)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            cursor: loadingTier ? "default" : "pointer",
            opacity: loadingTier && !isLoading ? 0.45 : 1,
          }}
        >
          {isLoading ? (
            <Loader2 size={20} color={T.goldL} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <>
              <span style={{ fontSize: 19, fontWeight: 800, color: T.goldL, letterSpacing: -0.3 }}>
                {fmt(amount)} F
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: T.text,
                background: "rgba(0,0,0,0.3)", borderRadius: 999,
                padding: "3px 10px",
              }}>
                {fmt(Math.ceil(amount * (1 + surchargePct / 100)))} F à payer
              </span>
            </>
          )}
        </button>
      );
    })}
  </div>
)}

        <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.text }}>Dépôts récents</h3>
          <Btn onClick={checkNow} disabled={checking} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.goldL, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <RefreshCw size={14} style={checking ? { animation: "spin 1s linear infinite" } : undefined} />
            Vérifier
          </Btn>
        </div>

        {pending.length === 0 ? (
          <p style={{ color: T.muted, fontSize: 13, marginTop: 10 }}>Aucun dépôt pour l'instant.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {pending.map(dep => {
              const done = dep.status === "completed";
              const failed = dep.status === "failed";
              return (
                <div key={dep.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: 12,
                  background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {done ? <CheckCircle2 size={18} color="#4ade80" /> : failed ? <X size={18} color={T.err} /> : <Clock size={18} color={T.muted} />}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{fmt(dep.base_amount)} F</div>
                      <div style={{ fontSize: 11, color: T.muted }}>
                        {new Date(dep.created_at).toLocaleString("fr-FR")}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: done ? "#4ade80" : failed ? T.err : T.muted }}>
                    {done ? "Crédité" : failed ? "Échoué" : "En attente"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ color: T.muted, fontSize: 11, marginTop: 22, display: "flex", alignItems: "center", gap: 6 }}>
          <ExternalLink size={13} /> Le paiement s'ouvre sur le site sécurisé de Chariow, puis te ramène ici.
        </p>
      </div>

      <style>{`
  @keyframes spin{to{transform:rotate(360deg)}}
  .dep-tier{ -webkit-tap-highlight-color: transparent; }
  .dep-tier:active:not(:disabled){ transform: scale(0.97); }
`}</style>
    </div>
  );
}