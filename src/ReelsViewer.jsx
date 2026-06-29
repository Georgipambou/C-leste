/**
 * ReelsViewer.jsx — Céleste
 * Composant Reels/TikTok isolé, extrait de App.jsx
 * Améliorations : double tap + cœur animé, bouton mute, preload n+1 propre
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Heart, MessageCircle, Bookmark, Play, Volume2, VolumeX } from "lucide-react";

// ── Utilitaires écran ─────────────────────────────────────────────
import { Capacitor } from "@capacitor/core";
import { PrivacyScreen } from "@capacitor-community/privacy-screen";
const isNative = Capacitor.isNativePlatform();
const enableScreenProtection  = async () => { if (!isNative) return; try { await PrivacyScreen.enable();  } catch (_) {} };
const disableScreenProtection = async () => { if (!isNative) return; try { await PrivacyScreen.disable(); } catch (_) {} };

// ── Cache vidéo session ───────────────────────────────────────────
const _vBlobMap = new Map();
async function getCachedVideoSrc(url) {
  if (!url) return url;
  if (_vBlobMap.has(url)) return _vBlobMap.get(url);
  try {
    const cache = await caches.open("celeste-videos");
    let resp = await cache.match(url);
    if (!resp) {
      resp = await fetch(url);
      if (!resp.ok) throw new Error("fetch fail");
      await cache.put(url, resp.clone());
    }
    const blob    = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    _vBlobMap.set(url, blobUrl);
    return blobUrl;
  } catch (e) {
    console.warn("video cache:", e);
    return url;
  }
}

// ── ReelVideoSrc ──────────────────────────────────────────────────
function ReelVideoSrc({ rawSrc, nearActive, onSrc }) {
  useEffect(() => {
    if (nearActive && rawSrc) getCachedVideoSrc(rawSrc).then(onSrc);
    else onSrc(rawSrc);
  }, [nearActive, rawSrc]);
  return null;
}

// ── Badge (copié depuis App.jsx pour autonomie) ───────────────────
function Badge({ type }) {
  if (!type) return null;
  const map = {
    confirmed: { emoji: "✦", color: "#C9952A" },
    friend:    { emoji: "♥", color: "#e05c8a" },
  };
  const b = map[type];
  if (!b) return null;
  return (
    <span style={{ fontSize: 12, color: b.color, fontWeight: 700 }}>{b.emoji}</span>
  );
}

// ── Cœur animé (double tap) ───────────────────────────────────────
function FloatingHeart({ x, y, id, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      key={id}
      style={{
        position: "absolute",
        left: x - 36,
        top:  y - 36,
        width: 72,
        height: 72,
        pointerEvents: "none",
        zIndex: 20,
        animation: "heartPop 0.9s ease forwards",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Heart size={64} fill="#ff2d55" color="#ff2d55" />
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────
export default function ReelsViewer({
  posts,
  startIndex,
  onClose,
  toggleLike,
  toggleSave,
  session,
  myProfile,
  notify,
  onUser,
  onOpenComments,
  myConnections,
  onConnect,
}) {
  const [activeIdx,       setActiveIdx]       = useState(startIndex);
  const [pausedMap,       setPausedMap]       = useState({});
  const [loadingMap,      setLoadingMap]      = useState({});
  const [progressMap,     setProgressMap]     = useState({});
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [showControls,    setShowControls]    = useState(false);
  const [muted,           setMuted]           = useState(false);
  const [reelsModalOpen,  setReelsModalOpen]  = useState(false);
  const [savedIds,        setSavedIds]        = useState(
    () => new Set((posts || []).filter(p => p.saved?.length > 0).map(p => p.id))
  );
  const [saveCountMap, setSaveCountMap] = useState(() => {
    const m = {};
    (posts || []).forEach(p => { m[p.id] = p.savesCount || 0; });
    return m;
  });
  const [hearts, setHearts] = useState([]); // [{id, x, y}]

  const containerRef = useRef(null);
  const videoRefs    = useRef({});
  const itemRefs     = useRef({});
  const lastTapRef   = useRef({});   // {idx: timestamp}
  const heartIdRef   = useRef(0);

  const uid = session?.user?.id;

  // ── Scroll initial ────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: startIndex * window.innerHeight, behavior: "auto" });
  }, []);

  // ── IntersectionObserver scroll snap ─────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.idx);
            if (idx !== activeIdx) {
              setActiveIdx(idx);
              setExpandedCaption(false);
            }
          }
        });
      },
      { threshold: 0.6 }
    );
    Object.values(itemRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [posts]);

  // ── Gestion lecture / pause / preload ─────────────────────────
  useEffect(() => {
    const active = videoRefs.current[activeIdx];
    if (active && !reelsModalOpen) {
      active.currentTime = 0;
      active.muted = muted;
      active.play().catch(() => {});
      setPausedMap(p => ({ ...p, [activeIdx]: false }));
    } else if (active && reelsModalOpen) {
      active.pause();
    }

    // Pause + libère les vidéos lointaines
    Object.entries(videoRefs.current).forEach(([i, v]) => {
      if (!v) return;
      const n = Number(i);
      if (n !== activeIdx) {
        v.pause();
        v.currentTime = 0;
        if (Math.abs(n - activeIdx) > 2) v.src = "";
      }
    });

    // Preload n+1
    const next = videoRefs.current[activeIdx + 1];
    if (next && next.readyState < 3) next.load();
  }, [activeIdx, reelsModalOpen]);

  // ── Sync mute sur toutes les vidéos ──────────────────────────
  useEffect(() => {
    Object.values(videoRefs.current).forEach(v => { if (v) v.muted = muted; });
  }, [muted]);

  // ── Protection écran ─────────────────────────────────────────
  useEffect(() => {
    const post = posts[activeIdx];
    if (post?.author?.screenshot_protection) enableScreenProtection();
    else disableScreenProtection();
    return () => disableScreenProtection();
  }, [activeIdx, posts]);

  // ── Nettoyage à la fermeture ──────────────────────────────────
  useEffect(() => () => {
    Object.values(videoRefs.current).forEach(v => { if (v) { v.pause(); v.src = ""; } });
  }, []);

  // ── Toggle pause ─────────────────────────────────────────────
  const togglePause = useCallback((idx) => {
    const v = videoRefs.current[idx];
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPausedMap(p => ({ ...p, [idx]: false })); }
    else          { v.pause();                setPausedMap(p => ({ ...p, [idx]: true  })); }
  }, []);

  // ── Seek via progress bar ─────────────────────────────────────
  const seekVideo = useCallback((idx, e) => {
    const v = videoRefs.current[idx];
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
  }, []);

  // ── Double tap → like + cœur flottant ────────────────────────
  const handleTap = useCallback((idx, post, e) => {
    const now  = Date.now();
    const last = lastTapRef.current[idx] || 0;
    if (now - last < 320) {
      // Double tap
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++heartIdRef.current;
      setHearts(h => [...h, { id, x, y }]);
      const liked = (post.likes || []).some(l => (l.user_id || l) === uid);
      if (!liked) toggleLike(post.id);
    } else {
      // Simple tap → pause/play
      togglePause(idx);
    }
    lastTapRef.current[idx] = now;
  }, [toggleLike, togglePause, uid]);

  const removeHeart = useCallback((id) => {
    setHearts(h => h.filter(hh => hh.id !== id));
  }, []);

  // ── Affiche les contrôles 2,5s au touch ──────────────────────
  const showCtrl = useCallback(() => {
    setShowControls(true);
    clearTimeout(window._rctimer);
    window._rctimer = setTimeout(() => setShowControls(false), 2500);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, background: "#000" }}>

      {/* Bouton fermer */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "calc(14px + env(safe-area-inset-top,0px))",
          left: 14, zIndex: 10,
          background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%",
          width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", cursor: "pointer",
        }}
      >
        <X size={20} />
      </button>

      {/* Bouton mute */}
      <button
        onClick={() => setMuted(m => !m)}
        style={{
          position: "absolute",
          top: "calc(14px + env(safe-area-inset-top,0px))",
          right: 14, zIndex: 10,
          background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%",
          width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", cursor: "pointer",
        }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      {/* Scroll container */}
      <div
        ref={containerRef}
        style={{
          height: "100%", overflowY: "scroll",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {posts.map((post, idx) => {
          const liked       = (post.likes || []).some(l => (l.user_id || l) === uid);
          const nearActive  = Math.abs(idx - activeIdx) <= 1;
          const rawVideoSrc = (post.media_urls || []).find(u => (u || "").match(/\.(mp4|mov|webm)/i)) || post.img;
          const caption     = post.text || "";
          const captionShort = caption.length > 120 ? caption.slice(0, 120) + "..." : caption;
          const isActive    = idx === activeIdx;
          const isPaused    = pausedMap[idx]  || false;
          const isLoading   = loadingMap[idx] || false;
          const progress    = progressMap[idx] || 0;
          const isConnected = myConnections?.includes(post.by);
          const isMe        = post.by === uid;

          return (
            <div
              key={post.id}
              ref={el => itemRefs.current[idx] = el}
              data-idx={idx}
              style={{
                height: "100vh", width: "100%",
                scrollSnapAlign: "start",
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#000", flexShrink: 0, overflow: "hidden",
              }}
              onTouchStart={showCtrl}
            >
              {/* Preload src */}
              <ReelVideoSrc
                rawSrc={rawVideoSrc}
                nearActive={nearActive}
                onSrc={src => {
                  const v = videoRefs.current[idx];
                  if (v && src !== v.src) v.src = src;
                }}
              />

              {/* Vidéo */}
              {nearActive && rawVideoSrc && (
                <video
                  ref={el => { videoRefs.current[idx] = el; }}
                  src={rawVideoSrc}
                  loop playsInline webkit-playsinline="true"
                  muted={muted}
                  preload={isActive ? "auto" : "metadata"}
                  style={{
                    width: "100%", height: "100%",
                    objectFit: "contain",
                    position: "absolute", inset: 0,
                    background: "#000",
                  }}
                  onClick={e => handleTap(idx, post, e)}
                  onWaiting={() => setLoadingMap(p => ({ ...p, [idx]: true  }))}
                  onCanPlay={() => setLoadingMap(p => ({ ...p, [idx]: false }))}
                  onPlaying={() => setLoadingMap(p => ({ ...p, [idx]: false }))}
                  onTimeUpdate={e => {
                    const v = e.target;
                    if (v.duration) setProgressMap(p => ({ ...p, [idx]: (v.currentTime / v.duration) * 100 }));
                  }}
                />
              )}

              {/* Spinner chargement */}
              {isActive && isLoading && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3, pointerEvents: "none" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />
                </div>
              )}

              {/* Icône pause */}
              {isActive && isPaused && !isLoading && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3, pointerEvents: "none" }}>
                  <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: "50%", width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Play size={26} color="#fff" style={{ marginLeft: 4 }} />
                  </div>
                </div>
              )}

              {/* Cœurs flottants (double tap) */}
              {isActive && hearts.map(h => (
                <FloatingHeart key={h.id} id={h.id} x={h.x} y={h.y} onDone={() => removeHeart(h.id)} />
              ))}

              {/* Dégradé bas */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)", pointerEvents: "none" }} />

              {/* Barre de progression */}
              <div
                onTouchStart={e => {
                  const v = videoRefs.current[idx];
                  if (v) v._seekStart = { x: e.touches[0].clientX, t: v.currentTime };
                }}
                onTouchMove={e => {
                  const v = videoRefs.current[idx];
                  if (!v || !v._seekStart || !v.duration) return;
                  const dx = e.touches[0].clientX - v._seekStart.x;
                  const dt = (dx / window.innerWidth) * v.duration;
                  v.currentTime = Math.max(0, Math.min(v.duration, v._seekStart.t + dt));
                }}
                onClick={e => seekVideo(idx, e)}
                style={{
                  position: "absolute",
                  bottom: "calc(env(safe-area-inset-bottom,0px) + 56px)",
                  left: 0, right: 0, height: 5,
                  background: "rgba(255,255,255,0.25)",
                  zIndex: 5, cursor: "pointer",
                  opacity: showControls ? 1 : 0,
                  transition: "opacity 0.3s ease",
                }}
              >
                <div style={{ height: "100%", width: `${progress}%`, background: "rgba(255,255,255,0.75)", borderRadius: 3, transition: "width 0.05s linear" }} />
              </div>

              {/* Infos auteur + caption */}
              <div style={{ position: "absolute", left: 14, right: 80, bottom: "calc(160px + env(safe-area-inset-bottom,0px))", color: "#fff", zIndex: 2 }}>
                <div onClick={() => onUser?.(post.by)} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, cursor: "pointer" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{post.author?.fullName || post.author?.prenom || post.author?.name || ""}</span>
                  <Badge type={post.author?.badge} />
                </div>
                {caption.length > 0 && (
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.92)", textAlign: "left" }}>
                    {isActive && expandedCaption ? caption : captionShort}
                    {caption.length > 120 && isActive && (
                      <span
                        onClick={() => setExpandedCaption(e => !e)}
                        style={{ color: "#C9952A", cursor: "pointer", marginLeft: 4, fontWeight: 600 }}
                      >
                        {expandedCaption ? " moins" : " plus"}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Boutons marketplace */}
              {post.is_for_sale && (post.whatsapp_contact || post.contact_link) && (
                <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(100px + env(safe-area-inset-bottom,0px))", zIndex: 4, display: "flex", flexDirection: "column", gap: 6, padding: "0 0 6px" }}>
                  {post.whatsapp_contact && (
                    <a href={"https://wa.me/" + post.whatsapp_contact.replace(/\D/g, "")} target="_blank" rel="noreferrer"
                      style={{ margin: "0 12px", background: "linear-gradient(135deg,#25D366,#128C7E)", padding: "10px 20px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                      <MessageCircle size={16} /> Contacter sur WhatsApp
                    </a>
                  )}
                  {post.contact_link && (
                    <a href={post.contact_link} target="_blank" rel="noreferrer"
                      style={{ margin: "0 12px", background: "rgba(74,144,217,0.85)", padding: "10px 20px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                      🔗 Voir le lien
                    </a>
                  )}
                </div>
              )}

              {/* Actions droite */}
              <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 22, zIndex: 2 }}>

                {/* Avatar + bouton connect */}
                <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div onClick={() => onUser?.(post.by)} style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(255,255,255,0.2)", overflow: "hidden", border: "2px solid #fff", cursor: "pointer" }}>
                    {post.author?.avatar_url && <img src={post.author.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} alt="" />}
                  </div>
                  {!isMe && !isConnected && (
                    <button onClick={() => onConnect?.(post.by)} style={{ background: "#ff2d55", border: "2px solid #fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, color: "#fff", fontSize: 14, fontWeight: 900, lineHeight: 1 }}>+</button>
                  )}
                </div>

                {/* Like */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <button onClick={() => toggleLike(post.id)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }}>
                    <Heart size={32} fill={liked ? "#ff2d55" : "none"} color={liked ? "#ff2d55" : "#fff"} />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{(post.likes || []).length}</span>
                </div>

                {/* Commentaires */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <button
                    onClick={() => { setReelsModalOpen(true); onOpenComments(post, () => setReelsModalOpen(false)); }}
                    style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }}
                  >
                    <MessageCircle size={30} color="#fff" />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{(post.comments || []).length}</span>
                </div>

                {/* Sauvegarder */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <button
                    onClick={() => {
                      const alreadySaved = savedIds.has(post.id);
                      setSavedIds(prev => { const n = new Set(prev); alreadySaved ? n.delete(post.id) : n.add(post.id); return n; });
                      setSaveCountMap(prev => ({ ...prev, [post.id]: Math.max(0, (prev[post.id] || 0) + (alreadySaved ? -1 : 1)) }));
                      toggleSave(post.id);
                    }}
                    style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }}
                  >
                    <Bookmark size={28} fill={savedIds.has(post.id) ? "#C9952A" : "none"} color={savedIds.has(post.id) ? "#C9952A" : "#fff"} />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{saveCountMap[post.id] ?? post.savesCount ?? 0}</span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes heartPop {
          0%   { transform: scale(0.5); opacity: 1; }
          50%  { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1) translateY(-40px); opacity: 0; }
        }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
