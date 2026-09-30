export const JOB_CATEGORIES = ["Vente/Commerce","Service client","Informatique/Tech","Design/Créatif","Marketing/Communication","Éducation/Formation","Restauration/Hôtellerie","Transport/Livraison","Bâtiment/Artisanat","Santé","Administration/Bureau","Autre"];
export const JOB_EDUCATION = ["Aucun","Primaire","Secondaire","Formation professionnelle","Bac","Licence","Master ou plus"];
export const JOB_EXPERIENCE = ["Débutant","Moins d'1 an","1-3 ans","3-5 ans","5 ans et plus"];
export const JOB_CONTRACTS = [["cdi","CDI"],["cdd","CDD"],["stage","Stage"],["temps_partiel","Temps partiel"],["mission","Mission ponctuelle"],["peu_importe","Peu importe"]];
export const JOB_DEFAULTS = { title: "", category: "", contract: "", educationMin: "", experienceMin: "", ageMin: "", ageMax: "", city: "", remote: "no", travel: "candidate", salaryMin: "", salaryMax: "", skills: "" };

function Chip({ T, active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "7px 12px", borderRadius: 18, fontSize: 11, fontWeight: 600, cursor: "pointer",
      border: `1px solid ${active ? T.gold : T.border}`,
      background: active ? T.goldBg : "transparent",
      color: active ? T.goldL : T.sub,
    }}>{children}</button>
  );
}

export function JobFields({ T, job, setJob }) {
  const set = (k, v) => setJob(j => ({ ...j, [k]: v }));
  const toggle = (k, v) => setJob(j => ({ ...j, [k]: j[k] === v ? "" : v }));
  const label = { fontSize: 11, color: T.muted, fontWeight: 600, margin: "4px 0 6px", display: "block" };
  const input = { width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 13px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
      <input style={input} value={job.title} onChange={e => set("title", e.target.value)} placeholder="Intitulé du poste" maxLength={80} />

      <div>
        <span style={label}>Catégorie</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {JOB_CATEGORIES.map(c => <Chip key={c} T={T} active={job.category === c} onClick={() => toggle("category", c)}>{c}</Chip>)}
        </div>
      </div>

      <div>
        <span style={label}>Contrat</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {JOB_CONTRACTS.filter(([v]) => v !== "peu_importe").map(([v, l]) => <Chip key={v} T={T} active={job.contract === v} onClick={() => toggle("contract", v)}>{l}</Chip>)}
        </div>
      </div>

      <div>
        <span style={label}>Niveau d'études minimum (facultatif)</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {JOB_EDUCATION.map(e => <Chip key={e} T={T} active={job.educationMin === e} onClick={() => toggle("educationMin", e)}>{e}</Chip>)}
        </div>
      </div>

      <div>
        <span style={label}>Expérience minimum (facultatif)</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {JOB_EXPERIENCE.map(e => <Chip key={e} T={T} active={job.experienceMin === e} onClick={() => toggle("experienceMin", e)}>{e}</Chip>)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input type="number" min="16" style={input} value={job.ageMin} onChange={e => set("ageMin", e.target.value)} placeholder="Âge min (option)" />
        <input type="number" min="16" style={input} value={job.ageMax} onChange={e => set("ageMax", e.target.value)} placeholder="Âge max (option)" />
      </div>

      <input style={input} value={job.city} onChange={e => set("city", e.target.value)} placeholder="Ville du poste" />

      <div>
        <span style={label}>Lieu de travail</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[["no", "Sur place"], ["hybrid", "Hybride"], ["yes", "À distance"]].map(([v, l]) => <Chip key={v} T={T} active={job.remote === v} onClick={() => set("remote", v)}>{l}</Chip>)}
        </div>
        {job.remote === "no" && <p style={{ margin: "6px 0 0", fontSize: 11, color: T.muted }}>Sur place : l'offre ne sera visible que par les candidats de ton pays.</p>}
      </div>

      {job.remote !== "yes" && (
        <div>
          <span style={label}>Déplacement</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["candidate", "À la charge du candidat"], ["employer", "Pris en charge"]].map(([v, l]) => <Chip key={v} T={T} active={job.travel === v} onClick={() => set("travel", v)}>{l}</Chip>)}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input type="number" style={input} value={job.salaryMin} onChange={e => set("salaryMin", e.target.value)} placeholder="Salaire min (F)" />
        <input type="number" style={input} value={job.salaryMax} onChange={e => set("salaryMax", e.target.value)} placeholder="Salaire max (F)" />
      </div>

      <input style={input} value={job.skills} onChange={e => set("skills", e.target.value)} placeholder="Compétences recherchées (séparées par des virgules)" />
    </div>
  );
}