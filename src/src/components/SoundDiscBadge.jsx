/**
 * SoundDiscBadge.jsx — Céleste
 * Le petit rond tournant façon TikTok, affiché en bas d'un Reel ou d'une
 * Photo quand un son est attaché. Montre l'avatar du créateur du son ;
 * cliquer dessus ouvre SoundDetailModal (géré par le composant parent).
 *
 * Props :
 *   avatarUrl — url de l'avatar du créateur du son (ou null)
 *   playing   — bool, anime la rotation si vrai
 *   onClick   — () => void
 */
import { Music2 } from "lucide-react";

export default function SoundDiscBadge({ avatarUrl, playing = true, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 40, height: 40, borderRadius: "50%", cursor: "pointer",
        border: "2px solid rgba(255,255,255,0.8)", overflow: "hidden", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)",
        animation: playing ? "celeste-disc-badge-spin 3s linear infinite" : "none",
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
      }}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <Music2 size={16} color="#e0b84a" />}
      <style>{`@keyframes celeste-disc-badge-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}