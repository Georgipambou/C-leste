import { useState, useEffect, useCallback } from "react";
import { ApplicationDetailPanel } from "./JobBoard";
import { X, Send, MapPin, Briefcase, GraduationCap, Clock, Wallet, Car, Tag, Users } from "lucide-react";

const CONTRACTS = { cdi: "CDI", cdd: "CDD", stage: "Stage", temps_partiel: "Temps partiel", mission: "Mission ponctuelle" };
const fmt = (n) => Math.round(n || 0).toLocaleString("fr-FR");

export function JobApplyButton({ T, sb, post, session }) {
  if (!post?.is_job) return null;
  if (post.by === session?.user?.id) return <JobOwnerButton T={T} sb={sb} post={post} />;
  return (
    <div style={{ marginBottom: 8 }} onClick={e => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("celeste_open_job", { detail: post })); }}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20, border: `1px solid ${T.gold}55`, background: T.goldBg, color: T.goldL, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        <Briefcase size={14} />
        {post.job_title ? `Voir l'offre · ${post.job_title}` : "Voir l'offre & postuler"}
      </button>
    </div>
  );
}

export function JobApplyModal({ sb, T, Btn, post, session, notify, onClose }) {
  const [step, setStep] = useState("details");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [affinity, setAffinity] = useState(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    sb.rpc("job_affinity", { p_seeker_id: session.user.id, p_post_id: post.id })
      .then(({ data, error }) => { if (!error && typeof data === "number") setAffinity(data); });
    sb.from("job_applications").select("id").eq("post_id", post.id).eq("applicant_id", session.user.id).maybeSingle()
      .then(({ data }) => setApplied(!!data));
  }, [sb, post.id, session.user.id]);

  const send = async () => {
    setLoading(true);
    try {
      const { error } = await sb.rpc("apply_to_job", { p_post_id: post.id, p_message: msg.trim() || null });
      if (error) throw error;
      notify("Candidature envoyée ✦");
      onClose();
    } catch (e) {
      notify(e.message || "Impossible d'envoyer la candidature");
    } finally {
      setLoading(false);
    }
  };

  const remoteLabel = post.job_remote === "yes" ? "À distance" : post.job_remote === "hybrid" ? "Hybride" : "Sur place";
  const place = post.job_remote === "yes" ? remoteLabel : `${remoteLabel}${post.job_city ? " · " + post.job_city : ""}`;
  const salary = post.job_salary_min ? `${fmt(post.job_salary_min)}${post.job_salary_max ? " – " + fmt(post.job_salary_max) : ""} F CFA` : null;
  const age = post.job_age_min || post.job_age_max ? `${post.job_age_min ? post.job_age_min + " ans min" : ""}${post.job_age_min && post.job_age_max ? " · " : ""}${post.job_age_max ? post.job_age_max + " ans max" : ""}` : null;
  const photo = post.img || post.media_urls?.[0];
  const employer = post.author?.org_name || post.author?.fullName || "";

  const rows = [
    [Tag, "Catégorie", post.job_category],
    [Briefcase, "Contrat", CONTRACTS[post.job_contract_type]],
    [MapPin, "Lieu", place],
    [Car, "Déplacement", post.job_remote !== "yes" ? (post.job_travel_covered === "employer" ? "Pris en charge" : "À la charge du candidat") : null],
    [Wallet, "Salaire", salary],
    [GraduationCap, "Études minimum", post.job_education_min],
    [Clock, "Expérience minimum", post.job_experience_min],
    [Clock, "Âge", age],
  ].filter(r => r[2]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 10100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: T.bg2, borderRadius: "28px 28px 0 0", padding: "24px 20px 40px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: T.text }}>
            {step === "details" ? "Offre d'emploi" : "Ta candidature"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={22} /></button>
        </div>

        {step === "details" ? (
          <>
            {photo && <img src={photo} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 16, marginBottom: 14 }} />}

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.text }}>{post.job_title || "Poste"}</p>
                {employer && <p style={{ margin: "2px 0 0", fontSize: 12, color: T.muted }}>{employer}</p>}
              </div>
              {affinity !== null && (
                <div style={{ width: 46, height: 46, borderRadius: "50%", border: `2px solid ${T.gold}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: `${T.gold}11` }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: T.goldL }}>{affinity}%</span>
                </div>
              )}
            </div>

            {post.text && <p style={{ margin: "10px 0 14px", fontSize: 13, color: T.sub, lineHeight: 1.5 }}>{post.text}</p>}

            <div style={{ background: T.bg3, borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map(([Icon, label, value]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <Icon size={14} color={T.muted} style={{ flexShrink: 0 }} />
                  <span style={{ color: T.muted, minWidth: 120 }}>{label}</span>
                  <span style={{ color: T.text, fontWeight: 600 }}>{value}</span>
                </div>
              ))}
              {post.job_skills?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
                  {post.job_skills.map(s => <span key={s} style={{ padding: "4px 10px", borderRadius: 14, fontSize: 11, fontWeight: 600, background: T.goldBg, color: T.goldL, border: `1px solid ${T.gold}33` }}>{s}</span>)}
                </div>
              )}
            </div>

            {post.job_remote === "no" && post.job_country && (
              <p style={{ margin: "0 0 14px", fontSize: 11, color: T.muted }}>Poste sur place : réservé aux candidats du même pays que l'offre.</p>
            )}
            {post.expires_at && (
              <p style={{ margin: "0 0 14px", fontSize: 11, color: T.muted }}>
                Expire le {new Date(post.expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
              </p>
            )}

            {applied ? (
              <div style={{ textAlign: "center", padding: 14, borderRadius: 14, background: T.bg3, color: T.muted, fontSize: 13, fontWeight: 700 }}>✓ Tu as déjà postulé</div>
            ) : (
              <Btn onClick={() => setStep("confirm")} style={{ width: "100%", height: 50, borderRadius: 14, background: T.gradGold, color: "#000", fontWeight: 800, fontSize: 14 }}>
                Continuer
              </Btn>
            )}
            <button
              onClick={() => { window.dispatchEvent(new CustomEvent("celeste_open_chat_with", { detail: post.by || post.author?.id })); onClose(); }}
              style={{ width: "100%", marginTop: 10, height: 44, borderRadius: 14, background: "none", border: `1px solid ${T.border}`, color: T.sub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Discuter d'abord avec l'employeur
            </button>
          </>
        ) : (
          <>
            <div style={{ background: T.bg3, border: `1px solid ${T.gold}44`, borderRadius: 14, padding: 16, marginBottom: 14, textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, color: T.muted }}>Tu postules à</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.goldL }}>{post.job_title || "ce poste"}</p>
              {affinity !== null && <p style={{ margin: "6px 0 0", fontSize: 12, color: T.muted }}>Affinité avec ton profil : {affinity}%</p>}
            </div>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Un petit mot pour l'employeur (optionnel)" rows={3} maxLength={500}
              style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, color: T.text, fontSize: 13, outline: "none", resize: "none", marginBottom: 14, boxSizing: "border-box" }} />
            <p style={{ margin: "0 0 14px", fontSize: 11, color: T.muted }}>L'employeur verra ton profil emploi et ton CV pour cette candidature uniquement.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={() => setStep("details")} disabled={loading} style={{ flex: 1, height: 50, borderRadius: 14, background: T.bg3, border: `1px solid ${T.border}`, color: T.text, fontWeight: 700 }}>Retour</Btn>
              <Btn onClick={send} disabled={loading} style={{ flex: 1, height: 50, borderRadius: 14, background: T.gradGold, color: "#000", fontWeight: 800 }}>
                {loading ? "..." : <><Send size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />Envoyer</>}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
export function JobOwnerButton({ T, sb, post }) {
  const [total, setTotal] = useState(null);
  const [fresh, setFresh] = useState(0);

  useEffect(() => {
    sb.rpc("get_my_job_applications").then(({ data }) => {
      const mine = (data || []).filter(a => a.post_id === post.id);
      setTotal(mine.length);
      setFresh(mine.filter(a => a.status === "pending").length);
    });
  }, [sb, post.id]);

  return (
    <div style={{ marginBottom: 8 }} onClick={e => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("celeste_open_job_candidates", { detail: post })); }}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 20, border: `1px solid ${T.gold}55`, background: T.goldBg, color: T.goldL, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        <Users size={14} />
        Candidatures{total !== null ? ` (${total})` : ""}
        {fresh > 0 && (
          <span style={{ fontSize: 9, fontWeight: 800, color: "#000", background: T.gold, padding: "2px 7px", borderRadius: 10 }}>
            {fresh} nouveau{fresh > 1 ? "x" : ""}
          </span>
        )}
      </button>
    </div>
  );
}

export function JobCandidatesModal({ sb, T, Btn, post, notify, onUser, openChat, onClose }) {
  const [apps, setApps] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(() => {
    sb.rpc("get_my_job_applications").then(({ data }) => {
      setApps((data || []).filter(a => a.post_id === post.id));
    });
  }, [sb, post.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 10100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: T.bg2, borderRadius: "28px 28px 0 0", padding: "24px 20px 40px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: T.text }}>Candidatures</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={22} /></button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.muted }}>{post.job_title || "Offre d'emploi"}</p>

        {apps === null ? (
          <p style={{ textAlign: "center", fontSize: 12, color: T.muted }}>Chargement…</p>
        ) : apps.length === 0 ? (
          <div style={{ background: T.bg3, borderRadius: 16, padding: 20, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 13, color: T.muted }}>Aucune candidature pour l'instant.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {apps.map(a => (
              <div key={a.application_id} onClick={() => setDetailId(a.application_id)}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, background: a.status === "pending" ? "rgba(201,149,42,0.06)" : T.bg3, border: `1.5px solid ${a.status === "pending" ? T.gold : T.border}` }}>
                {a.applicant_avatar
                  ? <img src={a.applicant_avatar} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 44, height: 44, borderRadius: "50%", background: T.bg2, flexShrink: 0 }} />}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.applicant_name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: T.goldL, fontWeight: 700 }}>{a.affinity}% d'affinité</p>
                  {a.message && <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted, fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>"{a.message}"</p>}
                </div>
                {a.status === "pending" && <span style={{ fontSize: 9, fontWeight: 700, color: "#000", background: T.gold, padding: "2px 7px", borderRadius: 10, flexShrink: 0 }}>NOUVEAU</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {detailId && (
        <ApplicationDetailPanel sb={sb} T={T} Btn={Btn} applicationId={detailId} notify={notify} onUser={onUser} openChat={openChat}
          onClose={() => { setDetailId(null); load(); }} />
      )}
    </div>
  );
}