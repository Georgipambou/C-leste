/**
 * PhotoViewer.jsx — Céleste
 * Composant "Reels pour les photos", inspiré de ReelsViewer.jsx.
 * Défilement vertical entre publications-photos, swipe horizontal à
 * l'intérieur d'un même post pour parcourir son carrousel (les vidéos
 * éventuelles d'un carrousel mixte sont ignorées ici).
 * Mêmes actions que ReelsViewer : like (+ double-tap), commentaires,
 * sauvegarde, menu "..." (supprimer / signaler / ne plus voir).
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, Heart, MessageCircle, Bookmark, MoreVertical, Trash2, Flag, EyeOff, Eye, Volume2, VolumeX } from "lucide-react";
import { useVideoEngagement } from "./lib/recommendation/useVideoEngagement";
import SoundBadge from "./components/SoundBadge";
import SoundDiscBadge from "./components/SoundDiscBadge";

// ── Utilitaires écran (copiés depuis ReelsViewer pour autonomie) ──
import { Capacitor } from "@capacitor/core";
import { PrivacyScreen } from "@capacitor-community/privacy-screen";
const isNative = Capacitor.isNativePlatform();
const enableScreenProtection  = async () => { if (!isNative) return; try { await PrivacyScreen.enable();  } catch (_) {} };
const disableScreenProtection = async () => { if (!isNative) return; try { await PrivacyScreen.disable(); } catch (_) {} };

// ── Détection vidéo (pour filtrer les carrousels mixtes) ──────────
const isVideoUrl = (u) => /\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(u || "");

// ── Raisons de signalement (copiées depuis ReelsViewer) ───────────
const POST_REPORT_REASONS = [
  "Contenu inapproprié ou choquant",
  "Nudité ou contenu sexuel",
  "Violence ou contenu dangereux",
  "Discours haineux ou discrimination",
  "Harcèlement ou intimidation",
  "Fausses informations",
  "Spam ou publicité non désirée",
  "Contenu protégé (droits d'auteur)",
  "Autre",
];

// ── Badge (copié depuis App.jsx pour autonomie) ───────────────────
function Badge({ type }) {
  if (!type) return null;
  const isConfirmed = type === "confirmed";
  return isConfirmed ? (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:13,height:13,borderRadius:"50%",
      background:"linear-gradient(135deg,#1DA1F2,#0a85d9)",
      boxShadow:"0 0 0 2px rgba(29,161,242,0.3), 0 0 10px rgba(29,161,242,0.8), 0 0 20px rgba(29,161,242,0.4)",
      flexShrink:0,position:"relative"}}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  ) : (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:13,height:13,borderRadius:"50%",
      background:"linear-gradient(135deg,#FFD700,#FF8C00)",
      boxShadow:"0 0 0 2px rgba(255,165,0,0.3), 0 0 10px rgba(255,180,0,0.9), 0 0 22px rgba(255,140,0,0.5)",
      flexShrink:0}}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
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

// ── Menu "..." (supprimer / signaler / ne plus voir) ──────────────
function PostActionMenu({ isMine, isAdmin, onClose, onDelete, onReport, onMute }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "rgba(18,18,18,0.98)", borderRadius: "22px 22px 0 0", paddingBottom: "calc(12px + env(safe-area-inset-bottom,0px))", animation: "slideUp .2s ease" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "12px auto 8px" }} />
        {(isMine || isAdmin) && (
          <button onClick={onDelete} style={{ width: "100%", padding: "16px 22px", background: "none", border: "none", display: "flex", alignItems: "center", gap: 14, fontSize: 15, color: "#ff5c5c", textAlign: "left", cursor: "pointer" }}>
            <Trash2 size={19} /> Supprimer la publication
          </button>
        )}
        {!isMine && (
          <>
            <button onClick={onReport} style={{ width: "100%", padding: "16px 22px", background: "none", border: "none", display: "flex", alignItems: "center", gap: 14, fontSize: 15, color: "#fff", textAlign: "left", cursor: "pointer", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <Flag size={19} /> Signaler la publication
            </button>
            <button onClick={onMute} style={{ width: "100%", padding: "16px 22px", background: "none", border: "none", display: "flex", alignItems: "center", gap: 14, fontSize: 15, color: "#fff", textAlign: "left", cursor: "pointer", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <EyeOff size={19} /> Ne plus voir les publications de cette personne
            </button>
          </>
        )}
        <button onClick={onClose} style={{ width: "100%", padding: "14px 22px", background: "none", border: "none", fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center", cursor: "pointer", marginTop: 4 }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// ── Feuille de signalement (raisons + détails) ────────────────────
function PostReportSheet({ onClose, onSubmit }) {
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState("");
  const [pendingReason, setPendingReason] = useState(null);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 480, background: "rgba(18,18,18,0.98)", borderRadius: "22px 22px 0 0", padding: "20px 18px calc(24px + env(safe-area-inset-bottom,0px))", animation: "slideUp .25s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Signaler la publication</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={15} /></button>
        </div>
        {!showDetails ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: "55vh", overflowY: "auto" }}>
            {POST_REPORT_REASONS.map(r => (
              <button key={r} onClick={() => onSubmit(r, "")} style={{ padding: "13px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.9)", fontSize: 13.5, textAlign: "left", cursor: "pointer" }}>
                {r}
              </button>
            ))}
            <button onClick={() => setShowDetails(true)} style={{ padding: "10px 14px", background: "none", border: "none", color: "#e0b84a", fontSize: 12, textAlign: "left", cursor: "pointer" }}>
              + Ajouter des précisions avant d'envoyer
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 12, maxHeight: "40vh", overflowY: "auto" }}>
              {POST_REPORT_REASONS.map(r => (
                <button key={r} onClick={() => setPendingReason(r)} style={{ padding: "11px 14px", borderRadius: 12, border: `1px solid ${pendingReason === r ? "#C9952A88" : "rgba(255,255,255,0.1)"}`, background: pendingReason === r ? "rgba(201,149,42,0.12)" : "transparent", color: pendingReason === r ? "#e0b84a" : "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "left", cursor: "pointer" }}>
                  {r}
                </button>
              ))}
            </div>
            <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Détails" rows={2}
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontSize: 13, outline: "none", resize: "none", marginBottom: 12 }} />
            <button onClick={() => pendingReason && onSubmit(pendingReason, details)} disabled={!pendingReason}
              style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: pendingReason ? "linear-gradient(135deg,#e0b84a,#C9952A)" : "rgba(255,255,255,0.08)", color: pendingReason ? "#000" : "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 700, cursor: pendingReason ? "pointer" : "default" }}>
              Envoyer le signalement
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────
export default function PhotoViewer({
  posts,
  sb,
  startIndex,
  startMediaIndex = 0,
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
  onOpenSound,
}) {
  const [activeIdx,       setActiveIdx]       = useState(startIndex);
  const [mediaIdxMap,     setMediaIdxMap]     = useState(() => ({ [startIndex]: startMediaIndex }));
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [photoModalOpen,  setPhotoModalOpen]  = useState(false);
  const [hiddenPostIds,   setHiddenPostIds]   = useState(() => new Set());
  const [menuPostId,      setMenuPostId]      = useState(null);
  const [reportPost,      setReportPost]      = useState(null);
  const [savedIds,        setSavedIds]        = useState(
    () => new Set((posts || []).filter(p => p.saved?.length > 0).map(p => p.id))
  );
  const [saveCountMap, setSaveCountMap] = useState(() => {
    const m = {};
    (posts || []).forEach(p => { m[p.id] = p.savesCount || 0; });
    return m;
  });
  const [hearts, setHearts] = useState([]); // [{id, x, y}]
  const [viewCounts, setViewCounts] = useState({});

  const containerRef  = useRef(null);
  const itemRefs      = useRef({});
  const carouselRefs  = useRef({});
  const lastTapRef    = useRef({});
  const heartIdRef    = useRef(0);
  const soundAudioRef = useRef(null);
  const [muted, setMuted] = useState(false);

  const uid = session?.user?.id;
  const engagement = useVideoEngagement(sb, uid);

  const [likedIds, setLikedIds] = useState(
    () => new Set((posts || []).filter(p => (p.likes || []).some(l => (l.user_id || l) === uid)).map(p => p.id))
  );
  const [likeCountMap, setLikeCountMap] = useState(() => {
    const m = {};
    (posts || []).forEach(p => { m[p.id] = (p.likes || []).length; });
    return m;
  });
  const handleToggleLike = useCallback((post) => {
    const alreadyLiked = likedIds.has(post.id);
    setLikedIds(prev => {
      const n = new Set(prev);
      alreadyLiked ? n.delete(post.id) : n.add(post.id);
      return n;
    });
    setLikeCountMap(cm => ({ ...cm, [post.id]: Math.max(0, (cm[post.id] ?? (post.likes || []).length) + (alreadyLiked ? -1 : 1)) }));
    toggleLike(post.id);
  }, [toggleLike, likedIds]);

  // Liste des médias-photo par post (on ignore les vidéos d'un carrousel mixte)
  const photosByPost = useMemo(() => {
    const m = {};
    (posts || []).forEach(p => {
      const allMedia = p.media_urls?.length > 0 ? p.media_urls : (p.img ? [p.img] : []);
      m[p.id] = allMedia.filter(u => !isVideoUrl(u));
    });
    return m;
  }, [posts]);

  // Liste réellement affichée : on retire ce qui vient d'être supprimé/masqué
  // ou ce qui n'a plus aucune photo
  const displayPosts = useMemo(
    () => (posts || []).filter(p => !hiddenPostIds.has(p.id) && (photosByPost[p.id] || []).length > 0),
    [posts, hiddenPostIds, photosByPost]
  );

  // Si la liste affichée se vide ou rétrécit sous l'index courant, on s'ajuste
  useEffect(() => {
    if (displayPosts.length === 0) { onClose?.(); return; }
    if (activeIdx >= displayPosts.length) setActiveIdx(displayPosts.length - 1);
  }, [displayPosts.length]);

  // ── Scroll initial (vertical + horizontal du post de départ) ──
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: startIndex * window.innerHeight, behavior: "auto" });
    const carEl = carouselRefs.current[startIndex];
    if (carEl && startMediaIndex > 0) {
      carEl.scrollTo({ left: startMediaIndex * carEl.clientWidth, behavior: "auto" });
    }
  }, []);

  // ── IntersectionObserver scroll snap (vertical, entre posts) ──
  useEffect(() => {
    let debounceTimer = null;
    const observer = new IntersectionObserver(
      entries => {
        const best = entries.reduce((acc, e) => (e.intersectionRatio > (acc?.intersectionRatio || 0) ? e : acc), null);
        if (best && best.intersectionRatio >= 0.6) {
          const idx = Number(best.target.dataset.idx);
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            setActiveIdx(prev => (idx !== prev ? idx : prev));
            setExpandedCaption(false);
          }, 80);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] }
    );
    Object.values(itemRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => { clearTimeout(debounceTimer); observer.disconnect(); };
  }, [displayPosts]);

  // ── Protection écran selon l'auteur du post actif ─────────────
  useEffect(() => {
    const post = displayPosts[activeIdx];
    if (post?.author?.screenshot_protection) enableScreenProtection();
    else disableScreenProtection();
    return () => disableScreenProtection();
  }, [activeIdx, displayPosts]);

  // ── Comptage des vues (post actif uniquement) ──────────────────
  useEffect(() => {
    const post = displayPosts[activeIdx];
    if (!post?.id || !session?.user?.id) return;
    sb.from("post_views").upsert(
      { post_id: post.id, viewer_id: session.user.id },
      { onConflict: "post_id,viewer_id", ignoreDuplicates: true }
    ).then(() => {
      sb.from("post_views").select("*", { count: "exact", head: true }).eq("post_id", post.id)
        .then(({ count }) => setViewCounts(v => ({ ...v, [post.id]: count || 0 })));
    });
  }, [activeIdx, displayPosts, session?.user?.id]);

  // ── Suivi d'engagement (durée de visionnage par photo) ────────
  useEffect(() => {
    const post = displayPosts[activeIdx];
    if (!post?.id) return;
    const PHOTO_TARGET_MS = 3000; // durée de référence, indicative (le seuil réel est absolu, voir useVideoEngagement)
    engagement.start(post.id, PHOTO_TARGET_MS, "photo");
    const startedAt = Date.now();
    const timer = setInterval(() => engagement.tick(Date.now() - startedAt), 500);
    return () => clearInterval(timer);
  }, [activeIdx, displayPosts]);

  // ── Lecture du son attaché à la photo active ──────────────────
  useEffect(() => {
    const post = displayPosts[activeIdx];
    const a = soundAudioRef.current;
    if (!a) return;
    a.muted = muted;
    if (post?.sound?.url) {
      if (a.src !== post.sound.url) { a.src = post.sound.url; a.currentTime = 0; }
      a.loop = true;
      a.play().catch(() => {});
    } else {
      a.pause();
    }
    return () => a.pause();
  }, [activeIdx, displayPosts, muted]);

  // ── Défilement horizontal du carrousel d'un post ──────────────
  const handleCarouselScroll = useCallback((idx, photosCount) => (e) => {
    const el = e.currentTarget;
    const cardWidth = el.scrollWidth / photosCount;
    const mIdx = Math.round(el.scrollLeft / cardWidth);
    setMediaIdxMap(prev => (prev[idx] === mIdx ? prev : { ...prev, [idx]: mIdx }));
  }, []);

  // ── Double tap → like + cœur flottant ────────────────────────
  const handleTap = useCallback((idx, post, e) => {
    const now  = Date.now();
    const last = lastTapRef.current[idx] || 0;
    if (now - last < 320) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++heartIdRef.current;
      setHearts(h => [...h, { id, x, y }]);
      if (!likedIds.has(post.id)) { handleToggleLike(post); engagement.markLiked(myProfile?.is_admin); }
    }
    lastTapRef.current[idx] = now;
  }, [handleToggleLike, likedIds, engagement, myProfile]);

  const removeHeart = useCallback((id) => {
    setHearts(h => h.filter(hh => hh.id !== id));
  }, []);

  // ── Supprimer / signaler / masquer ────────────────────────────
  const handleDeletePost = useCallback(async (post) => {
    setMenuPostId(null);
    if (!window.confirm("Supprimer cette publication ?")) return;
    const byAdmin = myProfile?.is_admin && post.by !== uid;
    setHiddenPostIds(p => new Set([...p, post.id]));
    notify?.("Publication supprimée");
    if (myProfile?.is_admin) await sb.from("posts").delete().eq("id", post.id);
    else await sb.from("posts").delete().eq("id", post.id).eq("author_id", uid);
    if (byAdmin) await sb.from("notifications").insert({ user_id: post.by, from_id: uid, type: "post_deleted", text: "Ta publication a été supprimée par un administrateur", read: false });
  }, [uid, myProfile, notify]);

  const handleMuteAuthor = useCallback(async (post) => {
    setMenuPostId(null);
    if (!uid || !post?.by) return;
    const { error } = await sb.from("muted_authors").insert({ muter_id: uid, muted_id: post.by });
    if (error && error.code !== "23505") { notify?.("Erreur, réessaie"); return; }
    setHiddenPostIds(p => new Set([...p, ...(posts || []).filter(x => x.by === post.by).map(x => x.id)]));
    notify?.("Tu ne verras plus les publications de cette personne");
  }, [uid, posts, notify]);

  const handleSubmitReport = useCallback(async (reason, details) => {
    if (!uid || !reportPost) return;
    engagement.markReported();
    await sb.from("reports").insert({ reporter_id: uid, reported_id: reportPost.by, post_id: reportPost.id, reason, details });
    setReportPost(null);
    notify?.("Publication signalée — merci, notre équipe va l'examiner");
  }, [uid, reportPost, notify, engagement]);

  const menuPost = displayPosts.find(p => p.id === menuPostId) || null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, background: "#000" }}>
      <audio ref={soundAudioRef} style={{ display: "none" }} />

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

      {/* Scroll container vertical */}
      <div
        ref={containerRef}
        style={{
          height: "100%", overflowY: "scroll",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {displayPosts.map((post, idx) => {
          const liked        = likedIds.has(post.id);
          const isMe         = post.by === uid;
          const photos       = photosByPost[post.id] || [];
          const curMediaIdx  = mediaIdxMap[idx] || 0;
          const caption      = post.text || "";
          const captionShort = caption.length > 120 ? caption.slice(0, 120) + "..." : caption;
          const isActive     = idx === activeIdx;
          const isConnected  = myConnections?.includes(post.by);
          const isLocked     = post.is_private && !isNative && !isMe;

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
            >
              {/* Contenu privé */}
              {isLocked ? (
                <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,color:"#fff",padding:20,textAlign:"center"}}>
                  <div style={{width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center"}}>🔒</div>
                  <p style={{margin:0,fontSize:15,fontWeight:700}}>Contenu privé</p>
                  <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.6)",maxWidth:240}}>Disponible uniquement dans l'application Céleste sur Android.</p>
                </div>
              ) : (
                <>
                  {/* Carrousel horizontal des photos du post */}
                  <div
                    ref={el => carouselRefs.current[idx] = el}
                    onScroll={handleCarouselScroll(idx, photos.length)}
                    onClick={e => handleTap(idx, post, e)}
                    style={{
                      display: "flex", width: "100%", height: "100%",
                      overflowX: photos.length > 1 ? "auto" : "hidden",
                      scrollSnapType: "x mandatory",
                      WebkitOverflowScrolling: "touch",
                      scrollbarWidth: "none",
                    }}
                  >
                    {photos.map((url, pIdx) => (
                      <div key={pIdx} style={{ flex: "0 0 100%", scrollSnapAlign: "start", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img
                          src={url}
                          alt=""
                          loading={Math.abs(pIdx - curMediaIdx) <= 1 ? "eager" : "lazy"}
                          style={{ width: "100%", height: "100%", objectFit: "contain", userSelect: "none" }}
                          draggable={false}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Points du carrousel */}
                  {photos.length > 1 && (
                    <div style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top,0px) + 46px)", left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4, zIndex: 4, pointerEvents: "none" }}>
                      {photos.map((_, pIdx) => (
                        <div key={pIdx} style={{ width: pIdx === curMediaIdx ? 16 : 6, height: 6, borderRadius: 3, background: pIdx === curMediaIdx ? "#C9952A" : "rgba(255,255,255,0.4)", transition: "width .2s" }} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Cœurs flottants (double tap) */}
              {isActive && hearts.map(h => (
                <FloatingHeart key={h.id} id={h.id} x={h.x} y={h.y} onDone={() => removeHeart(h.id)} />
              ))}

              {/* Dégradé bas */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)", pointerEvents: "none" }} />

              {/* Infos auteur + caption */}
              <div style={{ position: "absolute", left: 14, right: 80, bottom: "calc(90px + env(safe-area-inset-bottom,0px))", color: "#fff", zIndex: 2, pointerEvents: "none", maxHeight: "38vh", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div onClick={() => onUser?.(post.by)} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, cursor: "pointer", pointerEvents: "auto", width: "fit-content", flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{post.author?.fullName || post.author?.prenom || post.author?.name || ""}</span>
                  <Badge type={post.author?.badge} />
                </div>
                {caption.length > 0 && (
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.92)", textAlign: "left", wordBreak: "break-word", overflowWrap: "anywhere", maxHeight: isActive && expandedCaption ? "30vh" : "none", overflowY: isActive && expandedCaption ? "auto" : "visible", pointerEvents: isActive && expandedCaption ? "auto" : "none", paddingRight: 4 }}>
                    {isActive && expandedCaption ? caption : captionShort}
                    {caption.length > 120 && isActive && (
                      <span
                        onClick={() => setExpandedCaption(e => !e)}
                        style={{ color: "#C9952A", cursor: "pointer", marginLeft: 4, fontWeight: 600, pointerEvents: "auto" }}
                      >
                        {expandedCaption ? " moins" : " plus"}
                      </span>
                    )}
                  </p>
                )}
                {(myProfile?.badge === "confirmed" || myProfile?.badge === "friend") && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 4, pointerEvents: "none", flexShrink: 0 }}>
                    <Eye size={12} />{viewCounts[post.id] ?? 0}
                  </p>
                )}
                {post.sound?.title && (
                  <div style={{ marginTop: 8, pointerEvents: "auto", width: "fit-content" }} onClick={() => onOpenSound?.(post.sound.id)}>
                    <SoundBadge title={post.sound.title} playing={isActive} />
                  </div>
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
                  <button onClick={() => handleToggleLike(post)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }}>
                    <Heart size={32} fill={liked ? "#ff2d55" : "none"} color={liked ? "#ff2d55" : "#fff"} />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{likeCountMap[post.id] ?? (post.likes || []).length}</span>
                </div>

                {/* Commentaires */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <button
                    onClick={() => { setPhotoModalOpen(true); onOpenComments(post, () => setPhotoModalOpen(false)); }}
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

                {/* Menu "..." */}
                <button onClick={() => setMenuPostId(post.id)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, marginTop: 2 }}>
                  <MoreVertical size={26} />
                </button>

                {/* Disque du son (façon TikTok) */}
                {post.sound?.id && (
                  <SoundDiscBadge
                    avatarUrl={post.sound.owner_avatar}
                    playing={isActive}
                    onClick={() => onOpenSound?.(post.sound.id)}
                  />
                )}
              </div>

            </div>
          );
        })}
      </div>

      {menuPost && (
        <PostActionMenu
          isMine={menuPost.by === uid}
          isAdmin={!!myProfile?.is_admin}
          onClose={() => setMenuPostId(null)}
          onDelete={() => handleDeletePost(menuPost)}
          onReport={() => { setReportPost(menuPost); setMenuPostId(null); }}
          onMute={() => handleMuteAuthor(menuPost)}
        />
      )}

      {reportPost && (
        <PostReportSheet
          onClose={() => setReportPost(null)}
          onSubmit={handleSubmitReport}
        />
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
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