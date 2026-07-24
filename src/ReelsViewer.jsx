/**
 * ReelsViewer.jsx — Céleste
 * Composant Reels/TikTok isolé, extrait de App.jsx
 * Améliorations : double tap + cœur animé, bouton mute, preload n+1 propre,
 * wake lock pendant la lecture, commentaires qui ne coupent plus le reel,
 * menu "..." (supprimer / signaler / ne plus voir cette personne)
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, Heart, MessageCircle, Bookmark, Play, Volume2, VolumeX, MoreVertical, Trash2, Flag, EyeOff, ChevronLeft, Eye } from "lucide-react";
import { pauseOtherVideos, releaseActiveVideo } from "./videoRegistry";
import { useVideoEngagement } from "./lib/recommendation/useVideoEngagement";
import SoundBadge from "./components/SoundBadge";
import SoundDiscBadge from "./components/SoundDiscBadge";
// ── Utilitaires écran ─────────────────────────────────────────────
import { Capacitor } from "@capacitor/core";
import { PrivacyScreen } from "@capacitor-community/privacy-screen";
const isNative = Capacitor.isNativePlatform();
const enableScreenProtection  = async () => { if (!isNative) return; try { await PrivacyScreen.enable();  } catch (_) {} };
const disableScreenProtection = async () => { if (!isNative) return; try { await PrivacyScreen.disable(); } catch (_) {} };

// ── Raisons de signalement spécifiques à une publication ──────────
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

// ── Raisons de suppression admin (motif communiqué à l'auteur) ────
const ADMIN_DELETE_REASONS = ["Contenu inapproprié ou choquant","Nudité ou contenu sexuel","Violence ou contenu dangereux","Discours haineux ou discrimination","Harcèlement ou intimidation","Fausses informations","Spam ou publicité non désirée","Contenu protégé (droits d'auteur)","Contenu réutilisé d'une autre plateforme (filigrane visible)","Signalement non fondé mais retiré pour une autre raison","Autre"];

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
const BADGE_CLIP="path('M 14.93 10.87 C 13.57 10.73, 10.73 13.57, 10.87 14.93 C 10.01 13.87, 5.99 13.87, 5.13 14.93 C 5.27 13.57, 2.43 10.73, 1.07 10.87 C 2.13 10.01, 2.13 5.99, 1.07 5.13 C 2.43 5.27, 5.27 2.43, 5.13 1.07 C 5.99 2.13, 10.01 2.13, 10.87 1.07 C 10.73 2.43, 13.57 5.27, 14.93 5.13 C 13.87 5.99, 13.87 10.01, 14.93 10.87 Z')";
function Badge({ type }) {
  if (!type) return null;
  const isConfirmed = type === "confirmed";
  return isConfirmed ? (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,clipPath:BADGE_CLIP,WebkitClipPath:BADGE_CLIP,
      background:"linear-gradient(135deg,#1DA1F2,#0a85d9)",
      flexShrink:0,position:"relative"}}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  ) : (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,clipPath:BADGE_CLIP,WebkitClipPath:BADGE_CLIP,
      background:"linear-gradient(135deg,#FFD700,#FF8C00)",
      flexShrink:0}}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
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

// ── Feuille de signalement / motif (raisons + détails) ─────────────
function PostReportSheet({ onClose, onSubmit, reasons = POST_REPORT_REASONS, title = "Signaler la publication" }) {
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState("");
  const [pendingReason, setPendingReason] = useState(null);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 480, background: "rgba(18,18,18,0.98)", borderRadius: "22px 22px 0 0", padding: "20px 18px calc(24px + env(safe-area-inset-bottom,0px))", animation: "slideUp .25s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{title}</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={15} /></button>
        </div>
        {!showDetails ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: "55vh", overflowY: "auto" }}>
            {reasons.map(r => (
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
              {reasons.map(r => (
                <button key={r} onClick={() => setPendingReason(r)} style={{ padding: "11px 14px", borderRadius: 12, border: `1px solid ${pendingReason === r ? "#C9952A88" : "rgba(255,255,255,0.1)"}`, background: pendingReason === r ? "rgba(201,149,42,0.12)" : "transparent", color: pendingReason === r ? "#e0b84a" : "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "left", cursor: "pointer" }}>
                  {r}
                </button>
              ))}
            </div>
            <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Détails" rows={2}
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontSize: 13, outline: "none", resize: "none", marginBottom: 12 }} />
            <button onClick={() => pendingReason && onSubmit(pendingReason, details)} disabled={!pendingReason}
              style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: pendingReason ? "linear-gradient(135deg,#e0b84a,#C9952A)" : "rgba(255,255,255,0.08)", color: pendingReason ? "#000" : "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 700, cursor: pendingReason ? "pointer" : "default" }}>
              {title === "Motif de suppression" ? "Supprimer avec ce motif" : "Envoyer le signalement"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────
export default function ReelsViewer({
  posts,
  sb,
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
  onOpenSound,
}) {
  const [activeIdx,       setActiveIdx]       = useState(startIndex);
  const [pausedMap,       setPausedMap]       = useState({});
  const [loadingMap,      setLoadingMap]      = useState({});
  const [progressMap,     setProgressMap]     = useState({});
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [showControls,    setShowControls]    = useState(false);
  const [muted,           setMuted]           = useState(false);
  const [reelsModalOpen,  setReelsModalOpen]  = useState(false);
  const [hiddenPostIds,   setHiddenPostIds]   = useState(() => new Set());
  const [menuPostId,      setMenuPostId]      = useState(null);
  const [reportPost,      setReportPost]      = useState(null);
  const [deleteReasonPost, setDeleteReasonPost] = useState(null);
  const [viewCounts, setViewCounts] = useState({});
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
  const wakeLockRef  = useRef(null);

  const uid = session?.user?.id;
  const engagement = useVideoEngagement(sb, uid);

  // Liste réellement affichée : on retire ce qui vient d'être supprimé/masqué
  const displayPosts = useMemo(
    () => (posts || []).filter(p => !hiddenPostIds.has(p.id)),
    [posts, hiddenPostIds]
  );

  // Si la liste affichée se vide ou rétrécit sous l'index courant, on s'ajuste
  useEffect(() => {
    if (displayPosts.length === 0) { onClose?.(); return; }
    if (activeIdx >= displayPosts.length) setActiveIdx(displayPosts.length - 1);
  }, [displayPosts.length]);

  // ── Empêche l'écran de s'éteindre pendant la lecture ─────────
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => { wakeLockRef.current = null; });
      }
    } catch (_) { /* refusé (batterie faible, etc.) — pas grave */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; }
  }, []);
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

  // ── Scroll initial ────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: startIndex * window.innerHeight, behavior: "auto" });
  }, []);

  // ── IntersectionObserver scroll snap ─────────────────────────
  useEffect(() => {
    let debounceTimer = null;
    const observer = new IntersectionObserver(
      entries => {
        // On ne retient que l'entrée la PLUS visible du lot, avec un petit
        // débounce — évite les faux positifs quand deux slides sont
        // brièvement visibles en même temps (scroll saccadé sur connexion lente)
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

  // ── Gestion lecture / pause / preload ─────────────────────────
  useEffect(() => {
    const active = videoRefs.current[activeIdx];
    if (active) {
      active.muted = muted;
      pauseOtherVideos(active);
      active.play().catch(() => {});
      setPausedMap(p => ({ ...p, [activeIdx]: false }));
      requestWakeLock();
      const post = displayPosts[activeIdx];
      if (post) engagement.start(post.id, (active.duration || 0) * 1000);
    }

    // Pause + libère les vidéos lointaines
    Object.entries(videoRefs.current).forEach(([i, v]) => {
      if (!v) return;
      const n = Number(i);
      if (n !== activeIdx) {
        v.pause();
        v.currentTime = 0;
        releaseActiveVideo(v);
        if (Math.abs(n - activeIdx) > 2) v.src = "";
      }
    });

    // Preload n+1
    const next = videoRefs.current[activeIdx + 1];
    if (next && next.readyState < 3) next.load();
  }, [activeIdx]);

  // Ouverture/fermeture des commentaires : le reel ne doit NI se mettre en
  // pause, NI redémarrer à zéro — il continue exactement où il en était.
  useEffect(() => {
    const active = videoRefs.current[activeIdx];
    if (!active) return;
    if (!reelsModalOpen && !pausedMap[activeIdx]) {
      pauseOtherVideos(active);
      active.play().catch(() => {});
      requestWakeLock();
    }
  }, [reelsModalOpen]);

  // ── Sync mute sur toutes les vidéos ──────────────────────────
  useEffect(() => {
    Object.values(videoRefs.current).forEach(v => { if (v) v.muted = muted; });
  }, [muted]);

  // ── Protection écran ─────────────────────────────────────────
  useEffect(() => {
    const post = displayPosts[activeIdx];
    if (post?.author?.screenshot_protection) enableScreenProtection();
    else disableScreenProtection();
    return () => disableScreenProtection();
  }, [activeIdx, displayPosts]);

  // ── Nettoyage à la fermeture ──────────────────────────────────
  useEffect(() => () => {
    Object.values(videoRefs.current).forEach(v => { if (v) { v.pause(); releaseActiveVideo(v); v.src = ""; } });
    releaseWakeLock();
  }, []);

  // ── Toggle pause ─────────────────────────────────────────────
  const togglePause = useCallback((idx) => {
    const v = videoRefs.current[idx];
    if (!v) return;
    if (v.paused) { pauseOtherVideos(v); v.play().catch(() => {}); setPausedMap(p => ({ ...p, [idx]: false })); requestWakeLock(); }
    else          { v.pause(); releaseActiveVideo(v); setPausedMap(p => ({ ...p, [idx]: true  })); releaseWakeLock(); }
  }, [requestWakeLock, releaseWakeLock]);

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
    clearTimeout(window[`_tap_${idx}`]);
    if (now - last < 320) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++heartIdRef.current;
      setHearts(h => [...h, { id, x, y }]);
      const liked = (post.likes || []).some(l => (l.user_id || l) === uid);
      if (!liked) { toggleLike(post.id); engagement.markLiked(myProfile?.is_admin); }
    } else {
      window[`_tap_${idx}`] = setTimeout(() => togglePause(idx), 320);
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

  // ── Supprimer / signaler / masquer ────────────────────────────
  const handleDeletePost = useCallback(async (post) => {
    setMenuPostId(null);
    const byAdmin = myProfile?.is_admin && post.by !== uid;
    if (byAdmin) { setDeleteReasonPost(post); return; }
    if (!window.confirm("Supprimer cette publication ?")) return;
    setHiddenPostIds(p => new Set([...p, post.id]));
    notify?.("Publication supprimée");
    await sb.from("posts").delete().eq("id", post.id).eq("author_id", uid);
  }, [uid, myProfile, notify]);

  const handleAdminDeleteWithReason = useCallback(async (reason) => {
    const post = deleteReasonPost;
    if (!post) return;
    setDeleteReasonPost(null);
    setHiddenPostIds(p => new Set([...p, post.id]));
    notify?.("Publication supprimée");
    await sb.from("posts").delete().eq("id", post.id);
    await sb.from("notifications").insert({ user_id: post.by, from_id: uid, type: "post_deleted", text: `Ta publication a été supprimée par un administrateur (motif : ${reason})`, read: false });
  }, [uid, deleteReasonPost, notify]);

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
  }, [uid, reportPost, notify]);

  const menuPost = displayPosts.find(p => p.id === menuPostId) || null;

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
        {displayPosts.map((post, idx) => {
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
          const isLocked    = post.is_private && !isNative && !isMe;

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
              {isLocked ? (
                <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,color:"#fff",padding:20,textAlign:"center"}}>
                  <div style={{width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center"}}>🔒</div>
                  <p style={{margin:0,fontSize:15,fontWeight:700}}>Contenu privé</p>
                  <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.6)",maxWidth:240}}>Disponible uniquement dans l'application Céleste sur Android.</p>
                </div>
              ) : nearActive && rawVideoSrc && (
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
                  onCanPlay={() => {
                    setLoadingMap(p => ({ ...p, [idx]: false }));
                    if (idx === activeIdx && !pausedMap[idx]) videoRefs.current[idx]?.play().catch(() => {});
                  }}
                  onPlaying={() => setLoadingMap(p => ({ ...p, [idx]: false }))}
                  onTimeUpdate={e => {
                    const v = e.target;
                    if (v.duration) setProgressMap(p => ({ ...p, [idx]: (v.currentTime / v.duration) * 100 }));
                    if (idx === activeIdx) engagement.tick(v.currentTime * 1000);
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
                {(myProfile?.badge === "confirmed" || myProfile?.badge === "friend") && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Eye size={12} />{viewCounts[post.id] ?? 0}
                  </p>
                )}
                {post.sound?.title && (
                  <div style={{ marginTop: 8 }} onClick={() => onOpenSound?.(post.sound.id)}>
                    <SoundBadge title={post.sound.title} playing={isActive && !pausedMap[idx]} />
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
                  <button onClick={() => { toggleLike(post.id); if (!liked) engagement.markLiked(); }} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))" }}>
                    <Heart size={32} fill={liked ? "#ff2d55" : "none"} color={liked ? "#ff2d55" : "#fff"} />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{(post.likes || []).length}</span>
                </div>

                {/* Commentaires */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <button
                    onClick={() => { setReelsModalOpen(true); onOpenComments(post, () => setReelsModalOpen(false)); }}
                    style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))" }}
                  >
                    <MessageCircle size={30} color="#fff" />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{(post.comments || []).length}</span>
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
                    style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))" }}
                  >
                    <Bookmark size={28} fill={savedIds.has(post.id) ? "#C9952A" : "none"} color={savedIds.has(post.id) ? "#C9952A" : "#fff"} />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{saveCountMap[post.id] ?? post.savesCount ?? 0}</span>
                </div>

                {/* Menu "..." */}
                <button onClick={() => setMenuPostId(post.id)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, marginTop: 2, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))" }}>
                  <MoreVertical size={26} />
                </button>

                {/* Disque du son (façon TikTok) */}
                {post.sound?.id && (
                  <SoundDiscBadge
                    avatarUrl={post.sound.owner_avatar}
                    playing={isActive && !pausedMap[idx]}
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

      {deleteReasonPost && (
        <PostReportSheet
          title="Motif de suppression"
          reasons={ADMIN_DELETE_REASONS}
          onClose={() => setDeleteReasonPost(null)}
          onSubmit={handleAdminDeleteWithReason}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
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