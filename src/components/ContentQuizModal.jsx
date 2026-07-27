import { useState } from "react";
import { CONTENT_CATEGORIES } from "../lib/recommendation/categories";

const GENDER_OPTIONS = [{ v: "homme", l: "Un homme" }, { v: "femme", l: "Une femme" }];
const MIN_CATS = 3, MAX_CATS = 6;

export default function ContentQuizModal({ sb, userId, T, onDone }) {
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState(null);
  const [cats, setCats] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleCat = (id) => {
    setCats((prev) => prev.includes(id) ? prev.filter((c) => c !== id)
      : prev.length < MAX_CATS ? [...prev, id] : prev);
  };

  const finish = async () => {
    setSaving(true);
    try {
      await sb.from("onboarding_quiz").upsert({ user_id: userId, gender, categories: cats }, { onConflict: "user_id" });
      await sb.from("profiles").update({ quiz_completed: true }).eq("id", userId);
      const affinityRows = cats.map((category) => ({ user_id: userId, category, affinity: 0.65, updated_at: new Date().toISOString() }));
      if (affinityRows.length) await sb.from("user_category_affinity").upsert(affinityRows, { onConflict: "user_id,category" });
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, background: T.bg, display: "flex", flexDirection: "column", padding: 24 }}>
      {step === 0 && (
        <div>
          <h2 style={{ color: T.text }}>Tu es…</h2>
          {GENDER_OPTIONS.map((o) => (
            <button key={o.v} onClick={() => { setGender(o.v); setStep(1); }}
              style={{ display: "block", width: "100%", padding: 14, margin: "8px 0", borderRadius: 12, border: `1px solid ${T.border}`, background: gender === o.v ? T.gold : "transparent", color: T.text }}>
              {o.l}
            </button>
          ))}
        </div>
      )}
      {step === 1 && (
        <div>
          <h2 style={{ color: T.text }}>Qu'est-ce que tu aimes regarder ? (3 à 6 choix)</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CONTENT_CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => toggleCat(c.id)}
                style={{ padding: "8px 14px", borderRadius: 20, border: `1px solid ${T.border}`, background: cats.includes(c.id) ? T.gold : "transparent", color: T.text }}>
                {c.label}
              </button>
            ))}
          </div>
          <button disabled={cats.length < MIN_CATS || saving} onClick={finish}
            style={{ marginTop: 20, width: "100%", padding: 14, borderRadius: 12, border: "none", background: T.gradGold, color: "#000", fontWeight: 700, opacity: cats.length < MIN_CATS ? 0.5 : 1 }}>
            {saving ? "…" : "C'est parti"}
          </button>
        </div>
      )}
    </div>
  );
}