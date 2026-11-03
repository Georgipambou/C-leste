import { useState, useEffect } from "react";

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON;
const H = { "Content-Type": "application/json", apikey: SB_ANON, Authorization: "Bearer " + SB_ANON };
const IDEAS = ["Dis-moi un secret 🤫", "Ce que tu n'as jamais osé me dire…", "Une qualité que tu vois en moi ✨"];

function deviceId() {
  try {
    let d = localStorage.getItem("celeste_anon_did");
    if (!d) {
      d = crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
      localStorage.setItem("celeste_anon_did", d);
    }
    return d;
  } catch (e) { return "tmp-" + Math.random().toString(36).slice(2); }
}

export default function AnonPublicPage() {
  const slug = window.location.pathname.split("/")[2] || "";
  const [state, setState] = useState("loading");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    document.title = "Message anonyme · Céleste";
    const m = document.createElement("meta");
    m.name = "robots"; m.content = "noindex";
    document.head.appendChild(m);
    fetch(SB_URL + "/rest/v1/rpc/anon_get_link_public", { method: "POST", headers: H, body: JSON.stringify({ p_slug: slug }) })
      .then(r => r.json())
      .then(d => { if (d && d.ok) { setName(d.name || ""); setState("ready"); } else setState("invalid"); })
      .catch(() => setState("invalid"));
    return () => m.remove();
  }, [slug]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true); setErr("");
    try {
      const r = await fetch(SB_URL + "/functions/v1/anon-send", { method: "POST", headers: H, body: JSON.stringify({ slug, content, did: deviceId() }) });
      const d = await r.json().catch(() => ({}));
      if (d && d.ok) { setText(""); setState("sent"); }
      else if (d && d.error === "rate_limited") setErr("Tu as envoyé beaucoup de messages. Réessaie plus tard.");
      else if (d && d.error === "link_inactive") setState("invalid");
      else setErr("Impossible d'envoyer. Réessaie.");
    } catch (e) { setErr("Pas de connexion. Réessaie."); }
    setSending(false);
  };

  const gold = "linear-gradient(135deg,#D4AF37,#F5D76E)";
  const wrap = { minHeight: "100vh", background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", boxSizing: "border-box" };
  const card = { width: "100%", maxWidth: 420, textAlign: "center" };
  const cta = { display: "block", width: "100%", padding: "14px 18px", borderRadius: 16, border: "none", background: gold, color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", textDecoration: "none", boxSizing: "border-box" };

  if (state === "loading") return <div style={wrap}><p style={{ opacity: .5 }}>…</p></div>;

  if (state === "invalid") return (
    <div style={wrap}><div style={card}>
      <p style={{ fontSize: 40, margin: 0 }}>🔒</p>
      <h2 style={{ margin: "10px 0 6px" }}>Ce lien n'est plus actif</h2>
      <p style={{ opacity: .6, fontSize: 14, marginBottom: 22 }}>La personne l'a désactivé ou en a créé un nouveau.</p>
      <a href="/" style={cta}>Découvrir Céleste ✦</a>
    </div></div>
  );

  if (state === "sent") return (
    <div style={wrap}><div style={card}>
      <p style={{ fontSize: 44, margin: 0 }}>✨</p>
      <h2 style={{ margin: "10px 0 6px" }}>Message envoyé !</h2>
      <p style={{ opacity: .6, fontSize: 14, marginBottom: 22 }}>{name ? name + " le recevra" : "Il sera reçu"} sans savoir que c'est toi.</p>
      <a href="/" style={{ ...cta, marginBottom: 10 }}>Reçois toi aussi des messages anonymes 🎭</a>
      <button onClick={() => setState("ready")} style={{ background: "none", border: "none", color: "#fff", opacity: .6, fontSize: 13, cursor: "pointer" }}>Envoyer un autre message</button>
    </div></div>
  );

  return (
    <div style={wrap}><div style={card}>
      <p style={{ fontSize: 40, margin: 0 }}>🎭</p>
      <h2 style={{ margin: "10px 0 4px", fontSize: 22 }}>Envoie un message anonyme{name ? " à " + name : ""}</h2>
      <p style={{ opacity: .55, fontSize: 13, margin: "0 0 16px" }}>100 % anonyme · pas besoin de compte</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
        {IDEAS.map(i => (
          <button key={i} onClick={() => setText(i + " ")} style={{ padding: "6px 12px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer" }}>{i}</button>
        ))}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value.slice(0, 500))} rows={5} placeholder="Écris ton message…"
        style={{ width: "100%", boxSizing: "border-box", padding: 14, borderRadius: 16, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 15, resize: "none", outline: "none", fontFamily: "inherit" }} />
      <div style={{ textAlign: "right", fontSize: 11, opacity: .45, margin: "4px 4px 12px" }}>{text.length}/500</div>
      {err && <p style={{ color: "#ff7a7a", fontSize: 13, margin: "0 0 10px" }}>{err}</p>}
      <button onClick={send} disabled={sending || !text.trim()} style={{ ...cta, opacity: sending || !text.trim() ? .5 : 1 }}>
        {sending ? "Envoi…" : "Envoyer 🤫"}
      </button>
      <p style={{ opacity: .4, fontSize: 11, marginTop: 16 }}>Les messages blessants sont signalés et leur expéditeur est bloqué.</p>
    </div></div>
  );
}