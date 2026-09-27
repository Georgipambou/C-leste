import { useState, useEffect, useCallback, useRef } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { AlertTriangle, Loader2, ExternalLink } from "lucide-react";

async function openCheckout(url) {
  if (!url) return;
  try {
    if (Capacitor.isNativePlatform()) { await Browser.open({ url, presentationStyle: "popover" }); }
    else { window.open(url, "_blank", "noopener,noreferrer"); }
  } catch { window.open(url, "_blank", "noopener,noreferrer"); }
}

function fmt(n) { return (n || 0).toLocaleString("fr-FR"); }

export default function FinePaymentScreen({ sb, T, Btn, session, notify, onLogout }) {
  const [fines, setFines] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    const { data } = await sb.from("account_fines").select("id,amount,reason,status,created_at").eq("user_id", session.user.id).eq("status", "pending").order("created_at", { ascending: true });
    if (mounted.current) setFines(data || []);
  }, [sb, session.user.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = sb.channel(`fines_live_${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_fine_payments", filter: `user_id=eq.${session.user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "account_fines", filter: `user_id=eq.${session.user.id}` }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, session.user.id, load]);

  const pay = async (fine) => {
    setPayingId(fine.id);
    try {
      const { data, error } = await sb.functions.invoke("create-fine-checkout", { body: { fine_id: fine.id } });
      if (error) {
        let msg = error.message;
        try { const body = await error.context.json(); if (body?.error) msg = body.error; } catch {}
        throw new Error(msg);
      }
      if (!data?.checkout_url) throw new Error(data?.error || "Lien de paiement indisponible");
      await openCheckout(data.checkout_url);
    } catch (e) {
      notify(e.message || "Impossible de démarrer le paiement");
    } finally {
      if (mounted.current) setPayingId(null);
    }
  };

  if (fines === null) {
    return (
      <div style={{ position: "fixed", inset: 0, background: T.bg || "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} color={T.gold} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (fines.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 60, marginBottom: 20 }}>🚫</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 34, fontWeight: 300, color: T.err, marginBottom: 12 }}>Compte suspendu</h2>
          <p style={{ color: T.sub, fontSize: 14, lineHeight: 1.8, marginBottom: 28 }}>Votre compte a été suspendu par un administrateur.<br />Pour toute question, contactez le support de la communauté.</p>
          <Btn onClick={onLogout} style={{ padding: "13px 30px", background: "rgba(200,64,64,0.08)", border: `1px solid ${T.err}44`, borderRadius: 14, color: T.err, fontSize: 14, fontWeight: 600 }}>Se déconnecter</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg || "#0a0a0a", zIndex: 10200, display: "flex", flexDirection: "column", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <AlertTriangle size={40} color="#e5484d" />
        <h2 style={{ margin: "14px 0 6px", fontSize: 20, fontWeight: 800, color: T.text }}>Compte suspendu</h2>
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
          {fines.length > 1 ? `${fines.length} amendes doivent être réglées pour réactiver ton compte.` : "Une amende doit être réglée pour réactiver ton compte."}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {fines.map(f => (
          <div key={f.id} style={{ background: "rgba(229,72,77,0.06)", border: "1px solid rgba(229,72,77,0.3)", borderRadius: 16, padding: 16 }}>
            <p style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: T.text }}>{fmt(f.amount)} F CFA</p>
            {f.reason && <p style={{ margin: "0 0 12px", fontSize: 13, color: T.muted }}>{f.reason}</p>}
            <Btn onClick={() => pay(f)} disabled={payingId === f.id} style={{ width: "100%", height: 46, borderRadius: 12, background: T.gradGold, color: "#000", fontWeight: 800, fontSize: 14 }}>
              {payingId === f.id ? "…" : `Payer ${fmt(f.amount)} F`}
            </Btn>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: T.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <ExternalLink size={12} /> Paiement sécurisé via Chariow. Ton compte se réactive automatiquement une fois réglé.
      </p>

      <button onClick={onLogout} style={{ marginTop: 14, background: "none", border: "none", color: T.muted, fontSize: 12, textAlign: "center", cursor: "pointer" }}>Se déconnecter</button>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}