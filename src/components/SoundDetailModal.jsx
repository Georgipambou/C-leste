/**
 * SoundDetailModal.jsx — Céleste
 * Écran plein écran "détail d'un son" : qui l'a créé, extrait audio,
 * stats (nb de publications, total de likes), grille des posts qui
 * l'utilisent, et un bouton pour l'utiliser sur sa propre publication.
 *
 * Props :
 *   sb          — client Supabase
 *   soundId     — id du son à afficher
 *   onClose     — () => void
 *   onUseSound  — (sound) => void   — appelé quand l'utilisateur clique "Utiliser ce son"
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Play, Pause, Music2, Heart, Eye } from "lucide-react";

function fmtCount(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".0", "")} M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(".0", "")} k`;
  return String(v);
}

export default function SoundDetailModal({ sb, soundId, onClose, onUseSound, onOpenPost }) {
  const [sound, setSound] = useState(null);
  const [owner, setOwner] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!sb || !soundId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: soundData } = await sb.from("sound_stats").select("*").eq("id", soundId).single();
      if (cancelled) return;
      setSound(soundData || null);

      if (soundData?.created_by) {
        const { data: ownerData } = await sb.from("profiles").select("id,prenom,nom,avatar_url").eq("id", soundData.created_by).single();
        if (!cancelled) setOwner(ownerData || null);
      }

      const { data: postsData } = await sb
        .from("posts")
        .select("id,img_url,media_urls,type,phase_views,likes(count)")
        .eq("sound_id", soundId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!cancelled) setPosts(postsData || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sb, soundId]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  }, [playing]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const ownerName = owner ? `${owner.prenom || ""} ${owner.nom || ""}`.trim() || "Utilisateur Céleste" : "Céleste";

 return (
  <div style={{ position: "fixed", inset: 0, zIndex: 1250, background: "#000", display: "flex", flexDirection: "column" }}>
      {sound?.url && <audio ref={audioRef} src={sound.url} loop onEnded={() => setPlaying(false)} />}

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "52px 18px 14px" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", display: "flex" }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Son</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 100px" }}>
        {loading && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", marginTop: 40 }}>Chargement…</div>}

        {!loading && sound && (
          <>
            {/* En-tête : disque + titre + créateur */}
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6, marginBottom: 18 }}>
              <div
                onClick={togglePlay}
                style={{
                  width: 74, height: 74, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                  border: "3px solid #C9952A", overflow: "hidden", position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(255,255,255,0.06)",
                  animation: playing ? "celeste-disc-spin 3s linear infinite" : "none",
                }}
              >
                {owner?.avatar_url
                  ? <img src={owner.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <Music2 size={26} color="#C9952A" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {sound.title}
                </div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>
                  Son original de <span style={{ color: "#e0b84a", fontWeight: 600 }}>{ownerName}</span>
                </div>
              </div>
            </div>

            {/* Bouton écouter */}
            <button
              onClick={togglePlay}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "12px", borderRadius: 20, marginBottom: 16,
                border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)",
                color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? "Mettre en pause" : "Écouter un extrait"}
            </button>

            {/* Stats */}
            <div style={{ display: "flex", gap: 18, marginBottom: 22, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              <span>{fmtCount(sound.usage_count)} publications</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Heart size={13} /> {fmtCount(sound.total_likes)}</span>
            </div>

            {/* Grille des posts utilisant ce son */}
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
              Publications avec ce son
            </div>
            {posts.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 10 }}>
                Personne n'a encore utilisé ce son.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
              {posts.map((p) => {
                const thumb = p.img_url || p.media_urls?.[0];
                const likeCount = p.likes?.[0]?.count || 0;
                return (
                  <div key={p.id} onClick={() => {
                    const soundRef = { id: sound.id, title: sound.title, url: sound.url, created_by: sound.created_by, owner: owner ? { avatar_url: owner.avatar_url } : null };
                    const soundPosts = posts.map(x => ({ ...x, img: x.img_url, sound: soundRef }));
                    onOpenPost?.({ ...p, img: p.img_url, sound: soundRef }, soundPosts);
                    onClose?.();
                  }} style={{ position: "relative", aspectRatio: "9/16", background: "rgba(255,255,255,0.05)", borderRadius: 6, overflow: "hidden", cursor: "pointer" }}>
                    {thumb && <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    <div style={{
                      position: "absolute", bottom: 4, left: 4, right: 4, display: "flex", justifyContent: "space-between",
                      fontSize: 10, color: "#fff", fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                    }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Eye size={10} /> {fmtCount(p.phase_views)}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Heart size={10} /> {fmtCount(likeCount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Bouton sticky en bas */}
      {sound && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 18px 30px", background: "linear-gradient(to top, rgba(0,0,0,0.95), transparent)" }}>
          <button
            onClick={() => { audioRef.current?.pause(); onUseSound?.({ id: sound.id, title: sound.title, url: sound.url }); onClose(); }}
            style={{
              width: "100%", padding: "15px", borderRadius: 24, border: "none",
              background: "linear-gradient(135deg,#C9952A 0%,#E8B84B 100%)", color: "#000",
              fontWeight: 800, fontSize: 15, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 24px rgba(201,149,42,0.5)",
            }}
          >
            <Music2 size={16} /> Utiliser ce son
          </button>
        </div>
      )}

      <style>{`@keyframes celeste-disc-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}