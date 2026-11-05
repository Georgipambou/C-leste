import { useState, useEffect, useCallback, useRef } from "react";
import { X, Send, Loader2, AlertTriangle, Gift } from "lucide-react";

function fmt(n) { return (n || 0).toLocaleString("fr-FR"); }

export default function SendMoneyScreen({ sb, T, Btn, session, notify, onClose, pushNav, popNav }) {
  const [step, setStep] = useState("form"); // check | setup | form | confirm
  const [hasPin, setHasPin] = useState(null);
  const [pinA, setPinA] = useState("");
    const [forgotStep, setForgotStep] = useState("none"); // none | password | newpin
  const [password, setPassword] = useState("");
  const [newPinA, setNewPinA] = useState("");
  const [newPinB, setNewPinB] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [pinB, setPinB] = useState("");
  const [pin, setPin] = useState("");
  const [celesteId, setCelesteId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [recipient, setRecipient] = useState(null);
  const [looking, setLooking] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState(null);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const loadHistory = useCallback(() => {
    sb.from("wallet_transfers")
      .select("id,sender_id,recipient_id,amount,message,status,created_at,sender:profiles!wallet_transfers_sender_id_fkey(prenom,nom),recipient:profiles!wallet_transfers_recipient_id_fkey(prenom,nom)")
      .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => { if (mounted.current) setHistory(data || []); });
  }, [sb, session.user.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
    useEffect(() => {
    sb.rpc("has_wallet_pin").then(({ data }) => { setHasPin(!!data); if (!data) setStep("setup"); });
  }, [sb]);
  const verifyPassword = async () => {
    if (!password) return notify("Entre ton mot de passe");
    setVerifying(true);
    try {
      const { error } = await sb.auth.signInWithPassword({ email: session.user.email, password });
      if (error) throw error;
      setForgotStep("newpin"); setPassword("");
    } catch (e) {
      notify("Mot de passe incorrect");
    } finally {
      setVerifying(false);
    }
  };

  const resetPin = async () => {
    if (!/^[0-9]{4,6}$/.test(newPinA)) return notify("4 à 6 chiffres");
    if (newPinA !== newPinB) return notify("Les deux codes ne correspondent pas");
    try {
      const { error } = await sb.rpc("force_reset_wallet_pin", { p_new_pin: newPinA });
      if (error) throw error;
      notify("Code PIN réinitialisé ✦");
      setPin(newPinA); setForgotStep("none"); setNewPinA(""); setNewPinB("");
    } catch (e) { notify(e.message || "Erreur"); }
  };
  const savePin = async () => {
    if (!/^[0-9]{4,6}$/.test(pinA)) return notify("4 à 6 chiffres");
    if (pinA !== pinB) return notify("Les deux codes ne correspondent pas");
    try {
      const { error } = await sb.rpc("set_wallet_pin", { p_new_pin: pinA });
      if (error) throw error;
      notify("Code PIN configuré ✦");
      setHasPin(true); setStep("form"); setPinA(""); setPinB("");
    } catch (e) { notify(e.message || "Erreur"); }
  };

  const search = async () => {
    if (!celesteId.trim()) return notify("Entre un identifiant Céleste");
    if (!amount || !Number.isInteger(Number(amount)) || Number(amount) < 50) return notify("Montant minimum : 50 F CFA (nombre entier)");
    setLooking(true);
    try {
      const { data, error } = await sb.rpc("lookup_celeste_id", { p_celeste_id: celesteId.trim() });
      if (error) throw error;
      setRecipient(data);
      setStep("confirm");
    } catch (e) {
      notify(e.message || "Identifiant introuvable");
    } finally {
      setLooking(false);
    }
  };

  const send = async () => {
    setSending(true);
    try {
      const { data, error } = await sb.rpc("send_money", { p_celeste_id: celesteId.trim(), p_amount: Number(amount), p_pin: pin, p_message: message.trim() || null });
      if (error) throw error;
      if (!data?.success) {
        // PIN refusé : le serveur répond normalement pour pouvoir compter les essais
        const left = Number(data?.attempts_left);
        notify(data?.code === "wrong_pin" && left > 0
          ? `Code PIN incorrect — ${left} essai${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}`
          : (data?.error || "Erreur"));
        setPin("");
        return;
      }
      notify(`${fmt(amount)} F envoyés à ${data.recipient_name} ✦`);
      setStep("form"); setCelesteId(""); setAmount(""); setMessage(""); setRecipient(null); setPin("");
      loadHistory();
    } catch (e) {
      notify(e.message || "Erreur");
    } finally {
      setSending(false);
    }
  };

  const report = async (transferId) => {
    const reason = window.prompt("Qu'est-ce qui s'est passé ? (ex : mauvais identifiant)");
    if (!reason || reason.trim().length < 5) return;
    try {
      const { error } = await sb.rpc("dispute_transfer", { p_transfer_id: transferId, p_reason: reason.trim() });
      if (error) throw error;
      notify("Signalement envoyé ✦");
      loadHistory();
    } catch (e) { notify(e.message || "Erreur"); }
  };

  const input = { width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", color: T.text, fontSize: 15, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg || "#0a0a0a", zIndex: 10100, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 12px", borderBottom: `1px solid ${T.border}` }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Gift size={18} /> Envoyer de l'argent
        </h2>
        <button onClick={() => { popNav(); onClose(); }} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={22} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
                        {step === "setup" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Choisis un code à 4-6 chiffres, demandé avant chaque envoi.</p>
            <input type="password" inputMode="numeric" style={input} value={pinA} onChange={e => setPinA(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Nouveau code" />
            <input type="password" inputMode="numeric" style={input} value={pinB} onChange={e => setPinB(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Confirme le code" />
            <Btn onClick={savePin} style={{ height: 50, borderRadius: 14, background: T.gradGold, color: "#000", fontWeight: 800, fontSize: 14 }}>Valider</Btn>
          </div>
        ) : step === "form" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: T.muted, marginBottom: 6, display: "block" }}>Identifiant Céleste du destinataire</label>
              <input style={input} value={celesteId} onChange={e => setCelesteId(e.target.value)} placeholder="Ex : 4821" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: T.muted, marginBottom: 6, display: "block" }}>Montant (F CFA)</label>
              <input type="number" style={input} value={amount} onChange={e => setAmount(e.target.value)} placeholder="500" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: T.muted, marginBottom: 6, display: "block" }}>Un petit mot (optionnel)</label>
              <input style={input} value={message} onChange={e => setMessage(e.target.value)} placeholder="Joyeux anniversaire ! 🎉" maxLength={100} />
            </div>
            <Btn onClick={search} disabled={looking} style={{ height: 50, borderRadius: 14, background: T.gradGold, color: "#000", fontWeight: 800, fontSize: 14, marginTop: 6 }}>
              {looking ? "…" : "Continuer"}
            </Btn>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            {recipient?.avatar_url ? (
              <img src={recipient.avatar_url} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", margin: "0 auto 14px" }} alt="" />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: T.bg3, margin: "0 auto 14px" }} />
            )}
            <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: T.text }}>{recipient?.name}</p>
            <p style={{ margin: "0 0 24px", fontSize: 12, color: T.muted }}>ID {recipient?.celeste_id}</p>
            <p style={{ margin: "0 0 20px", fontSize: 32, fontWeight: 800, color: T.goldL }}>{fmt(amount)} F</p>

            {forgotStep === "none" && (
              <>
                <input type="password" inputMode="numeric" style={{ ...input, textAlign: "center", letterSpacing: 6, marginBottom: 8 }} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Code PIN" />
                <button onClick={() => setForgotStep("password")} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer", marginBottom: 20, textDecoration: "underline" }}>Code oublié ?</button>
              </>
            )}

            {forgotStep === "password" && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Entre ton mot de passe Céleste pour réinitialiser ton code</p>
                <input type="password" style={{ ...input, marginBottom: 10 }} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" />
                <Btn onClick={verifyPassword} disabled={verifying} style={{ width: "100%", height: 44, borderRadius: 12, background: T.gradGold, color: "#000", fontWeight: 700, fontSize: 13 }}>
                  {verifying ? "…" : "Vérifier"}
                </Btn>
              </div>
            )}

            {forgotStep === "newpin" && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Choisis ton nouveau code</p>
                <input type="password" inputMode="numeric" style={{ ...input, marginBottom: 8 }} value={newPinA} onChange={e => setNewPinA(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Nouveau code" />
                <input type="password" inputMode="numeric" style={{ ...input, marginBottom: 10 }} value={newPinB} onChange={e => setNewPinB(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Confirme le code" />
                <Btn onClick={resetPin} style={{ width: "100%", height: 44, borderRadius: 12, background: T.gradGold, color: "#000", fontWeight: 700, fontSize: 13 }}>Valider</Btn>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={() => setStep("form")} disabled={sending} style={{ flex: 1, height: 50, borderRadius: 14, background: T.bg3, border: `1px solid ${T.border}`, color: T.text, fontWeight: 700 }}>
                Retour
              </Btn>
              <Btn onClick={send} disabled={sending || pin.length < 4} style={{ flex: 1, height: 50, borderRadius: 14, background: T.gradGold, color: "#000", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: sending || pin.length < 4 ? 0.5 : 1 }}>
                {sending ? "…" : <><Send size={15} /> Envoyer</>}
              </Btn>
            </div>
          </div>
        )}

        <div style={{ marginTop: 30 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: T.muted }}>Historique</h3>
          {history === null ? (
            <p style={{ color: T.muted, fontSize: 12 }}>Chargement…</p>
          ) : history.length === 0 ? (
            <p style={{ color: T.muted, fontSize: 12 }}>Aucun envoi pour l'instant.</p>
          ) : (
            history.map(h => {
              const sent = h.sender_id === session.user.id;
              const other = sent ? h.recipient : h.sender;
              return (
                <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>
                      {sent ? "→ " : "← "}{other?.prenom} {other?.nom}
                    </p>
                    {h.message && <p style={{ margin: 0, fontSize: 11, color: T.muted, fontStyle: "italic" }}>"{h.message}"</p>}
                    {h.status !== "completed" && <p style={{ margin: 0, fontSize: 11, color: T.err || "#e5484d" }}>{h.status === "disputed" ? "Signalé" : "Annulé"}</p>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: sent ? T.err || "#e5484d" : "#4ade80" }}>{sent ? "-" : "+"}{fmt(h.amount)} F</p>
                    {sent && h.status === "completed" && (
                      <button onClick={() => report(h.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 10, cursor: "pointer", padding: 0 }}>Signaler</button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}