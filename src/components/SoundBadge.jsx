/**
 * SoundBadge.jsx — Céleste
 * Petit badge "disque qui tourne + titre du son", affiché en bas d'un
 * Reel ou d'une Photo quand un son est attaché. Purement visuel — la
 * lecture réelle est gérée par useSoundPlayback (photos) ou par la
 * piste audio native de la vidéo (reels).
 */
export default function SoundBadge({ title, playing = true }) {
  if (!title) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 20,
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(6px)",
        width: "fit-content",
        maxWidth: "70vw",
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "2px solid #e0b84a",
          borderTopColor: "transparent",
          flexShrink: 0,
          animation: playing ? "celeste-sound-spin 1.8s linear infinite" : "none",
        }}
      />
      <span
        style={{
          color: "#fff",
          fontSize: 12.5,
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </span>
      <style>{`
        @keyframes celeste-sound-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
