/**
 * CategoryPicker.jsx — Céleste
 * Choix de 1 à 3 catégories max, liste fermée (voir categories.js).
 * Pas de champ libre : une catégorie en texte libre est inexploitable
 * pour l'affinité utilisateur. À insérer dans NewPostModal.
 */
import { CONTENT_CATEGORIES, MAX_CATEGORIES_PER_POST } from "../lib/recommendation/categories";

export default function CategoryPicker({ selected = [], onChange, T }) {
  const muted = T?.muted || "rgba(255,255,255,0.5)";
  const border = T?.border || "rgba(255,255,255,0.12)";
  const text = T?.text || "rgba(255,255,255,0.8)";
  const gold = T?.goldL || T?.gold || "#e0b84a";

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      if (selected.length >= MAX_CATEGORIES_PER_POST) return;
      onChange([...selected, id]);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, color: muted }}>
        De quoi parle ta publication ? ({selected.length}/{MAX_CATEGORIES_PER_POST})
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CONTENT_CATEGORIES.map((c) => {
          const active = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              style={{
                padding: "7px 13px",
                borderRadius: 20,
                border: `1px solid ${active ? "#C9952A88" : border}`,
                background: active ? "rgba(201,149,42,0.15)" : "transparent",
                color: active ? gold : text,
                fontSize: 12.5,
                fontWeight: active ? 700 : 400,
                cursor: "pointer",
                transition: "all .15s ease",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}