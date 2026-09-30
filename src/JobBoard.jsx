import { useState, useEffect, useCallback } from "react";
import { X, MapPin, Briefcase, Send, Download, Phone, MessageCircle } from "lucide-react";

function fmtF(n) { return n ? Math.round(n).toLocaleString("fr-FR") + " F" : null; }

/* ---------------------------------------------------------------- */
/* Widget chercheur d'emploi — à côté de Céleste Match                */
/* ---------------------------------------------------------------- */
export function JobOffersWidget({ sb, T, Btn, session, notify }) {
  const [offers, setOffers] = useState(null);
  const [applying, setApplying] = useState(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    sb.rpc("get_job_offers_for_me", { p_limit: 20 }).then(({ data }) => setOffers(data || []));
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  if (offers === null || offers.length === 0) return null;

  const apply = async (post_id) => {
    try {
      const { error } = await sb.rpc("apply_to_job", { p_post_id: post_id, p_message: msg.trim() || null });
      if (error) throw error;
      notify("Candidature envoyée ✦");
      setApplying(null); setMsg("");
      load();
    } catch (e) { notify(e.message || "Erreur"); }
  };

  return (
    <div style={{ padding: "16px 16px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>💼</span>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: T.text, fontWeight: 400 }}>Offres d'emploi</span>
        <span style={{ fontSize: 10, color: T.goldL, fontWeight: 700, background: T.goldBg2, padding: "2px 8px", borderRadius: 20, border: `1px solid ${T.gold}33` }}>{offers.length}</span>
      </div>

      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
        {offers.map(o => (
          <div key={o.post_id} style={{ background: "rgba(255,255,255,0.03)", border: `1.5px solid ${T.border}`, borderRadius: 20, overflow: "hidden", flexShrink: 0, width: 260, scrollSnapAlign: "start" }}>
            {o.image_url && <img src={o.image_url} alt="" style={{ width: "100%", height: 110, objectFit: "cover" }} />}
            <div style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.job_title}</p>
                  <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{o.org_name}</p>
                </div>
                <div style={{ width: 42, height: 42, borderRadius: "50%", border: `2px solid ${T.gold}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: `${T.gold}11` }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: T.goldL }}>{o.affinity}%</span>
                </div>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={11} /> {o.remote === "yes" ? "À distance" : o.remote === "hybrid" ? "Hybride" : o.city || o.country || "Sur place"}
                {fmtF(o.salary_min) && <> · {fmtF(o.salary_min)}{o.salary_max ? `–${fmtF(o.salary_max)}` : ""}</>}
              </p>
              {applying === o.post_id ? (
                <div>
                  <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Un petit mot (optionnel)" rows={2}
                    style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: 8, color: T.text, fontSize: 12, outline: "none", resize: "none", marginBottom: 8, boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setApplying(null); setMsg(""); }} style={{ flex: 1, padding: "8px", borderRadius: 10, background: "none", border: `1px solid ${T.border}`, color: T.muted, fontSize: 12, cursor: "pointer" }}>Annuler</button>
                    <button onClick={() => apply(o.post_id)} style={{ flex: 1, padding: "8px", borderRadius: 10, background: T.gradGold, border: "none", color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Envoyer</button>
                  </div>
                </div>
              ) : o.applied ? (
                <div style={{ textAlign: "center", padding: "8px", borderRadius: 10, background: T.bg3, color: T.muted, fontSize: 12, fontWeight: 600 }}>✓ Déjà postulé</div>
              ) : (
                <button onClick={() => setApplying(o.post_id)} style={{ width: "100%", padding: "9px", borderRadius: 10, background: T.gradGold, border: "none", color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Send size={13} /> Postuler
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Widget organisation — remplace Céleste Match                      */
/* ---------------------------------------------------------------- */
export function JobApplicationsWidget({ sb, T, Btn, session, notify, onUser, openChat }) {
  const [apps, setApps] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(() => {
    sb.rpc("get_my_job_applications").then(({ data }) => setApps(data || []));
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  if (apps === null) return null;

  return (
    <div style={{ padding: "16px 16px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>💼</span>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: T.text, fontWeight: 400 }}>Candidatures reçues</span>
        {apps.length > 0 && <span style={{ fontSize: 10, color: T.goldL, fontWeight: 700, background: T.goldBg2, padding: "2px 8px", borderRadius: 20, border: `1px solid ${T.gold}33` }}>{apps.length}</span>}
      </div>

      {apps.length === 0 ? (
        <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`, borderRadius: 22, padding: 20, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 12, color: T.muted }}>Aucune candidature pour l'instant.</p>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
          {apps.map(a => (
            <div key={a.application_id} onClick={() => setDetailId(a.application_id)} style={{ cursor: "pointer", background: a.status === "pending" ? "rgba(201,149,42,0.06)" : "rgba(255,255,255,0.03)", border: `1.5px solid ${a.status === "pending" ? T.gold : T.border}`, borderRadius: 20, flexShrink: 0, width: 220, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                {a.applicant_avatar ? <img src={a.applicant_avatar} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} alt="" />
                  : <div style={{ width: 44, height: 44, borderRadius: "50%", background: T.bg3 }} />}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.applicant_name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.job_title}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.goldL }}>{a.affinity}% d'affinité</span>
                {a.status === "pending" && <span style={{ fontSize: 9, fontWeight: 700, color: "#000", background: T.gold, padding: "2px 7px", borderRadius: 10 }}>NOUVEAU</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {detailId && <ApplicationDetailPanel sb={sb} T={T} Btn={Btn} applicationId={detailId} notify={notify} onUser={onUser} openChat={openChat} onClose={() => { setDetailId(null); load(); }} />}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Détail d'une candidature — quiz, CV protégé, contact               */
/* ---------------------------------------------------------------- */
function ApplicationDetailPanel({ sb, T, Btn, applicationId, notify, onUser, openChat, onClose }) {
  const [data, setData] = useState(null);
  const [cvUrl, setCvUrl] = useState(null);

  useEffect(() => {
    sb.rpc("get_application_detail", { p_application_id: applicationId }).then(({ data, error }) => {
      if (error) { notify(error.message || "Erreur"); onClose(); return; }
      setData(data);
    });
  }, [applicationId]);

  useEffect(() => {
    if (window.enableScreenProtection) window.enableScreenProtection();
    return () => { if (window.disableScreenProtection) window.disableScreenProtection(); };
  }, []);

  const viewCv = async () => {
    if (!data?.profile?.cv_path) { notify("Aucun CV fourni"); return; }
    const { data: signed, error } = await sb.storage.from("cvs").createSignedUrl(data.profile.cv_path, 120);
    if (error) { notify("Impossible d'ouvrir le CV"); return; }
    setCvUrl(signed.signedUrl);
  };

  const contact = async () => {
    const { error } = await sb.rpc("mark_application_contacted", { p_application_id: applicationId });
    if (!error) notify("Le candidat a été prévenu ✦");
  };

  if (!data) return null;
  const p = data.profile, u = data.applicant;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(12px)", zIndex: 10120, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: T.bg2, borderRadius: "28px 28px 0 0", padding: "22px 18px 34px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 19, color: T.text }}>Candidature</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={22} /></button>
        </div>

        <div onClick={() => { onClose(); onUser?.(u.id); }} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 14 }}>
          {u.avatar_url ? <img src={u.avatar_url} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} alt="" /> : <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.bg3 }} />}
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>{u.name}{u.age ? `, ${u.age} ans` : ""}</p>
            <p style={{ margin: 0, fontSize: 12, color: T.goldL, fontWeight: 700 }}>{data.affinity}% d'affinité pour "{data.job_title}"</p>
          </div>
        </div>

        {data.message && (
          <div style={{ background: T.bg3, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: T.sub, fontStyle: "italic" }}>"{data.message}"</div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {(p.categories || []).map(c => <span key={c} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: T.sub }}>{c}</span>)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: T.sub, marginBottom: 18 }}>
          {p.education && <p style={{ margin: 0 }}>🎓 {p.education}</p>}
          {p.experience && <p style={{ margin: 0 }}>💼 {p.experience}</p>}
          {p.city && <p style={{ margin: 0 }}>📍 {p.city}</p>}
          {(p.skills || []).length > 0 && <p style={{ margin: 0 }}>🛠️ {p.skills.join(", ")}</p>}
          {(p.salary_min || p.salary_max) && <p style={{ margin: 0 }}>💰 {fmtF(p.salary_min)}{p.salary_max ? `–${fmtF(p.salary_max)}` : ""}</p>}
        </div>

        {p.cv_path && (
          cvUrl ? (
            <iframe src={cvUrl} title="CV" style={{ width: "100%", height: 340, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 16 }} />
          ) : (
            <button onClick={viewCv} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 12, background: T.bg3, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
              <Download size={15} /> Voir le CV
            </button>
          )
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={() => { contact(); onClose(); openChat?.(u.id); }} style={{ flex: 1, height: 46, borderRadius: 12, background: T.gradGold, color: "#000", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <MessageCircle size={15} /> Contacter sur Céleste
          </Btn>
          {p.contact_pref === "whatsapp" && p.contact_value && (
            <a href={`https://wa.me/${p.contact_value.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={contact}
              style={{ width: 46, height: 46, borderRadius: 12, background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Phone size={18} color="#fff" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}