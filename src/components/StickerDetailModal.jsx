/**
 * StickerDetailModal.jsx — Céleste
 * Vue plein écran "détail d'un sticker" : aperçu, auteur, nombre
 * d'utilisations, bouton "Enregistrer" (ajoute à Mes stickers,
 * réutilise `user_saved_stickers` déjà utilisée par StickerPicker)
 * et bouton "Signaler".
 *
 * Props :
 *   sb        — client Supabase
 *   stickerId — id du sticker à afficher
 *   userId    — id de l'utilisateur courant (pour enregistrer/signaler)
 *   onClose   — () => void
 *   notify    — (msg) => void
 */
import { useState, useEffect } from "react";
import { ArrowLeft, Bookmark, Flag } from "lucide-react";

const REPORT_REASONS = [
  "Contenu choquant",
  "Contenu haineux ou discriminatoire",
  "Contenu sexuel",
  "Violation de droits d'auteur",
  "Autre",
];

export default function StickerDetailModal({ sb, stickerId, userId, onClose, notify }) {
  const [sticker, setSticker] = useState(null);
  const [author, setAuthor] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!sb || !stickerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await sb.from("stickers").select("*").eq("id", stickerId).single();
      if (cancelled) return;
      setSticker(data || null);

      if (data?.author_id) {
        const { data: a } = await sb.from("profiles").select("id,prenom,nom,avatar_url").eq("id", data.author_id).single();
        if (!cancelled) setAuthor(a || null);
      }
      if (userId) {
        const { data: s } = await sb.from("user_saved_stickers").select("sticker_id").eq("user_id", userId).eq("sticker_id", stickerId).maybeSingle();
        if (!cancelled) setSaved(!!s);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sb, stickerId, userId]);

  const toggleSave = async () => {
    if (!userId) return;
    if (saved) {
      setSaved(false);
      await sb.from("user_saved_stickers").delete().eq("user_id", userId).eq("sticker_id", stickerId);
      notify?.("Retiré de tes stickers");
    } else {
      setSaved(true);
      await sb.from("user_saved_stickers").upsert(
        { user_id: userId, sticker_id: stickerId },
        { onConflict: "user_id,sticker_id", ignoreDuplicates: true }
      );
      notify?.("Ajouté à tes stickers ✦");
    }
  };

  const submitReport = async (reason) => {
    if (!userId) return;
    await sb.from("reports").insert({ reporter_id: userId, sticker_id: stickerId, reason });
    setShowReport(false);
    notify?.("Signalement envoyé ✦");
  };

  const authorName = author ? `${author.prenom || ""} ${author.nom || ""}`.trim() || "Utilisateur Céleste" : "Céleste";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1250, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "52px 18px 14px" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", display: "flex" }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Sticker</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {loading && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 40 }}>Chargement…</div>}

        {!loading && sticker && (
          <>
            <div style={{ width: 180, height: 180, borderRadius: 20, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 20, marginBottom: 18, overflow: "hidden" }}>
              {sticker.format === "webm" || sticker.format === "mp4"
                ? <video src={sticker.url} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <img src={sticker.url} alt={sticker.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
            </div>

            <div style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 4, textAlign: "center" }}>{sticker.name}</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 4 }}>
              {sticker.added_by_admin ? "Sticker officiel Céleste" : <>Ajouté par <span style={{ color: "#e0b84a", fontWeight: 600 }}>{authorName}</span></>}
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12.5, marginBottom: 24 }}>
              {sticker.usage_count || 0} utilisations
            </div>

            <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 320 }}>
              <button
                onClick={toggleSave}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "13px", borderRadius: 20, border: `1px solid ${saved ? "#C9952A" : "rgba(255,255,255,0.2)"}`,
                  background: saved ? "rgba(201,149,42,0.15)" : "rgba(255,255,255,0.05)",
                  color: saved ? "#e0b84a" : "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer",
                }}
              >
                <Bookmark size={16} fill={saved ? "#e0b84a" : "none"} />
                {saved ? "Enregistré" : "Enregistrer"}
              </button>
              <button
                onClick={() => setShowReport(true)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "13px 18px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer",
                }}
              >
                <Flag size={16} /> Signaler
              </button>
            </div>
          </>
        )}
      </div>

      {showReport && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowReport(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "#111", borderRadius: "20px 20px 0 0", padding: "20px 18px 34px" }}>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Pourquoi signaler ce sticker ?</div>
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => submitReport(r)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "13px 4px",
                  background: "none", border: "none", borderTop: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff", fontSize: 14, cursor: "pointer",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}