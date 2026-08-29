// src/components/DraftsGallery.jsx
import { useState, useEffect } from "react";
import { X, Play, Trash2, Send } from "lucide-react";
import { getAllDrafts, deleteDraft } from "../lib/draftsStore";

// onResume(draft) -> rouvre CameraStudioModal avec ce brouillon chargé (reprendre l'édition)
// onPublishAsIs(draft) -> publie directement le blob du brouillon sans repasser par l'éditeur
export default function DraftsGallery({ onClose, onResume, onPublishAsIs, T }) {
  const [drafts, setDrafts] = useState(null);

  useEffect(() => { getAllDrafts().then(setDrafts); }, []);

  const remove = async (id) => {
    await deleteDraft(id);
    setDrafts((d) => d.filter((x) => x.id !== id));
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: T.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "52px 20px 16px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: T.text, letterSpacing: 2, fontWeight: 600 }}>
          Brouillons {drafts ? `(${drafts.length})` : ""}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.text, cursor: "pointer" }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {drafts === null && <div style={{ color: T.muted, textAlign: "center", marginTop: 40 }}>Chargement…</div>}
        {drafts?.length === 0 && <div style={{ color: T.muted, textAlign: "center", marginTop: 40 }}>Aucun brouillon pour l'instant</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          {drafts?.map((d) => (
            <div key={d.id} style={{ borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}` }}>
              <div style={{ position: "relative", aspectRatio: "1", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {d.type === "video"
                  ? <video src={URL.createObjectURL(d.blob)} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                  : <img src={URL.createObjectURL(d.blob)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div style={{ padding: 8, display: "flex", gap: 6 }}>
                <button onClick={() => onResume(d)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "7px 0", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "none", color: T.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  <Play size={12} /> Éditer
                </button>
                <button onClick={() => onPublishAsIs(d)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "7px 0", borderRadius: 9, background: T.gradGold, border: "none", color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  <Send size={12} /> Publier
                </button>
                <button onClick={() => remove(d.id)} style={{ padding: "7px 9px", borderRadius: 9, background: "rgba(200,64,64,0.1)", border: "none", color: T.err, cursor: "pointer" }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}