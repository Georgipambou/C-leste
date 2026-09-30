import { useState, useEffect, useRef } from "react";
import { X, Briefcase, Upload, Loader2 } from "lucide-react";

import { JOB_CATEGORIES as CATEGORIES, JOB_EDUCATION as EDUCATION, JOB_EXPERIENCE as EXPERIENCE, JOB_CONTRACTS as CONTRACTS } from "./JobFields";
const AVAILABILITY = ["Immédiate","Dans 1 mois","Dans 3 mois","Je regarde juste"];

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} type="button" style={{
      padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
      border: active ? "1px solid #e0b84a" : "1px solid rgba(255,255,255,0.15)",
      background: active ? "rgba(224,184,74,0.15)" : "transparent",
      color: active ? "#e0b84a" : "inherit",
    }}>{children}</button>
  );
}

export default function JobSeekerQuizScreen({ sb, T, Btn, session, notify, onClose, pushNav, popNav }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [education, setEducation] = useState("");
  const [experience, setExperience] = useState("");
  const [contract, setContract] = useState("");
  const [availability, setAvailability] = useState("");
  const [city, setCity] = useState("");
  const [remoteOk, setRemoteOk] = useState("any");
  const [skillsText, setSkillsText] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [cvUrl, setCvUrl] = useState(null);
  const [contactPref, setContactPref] = useState("celeste");
  const [contactValue, setContactValue] = useState("");
  const [active, setActive] = useState(true);
  const [uploadingCv, setUploadingCv] = useState(false);
  const initialCvRef = useRef(null);
  const CV_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"];

  const pickCv = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!CV_TYPES.includes(file.type)) { notify("Format accepté : PDF, Word, JPG ou PNG"); return; }
    if (file.size > 5 * 1024 * 1024) { notify("Fichier trop lourd (5 Mo maximum)"); return; }
    setUploadingCv(true);
    try {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${session.user.id}/cv-${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("cvs").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setCvUrl(path);
    } catch (err) {
      notify(err.message || "Échec de l'envoi du CV");
    } finally {
      setUploadingCv(false);
    }
  };
  useEffect(() => {
    sb.from("job_seeker_profiles").select("*").eq("user_id", session.user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setCategories(data.categories || []);
        setEducation(data.education_level || "");
        setExperience(data.experience_level || "");
        setContract(data.contract_type || "");
        setAvailability(data.availability || "");
        setCity(data.city || "");
        setRemoteOk(data.remote_ok || "any");
        setSkillsText((data.skills || []).join(", "));
        setSalaryMin(data.salary_min || "");
        setSalaryMax(data.salary_max || "");
        setCvUrl(data.cv_url || null);
        initialCvRef.current = data.cv_url || null;
        setContactPref(data.contact_pref || "celeste");
        setContactValue(data.contact_value || "");
        setActive(data.active !== false);
      }
      setLoading(false);
    });
  }, [sb, session.user.id]);

  const toggleCategory = (c) => setCategories(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);

  const save = async () => {
    setSaving(true);
    try {
      const skills = skillsText.split(",").map(s => s.trim()).filter(Boolean);
      const { error } = await sb.rpc("upsert_job_seeker_profile", {
        p_categories: categories, p_education_level: education || null, p_experience_level: experience || null,
        p_contract_type: contract || null, p_availability: availability || null, p_city: city || null,
        p_remote_ok: remoteOk, p_skills: skills,
        p_salary_min: salaryMin ? Number(salaryMin) : null, p_salary_max: salaryMax ? Number(salaryMax) : null,
        p_cv_url: cvUrl, p_contact_pref: contactPref, p_contact_value: contactValue || null, p_active: active,
      });
      if (error) throw error;
      if (initialCvRef.current && initialCvRef.current !== cvUrl) sb.storage.from("cvs").remove([initialCvRef.current]);
      notify("Profil emploi enregistré ✦");
      popNav(); onClose();
    } catch (e) {
      notify(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: T.bg || "#0a0a0a", zIndex: 10100, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} color={T.gold} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const label = { fontSize: 12, color: T.muted, marginBottom: 8, display: "block", fontWeight: 600 };
  const input = { width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg || "#0a0a0a", zIndex: 10100, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 12px", borderBottom: `1px solid ${T.border}` }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Briefcase size={18} /> Chercher du travail
        </h2>
        <button onClick={() => { popNav(); onClose(); }} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={22} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 22 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, color: T.text, cursor: "pointer" }}>
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          Je recherche activement un emploi
        </label>

        <div>
          <span style={label}>Type(s) de poste recherché(s)</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map(c => <Chip key={c} active={categories.includes(c)} onClick={() => toggleCategory(c)}>{c}</Chip>)}
          </div>
        </div>

        <div>
          <span style={label}>Niveau d'études</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EDUCATION.map(e => <Chip key={e} active={education === e} onClick={() => setEducation(e)}>{e}</Chip>)}
          </div>
        </div>

        <div>
          <span style={label}>Expérience</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EXPERIENCE.map(e => <Chip key={e} active={experience === e} onClick={() => setExperience(e)}>{e}</Chip>)}
          </div>
        </div>

        <div>
          <span style={label}>Type de contrat recherché</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CONTRACTS.map(([v, l]) => <Chip key={v} active={contract === v} onClick={() => setContract(v)}>{l}</Chip>)}
          </div>
        </div>

        <div>
          <span style={label}>Disponibilité</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {AVAILABILITY.map(a => <Chip key={a} active={availability === a} onClick={() => setAvailability(a)}>{a}</Chip>)}
          </div>
        </div>

        <div>
          <span style={label}>Ville</span>
          <input style={input} value={city} onChange={e => setCity(e.target.value)} placeholder="Ta ville" />
        </div>

        <div>
          <span style={label}>Télétravail</span>
          <div style={{ display: "flex", gap: 8 }}>
            {[["yes","Oui"],["no","Non"],["any","Peu importe"]].map(([v,l]) => <Chip key={v} active={remoteOk === v} onClick={() => setRemoteOk(v)}>{l}</Chip>)}
          </div>
        </div>

        <div>
          <span style={label}>Compétences (séparées par des virgules)</span>
          <input style={input} value={skillsText} onChange={e => setSkillsText(e.target.value)} placeholder="Excel, Vente, Anglais..." />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <span style={label}>Salaire min. (F CFA, optionnel)</span>
            <input type="number" style={input} value={salaryMin} onChange={e => setSalaryMin(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={label}>Salaire max. (optionnel)</span>
            <input type="number" style={input} value={salaryMax} onChange={e => setSalaryMax(e.target.value)} />
          </div>
        </div>

        <div>
          <span style={label}>CV</span>
          {cvUrl ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.bg3, borderRadius: 12, padding: "12px 14px" }}>
              <span style={{ fontSize: 13, color: T.text }}>✓ CV déjà téléversé</span>
              <button onClick={() => setCvUrl(null)} style={{ background: "none", border: "none", color: T.err || "#e5484d", fontSize: 12, cursor: "pointer" }}>Retirer</button>
            </div>
          ) : (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg3, border: `1px dashed ${T.border}`, borderRadius: 12, padding: "14px", color: T.text, fontSize: 13, cursor: uploadingCv ? "default" : "pointer" }}>
                {uploadingCv ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={16} />}
                {uploadingCv ? "Envoi en cours…" : "Ajouter mon CV (PDF, Word, JPG, PNG — 5 Mo max)"}
                <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={pickCv} disabled={uploadingCv} style={{ display: "none" }} />
              </label>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: T.muted }}>Ton CV reste privé : seules les entreprises auxquelles tu postules pourront le voir.</p>
            </>
          )}
        </div>

        <div>
          <span style={label}>Comment te contacter ?</span>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {[["celeste","Céleste"],["whatsapp","WhatsApp"],["phone","Téléphone"]].map(([v,l]) => <Chip key={v} active={contactPref === v} onClick={() => setContactPref(v)}>{l}</Chip>)}
          </div>
          {contactPref !== "celeste" && (
            <input style={input} value={contactValue} onChange={e => setContactValue(e.target.value)} placeholder={contactPref === "whatsapp" ? "Numéro WhatsApp" : "Numéro de téléphone"} />
          )}
        </div>
      </div>

      <div style={{ padding: 18, borderTop: `1px solid ${T.border}` }}>
        <Btn onClick={save} disabled={saving} style={{ width: "100%", height: 50, borderRadius: 14, background: T.gradGold, color: "#000", fontWeight: 800, fontSize: 14 }}>
          {saving ? "…" : "Enregistrer"}
        </Btn>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}