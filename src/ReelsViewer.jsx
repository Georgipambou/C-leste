/**
 * ReelsViewer.jsx — Céleste
 * Composant Reels/TikTok isolé, extrait de App.jsx
 * Améliorations : double tap + cœur animé, bouton mute, preload n+1 propre,
 * wake lock pendant la lecture, commentaires qui ne coupent plus le reel,
 * menu "..." (supprimer / signaler / ne plus voir cette personne)
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, Heart, MessageCircle, Bookmark, Play, Volume2, VolumeX, MoreVertical, Trash2, Flag, EyeOff, ChevronLeft, Eye, Check, Share2, Sparkles } from "lucide-react";
import SharePostModal from "./SharePostModal";
import { pauseOtherVideos, releaseActiveVideo } from "./videoRegistry";
import { useVideoEngagement } from "./lib/recommendation/useVideoEngagement";
import SoundBadge from "./components/SoundBadge";
import SoundDiscBadge from "./components/SoundDiscBadge";
import { DuoBadge } from "./Duo";
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

// ── Cache vidéo session (LRU borné pour éviter la fuite mémoire sur
// les appareils avec peu de RAM — un blobUrl reste décodé en mémoire
// tant qu'il n'est pas révoqué, donc on limite combien on en garde) ──
const _vBlobMap = new Map(); // url -> blobUrl, ordre = ordre d'utilisation (plus récent en fin de Map)
const V_BLOB_CACHE_MAX = 20; // largement au-dessus du nombre de vidéos réellement montées en même temps
async function getCachedVideoSrc(url) {
  if (!url) return url;
  if (_vBlobMap.has(url)) {
    // Déjà en cache : on la marque comme récemment utilisée pour la
    // protéger de l'éviction tant qu'elle reste consultée (ex: vidéo
    // encore proche de l'index actif pendant le scroll).
    const existing = _vBlobMap.get(url);
    _vBlobMap.delete(url);
    _vBlobMap.set(url, existing);
    return existing;
  }
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
    // Évince les entrées les plus anciennes au-delà de la limite et
    // libère leur mémoire — sans danger pour les vidéos encore à
    // l'écran, qui repassent par la branche "déjà en cache" ci-dessus
    // à chaque fois qu'elles redeviennent proches de l'index actif.
    while (_vBlobMap.size > V_BLOB_CACHE_MAX) {
      const oldestUrl = _vBlobMap.keys().next().value;
      const oldestBlobUrl = _vBlobMap.get(oldestUrl);
      _vBlobMap.delete(oldestUrl);
      try { URL.revokeObjectURL(oldestBlobUrl); } catch (_) {}
    }
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
const BADGE_CLIP="path('M 18.66 13.59 C 16.96 13.41, 13.41 16.96, 13.59 18.66 C 12.51 17.34, 7.49 17.34, 6.41 18.66 C 6.59 16.96, 3.04 13.41, 1.34 13.59 C 2.66 12.51, 2.66 7.49, 1.34 6.41 C 3.04 6.59, 6.59 3.04, 6.41 1.34 C 7.49 2.66, 12.51 2.66, 13.59 1.34 C 13.41 3.04, 16.96 6.59, 18.66 6.41 C 17.34 7.49, 17.34 12.51, 18.66 13.59 Z')";
function Badge({ type }) {
  if (!type) return null;
  const isConfirmed = type === "confirmed";
  return isConfirmed ? (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,clipPath:BADGE_CLIP,WebkitClipPath:BADGE_CLIP,
      background:"linear-gradient(135deg,#1DA1F2,#0a85d9)",
      flexShrink:0,position:"relative",filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.9))"}}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  ) : (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,clipPath:BADGE_CLIP,WebkitClipPath:BADGE_CLIP,
      background:"linear-gradient(135deg,#FFD700,#FF8C00)",
      flexShrink:0,filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.9))"}}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
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
  onNeedMore,
  hasMore,
  loadingMore,
  T,
  Av,
}) {
  const [activeIdx,       setActiveIdx]       = useState(startIndex);
  const [pausedMap,       setPausedMap]       = useState({});
  const [loadingMap,      setLoadingMap]      = useState({});
  const [progressMap,     setProgressMap]     = useState({});
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [showControls,    setShowControls]    = useState(false);
  const [muted,           setMuted]           = useState(true);
  const [reelsModalOpen,  setReelsModalOpen]  = useState(false);
  const [hiddenPostIds,   setHiddenPostIds]   = useState(() => new Set());
  const [menuPostId,      setMenuPostId]      = useState(null);
  const [shareModalPostId, setShareModalPostId] = useState(null);
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
  const [connectAnimId, setConnectAnimId] = useState(null); // id de l'auteur en cours d'animation "connecté"

  const [likeFillMap, setLikeFillMap] = useState({});
  const [likeBurstMap, setLikeBurstMap] = useState({});
  const [reactOpenIdx, setReactOpenIdx] = useState(null);
  const [reactDir, setReactDir] = useState(null);
  const [commentBumpMap, setCommentBumpMap] = useState({});
  const [commentCountOverrideMap, setCommentCountOverrideMap] = useState({});
  const likeHoldStartRef = useRef(null);
  const likeHoldFrameRef = useRef(null);
  const likeBurstFiredRef = useRef(false);
  const likeHalfFiredRef = useRef(false);
  const reactStartRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const lastReactDirRef = useRef(null);
  const LIKE_HOLD_MS = 900;
  const quickReactions = [
    { key: "up",    dx: 0,  dy: -1, emoji: "👏", text: "👏 Bravo, superbe !" },
    { key: "down",  dx: 0,  dy: 1,  emoji: "🙏", text: "🙏 Merci pour ce partage" },
    { key: "left",  dx: -1, dy: 0,  emoji: "✨", text: "✨ J'ai adoré !" },
    { key: "right", dx: 1,  dy: 0,  emoji: "😲", text: "😲 Waouh, incroyable !" },
  ];
  const haptic = pattern => { try { navigator.vibrate && navigator.vibrate(pattern); } catch (_) {} };
  const [speedMap, setSpeedMap] = useState({});
  const speedHoldTimerRef = useRef(null);
  const speedActiveRef = useRef(false);

  // ── Mode session : jongle entre les 3 derniers centres d'intérêt likés ──
  const [orderedPosts, setOrderedPosts] = useState(() => posts || []);
  const [interestBoost, setInterestBoost] = useState([]); // [{category,weight}] — plus récent en premier, fenêtre de 3
  const activeIdxRef = useRef(startIndex);

  const containerRef = useRef(null);
  const videoRefs    = useRef({});
  const itemRefs     = useRef({});
  const lastTapRef   = useRef({});   // {idx: timestamp}
  const heartIdRef   = useRef(0);
  const wakeLockRef  = useRef(null);
  const tapTimersRef = useRef({});
  const controlsTimerRef = useRef(null);

  const uid = session?.user?.id;
  const engagement = useVideoEngagement(sb, uid);

  // Liste réellement affichée : on retire ce qui vient d'être supprimé/masqué
  const displayPosts = useMemo(
    () => (orderedPosts || []).filter(p => !hiddenPostIds.has(p.id)),
    [orderedPosts, hiddenPostIds]
  );

  // ── Carrousel multi-vidéos par post ─────────────────────────────
  const [mediaIdxMap, setMediaIdxMap] = useState({}); // {idx: sous-index vidéo actif}
  const swipeStartRef = useRef({}); // {idx: {x,y}}
  const videosByPost = useMemo(() => {
    const m = {};
    (displayPosts || []).forEach(p => {
      const all = p.media_urls?.length > 0 ? p.media_urls : (p.img ? [p.img] : []);
      const vids = all.filter(u => (u || "").match(/\.(mp4|mov|webm)/i));
      m[p.id] = vids.length > 0 ? vids : (p.img ? [p.img] : []);
    });
    return m;
  }, [displayPosts]);

  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

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

  // ── Scroll initial + re-synchronisation quand le parent envoie un
  // nouveau point de départ (ex: navigation depuis la modale d'un son) ──
  useEffect(() => {
    setActiveIdx(startIndex);
    setOrderedPosts(posts || []);
    // Seed le mode session avec les catégories de la vidéo tappée elle-même :
    // ouvrir un Reel depuis un post de cuisine doit tout de suite faire
    // remonter les autres vidéos de cuisine dans la suite, sans attendre un like.
    setInterestBoost((posts && posts[startIndex]?.categories) || []);
    const el = containerRef.current;
    if (el) el.scrollTo({ top: startIndex * window.innerHeight, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex]);

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
    const thisIdx = activeIdx;
    if (active) {
      active.muted = muted;
      pauseOtherVideos(active);
      active.play().then(() => {
        // Sécurité anti-son-fantôme : si l'utilisateur a déjà swipé vers un
        // autre Reel au moment où play() se résout, on coupe immédiatement.
        if (activeIdxRef.current !== thisIdx) active.pause();
        else setPausedMap(p => ({ ...p, [thisIdx]: false }));
      }).catch(() => {
        // Autoplay refusé par la plateforme (fréquent en natif hors geste
        // utilisateur direct) : on reflète l'état réel au lieu de forcer "ça joue".
        if (activeIdxRef.current === thisIdx) setPausedMap(p => ({ ...p, [thisIdx]: true }));
      });
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
      const thisIdx = activeIdx;
      active.play().catch(() => {
        setPausedMap(p => ({ ...p, [thisIdx]: true }));
      });
      requestWakeLock();
    }
  }, [reelsModalOpen]);

  // ── Sync mute sur toutes les vidéos ──────────────────────────
  useEffect(() => {
    Object.values(videoRefs.current).forEach(v => { if (v) v.muted = muted; });
  }, [muted]);

  // ── Préchargement en arrière-plan des autres vidéos du carrousel
  // du post actif (pas de <video> montée, juste le cache réchauffé
  // via getCachedVideoSrc — même mécanisme que le préload inter-post) ──
  useEffect(() => {
    const post = displayPosts[activeIdx];
    if (!post) return;
    const urls = videosByPost[post.id] || [];
    if (urls.length <= 1) return;
    const cur = mediaIdxMap[activeIdx] || 0;
    [cur - 1, cur + 1].forEach(i => {
      const u = urls[i];
      if (u) getCachedVideoSrc(u);
    });
  }, [activeIdx, mediaIdxMap, videosByPost, displayPosts]);

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
    Object.values(tapTimersRef.current).forEach(t => clearTimeout(t));
    clearTimeout(controlsTimerRef.current);
    releaseWakeLock();
  }, []);
  // ── Enregistre l'intérêt suite à un like, et fait "jongler" la suite
  // de la file en conséquence — seule la partie PAS ENCORE VUE bouge ──
  const registerLikeInterest = useCallback((post) => {
    const cats = post.categories || [];
    if (!cats.length) return;
    setInterestBoost(prev => {
      const withoutDup = prev.filter(c => !cats.some(nc => nc.category === c.category));
      return [...cats, ...withoutDup].slice(0, 3);
    });
  }, []);

  useEffect(() => {
    if (!interestBoost.length) return;
    setOrderedPosts(prev => {
      const cut = activeIdxRef.current + 1;
      const frozen = prev.slice(0, cut); // déjà scrollé → on n'y touche jamais
      const future = prev.slice(cut);
      if (future.length < 2) return prev;

      const relatedness = (p) => {
        const postCats = p.categories || [];
        if (!postCats.length) return 0;
        let score = 0;
        interestBoost.forEach((ic, i) => {
          const match = postCats.find(pc => pc.category === ic.category);
          if (match) score += (ic.weight || 1) * (match.weight || 1) * (interestBoost.length - i);
        });
        return score;
      };

      const related = future.filter(p => relatedness(p) > 0).sort((a, b) => relatedness(b) - relatedness(a));
      const other = future.filter(p => relatedness(p) === 0);
      const rebuilt = [];
      let ri = 0, oi = 0;
      while (ri < related.length || oi < other.length) {
        if (ri < related.length) rebuilt.push(related[ri++]);
        if (ri < related.length) rebuilt.push(related[ri++]);
        if (oi < other.length) rebuilt.push(other[oi++]);
      }
      return [...frozen, ...rebuilt];
    });
  }, [interestBoost]);
  // ── Fusionne les nouvelles vidéos ramenées par onNeedMore() dans la file,
  // en les répartissant : liées aux intérêts récents / autres catégories /
  // posts sans catégorie — jamais 100% une seule catégorie en boucle ──
  useEffect(() => {
    setOrderedPosts(prev => {
      const byId = new Map((posts || []).map(p => [p.id, p]));
      // Rafraîchit les champs mutables des posts déjà présents SANS changer
      // leur position ni leurs catégories — sinon un like posé ici ne se
      // reflète jamais (le cœur ne se remplit pas côté UI).
      const refreshed = prev.map(p => {
        const latest = byId.get(p.id);
        return latest ? { ...p, likes: latest.likes, comments: latest.comments, saved: latest.saved, savesCount: latest.savesCount } : p;
      });

      const existingIds = new Set(prev.map(p => p.id));
      const fresh = (posts || []).filter(p => !existingIds.has(p.id));
      if (!fresh.length) return refreshed;

      const refCats = interestBoost.length ? interestBoost : (refreshed[0]?.categories || []);
      const relatedness = (p) => {
        const postCats = p.categories || [];
        if (!postCats.length || !refCats.length) return 0;
        let score = 0;
        refCats.forEach((rc, i) => {
          const match = postCats.find(pc => pc.category === rc.category);
          if (match) score += (rc.weight || 1) * (match.weight || 1) * (refCats.length - i);
        });
        return score;
      };

      // "other" regroupe volontairement deux cas : catégorie différente ET
      // post sans catégorie du tout — c'est ce qui garde de la diversité.
      const related = fresh.filter(p => relatedness(p) > 0).sort((a, b) => relatedness(b) - relatedness(a));
      const other = fresh.filter(p => relatedness(p) === 0);
      const merged = [];
      let ri = 0, oi = 0;
      while (ri < related.length || oi < other.length) {
        if (ri < related.length) merged.push(related[ri++]);
        if (ri < related.length) merged.push(related[ri++]);
        if (oi < other.length) merged.push(other[oi++]);
      }
      return [...refreshed, ...merged];
    });
  }, [posts]);

  // ── Déclenche onNeedMore() quand il ne reste plus que ~4 vidéos devant ──
  const fetchingMoreRef = useRef(false);
  useEffect(() => {
    if (!loadingMore) fetchingMoreRef.current = false;
  }, [loadingMore]);

  useEffect(() => {
    const remaining = displayPosts.length - 1 - activeIdx;
    if (remaining <= 4 && hasMore && !loadingMore && !fetchingMoreRef.current) {
      fetchingMoreRef.current = true;
      onNeedMore?.();
    }
  }, [activeIdx, displayPosts.length, hasMore, loadingMore]);

  // ── Toggle pause ─────────────────────────────────────────────
  const togglePause = useCallback((idx) => {
    const v = videoRefs.current[idx];
    if (!v) return;
    if (v.paused) { pauseOtherVideos(v); v.play().catch(() => {}); setPausedMap(p => ({ ...p, [idx]: false })); requestWakeLock(); }
    else          { v.pause(); releaseActiveVideo(v); setPausedMap(p => ({ ...p, [idx]: true  })); releaseWakeLock(); }
  }, [requestWakeLock, releaseWakeLock]);

  // ── Seek via progress bar ─────────────────────────────────────
  const seekVideo = useCallback((idx, clientX, rect) => {
    const v = videoRefs.current[idx];
    if (!v || !v.duration) return;
    v.currentTime = Math.max(0, Math.min(v.duration, ((clientX - rect.left) / rect.width) * v.duration));
  }, []);

  // ── Swipe horizontal = changer de vidéo dans le carrousel du post ──
  const startMediaSwipe = useCallback((idx, e) => {
    const t = e.touches ? e.touches[0] : e;
    swipeStartRef.current[idx] = { x: t.clientX, y: t.clientY };
  }, []);

  const endMediaSwipe = useCallback((idx, post, e) => {
    const start = swipeStartRef.current[idx];
    swipeStartRef.current[idx] = null;
    if (!start) return;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return; // pas un swipe horizontal net
    const urls = videosByPost[post.id] || [];
    if (urls.length <= 1) return;
    const cur = mediaIdxMap[idx] || 0;
    const next = Math.max(0, Math.min(urls.length - 1, cur + (dx < 0 ? 1 : -1)));
    if (next !== cur) { haptic("light"); setMediaIdxMap(p => ({ ...p, [idx]: next })); }
  }, [videosByPost, mediaIdxMap]);

  // ── Double tap → like + cœur flottant ────────────────────────
  const handleTap = useCallback((idx, post, e) => {
    const now  = Date.now();
    const last = lastTapRef.current[idx] || 0;
    clearTimeout(tapTimersRef.current[idx]);
    if (now - last < 320) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++heartIdRef.current;
      setHearts(h => [...h, { id, x, y }]);
      const liked = (post.likes || []).some(l => (l.user_id || l) === uid);
      if (!liked) { toggleLike(post.id); engagement.markLiked(myProfile?.is_admin); registerLikeInterest(post); }
    } else {
      tapTimersRef.current[idx] = setTimeout(() => togglePause(idx), 320);
    }
    lastTapRef.current[idx] = now;
  }, [toggleLike, togglePause, uid]);

  const removeHeart = useCallback((id) => {
    setHearts(h => h.filter(hh => hh.id !== id));
  }, []);

  const startLikeHold = useCallback((idx, post) => {
    const liked = (post.likes || []).some(l => (l.user_id || l) === uid);
    if (liked) return;
    likeBurstFiredRef.current = false;
    likeHalfFiredRef.current = false;
    haptic("light");
    likeHoldStartRef.current = performance.now();
    const tick = () => {
      if (!likeHoldStartRef.current) return;
      const elapsed = performance.now() - likeHoldStartRef.current;
      const pct = Math.min(100, (elapsed / LIKE_HOLD_MS) * 100);
      setLikeFillMap(p => ({ ...p, [idx]: pct }));
      if (pct >= 50 && !likeHalfFiredRef.current) { likeHalfFiredRef.current = true; haptic("medium"); }
      if (pct >= 100) {
        likeBurstFiredRef.current = true;
        setLikeBurstMap(p => ({ ...p, [idx]: true }));
        haptic("heavy");
        toggleLike(post.id); engagement.markLiked(); registerLikeInterest(post);
        likeHoldStartRef.current = null;
        setTimeout(() => { setLikeBurstMap(p => ({ ...p, [idx]: false })); setLikeFillMap(p => ({ ...p, [idx]: 0 })); }, 650);
        return;
      }
      likeHoldFrameRef.current = requestAnimationFrame(tick);
    };
    likeHoldFrameRef.current = requestAnimationFrame(tick);
  }, [uid, toggleLike, registerLikeInterest]);

  const endLikeHold = useCallback((idx, post) => {
    cancelAnimationFrame(likeHoldFrameRef.current);
    if (likeBurstFiredRef.current) { likeBurstFiredRef.current = false; return; }
    const held = likeHoldStartRef.current ? performance.now() - likeHoldStartRef.current : 0;
    setLikeFillMap(p => ({ ...p, [idx]: 0 }));
    likeHoldStartRef.current = null;
    const liked = (post.likes || []).some(l => (l.user_id || l) === uid);
    haptic("light");
    toggleLike(post.id);
    if (!liked) { engagement.markLiked(); registerLikeInterest(post); }
  }, [uid, toggleLike, registerLikeInterest]);

  const cancelLikeHold = useCallback((idx) => {
    cancelAnimationFrame(likeHoldFrameRef.current);
    likeBurstFiredRef.current = false;
    setLikeFillMap(p => ({ ...p, [idx]: 0 }));
    likeHoldStartRef.current = null;
  }, []);

  const sendQuickComment = useCallback(async (post, text) => {
    if (!uid) return;
    const { error } = await sb.from("comments").insert({ post_id: post.id, author_id: uid, text });
    if (!error) setCommentBumpMap(p => ({ ...p, [post.id]: (p[post.id] || 0) + 1 }));
  }, [uid]);

  const startLongPress = useCallback((idx, e) => {
    reactStartRef.current = { x: e.clientX, y: e.clientY };
    lastReactDirRef.current = null;
    longPressTimerRef.current = setTimeout(() => { setReactOpenIdx(idx); setReactDir(null); haptic("light"); }, 380);
  }, []);

  const moveLongPress = useCallback((idx, e) => {
    if (reactOpenIdx !== idx || !reactStartRef.current) return;
    const dx = e.clientX - reactStartRef.current.x;
    const dy = e.clientY - reactStartRef.current.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) {
      if (lastReactDirRef.current) { lastReactDirRef.current = null; setReactDir(null); }
      return;
    }
    const angle = Math.atan2(dy, dx);
    let dir;
    if (angle > -Math.PI / 4 && angle <= Math.PI / 4) dir = "right";
    else if (angle > Math.PI / 4 && angle <= 3 * Math.PI / 4) dir = "down";
    else if (angle > -3 * Math.PI / 4 && angle <= -Math.PI / 4) dir = "up";
    else dir = "left";
    if (dir !== reactDir) haptic("light");
    lastReactDirRef.current = dir;
    setReactDir(dir);
  }, [reactOpenIdx, reactDir]);

  const endLongPress = useCallback((idx, post) => {
    clearTimeout(longPressTimerRef.current);
    if (reactOpenIdx === idx && reactDir) {
      const choice = quickReactions.find(q => q.key === reactDir);
      if (choice) { sendQuickComment(post, choice.text); haptic("medium"); }
    }
    setReactOpenIdx(null); setReactDir(null); reactStartRef.current = null; lastReactDirRef.current = null;
  }, [reactOpenIdx, reactDir, sendQuickComment]);

  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimerRef.current);
  }, []);

  // ── Maintien sur le coin droit de la vidéo = lecture x2 ─────────
  const startSpeedHold = useCallback((idx) => {
    speedHoldTimerRef.current = setTimeout(() => {
      speedActiveRef.current = true;
      const v = videoRefs.current[idx];
      if (v) v.playbackRate = 2;
      setSpeedMap(p => ({ ...p, [idx]: true }));
      haptic("light");
    }, 150);
  }, []);

  const endSpeedHold = useCallback((idx, post, e) => {
    clearTimeout(speedHoldTimerRef.current);
    if (speedActiveRef.current) {
      speedActiveRef.current = false;
      const v = videoRefs.current[idx];
      if (v) v.playbackRate = 1;
      setSpeedMap(p => ({ ...p, [idx]: false }));
    } else if (e) {
      handleTap(idx, post, e);
    }
  }, [handleTap]);

  const handleConnectClick = useCallback((userId) => {
    onConnect?.(userId);
    setConnectAnimId(userId);
    setTimeout(() => setConnectAnimId(prev => (prev === userId ? null : prev)), 900);
  }, [onConnect]);

  // ── Affiche les contrôles 2,5s au touch ──────────────────────
  const showCtrl = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 2500);
  }, []);

  // ── Supprimer / signaler / masquer ────────────────────────────
  const handleDeletePost = useCallback(async (post) => {
    setMenuPostId(null);
    const byAdmin = myProfile?.is_admin && post.by !== uid;
    if (byAdmin) { setDeleteReasonPost(post); return; }
    if (!(await confirmAction("Supprimer cette publication ?", { confirmLabel: "Supprimer" }))) return;
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
  const shareModalPost = displayPosts.find(p => p.id === shareModalPostId) || null;

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
          const videoUrls   = videosByPost[post.id] || [];
          const curMediaIdx = Math.min(mediaIdxMap[idx] || 0, Math.max(0, videoUrls.length - 1));
          const rawVideoSrc = videoUrls[curMediaIdx] || post.img;
          const caption     = post.text || "";
          const captionShort = caption.length > 120 ? caption.slice(0, 120) + "..." : caption;
          const isActive    = idx === activeIdx;
          const isPaused    = pausedMap[idx]  || false;
          const isLoading   = loadingMap[idx] || false;
          const progress    = progressMap[idx] || 0;
          const isConnected = myConnections?.includes(post.by);
          const isMe        = post.by === uid;
          const isLocked    = post.is_private && !isNative && !isMe;
          const hasMarketplace = post.is_for_sale && (post.whatsapp_contact || post.contact_link);

          return (
            <div
              key={post.id}
              ref={el => itemRefs.current[idx] = el}
              data-idx={idx}
              style={{
                height: "100vh", width: "100%",
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#000", flexShrink: 0, overflow: "hidden",
              }}
              onTouchStart={e => { showCtrl(); startMediaSwipe(idx, e); }}
              onTouchEnd={e => endMediaSwipe(idx, post, e)}
              onMouseMove={showCtrl}
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
                    const v = videoRefs.current[idx];
                    if (idx === activeIdx && !pausedMap[idx] && v) {
                      pauseOtherVideos(v);
                      v.play().catch(() => {
                        setPausedMap(p => ({ ...p, [idx]: true }));
                      });
                    }
                  }}
                  onPlaying={() => setLoadingMap(p => ({ ...p, [idx]: false }))}
                  onTimeUpdate={e => {
                    const v = e.target;
                    if (v.duration) setProgressMap(p => ({ ...p, [idx]: (v.currentTime / v.duration) * 100 }));
                    if (idx === activeIdx) engagement.tick(v.currentTime * 1000);
                  }}
                />
              )}

              {/* Points du carrousel (plusieurs vidéos dans ce post) */}
              {videoUrls.length > 1 && (
                <div style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top,0px) + 46px)", left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4, zIndex: 4, pointerEvents: "none" }}>
                  {videoUrls.map((_, vIdx) => (
                    <div key={vIdx} style={{ width: vIdx === curMediaIdx ? 16 : 6, height: 6, borderRadius: 3, background: vIdx === curMediaIdx ? "#C9952A" : "rgba(255,255,255,0.4)", transition: "width .2s" }} />
                  ))}
                </div>
              )}

              {/* Zone maintien coin droit = vitesse x2 */}
              {nearActive && rawVideoSrc && (
                <div
                  onPointerDown={e => { e.stopPropagation(); startSpeedHold(idx); }}
                  onPointerUp={e => { e.stopPropagation(); endSpeedHold(idx, post, e); }}
                  onPointerLeave={() => endSpeedHold(idx, post, null)}
                  style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 70, zIndex: 1, touchAction: "none" }}
                />
              )}
              {speedMap[idx] && (
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 6, background: "rgba(0,0,0,0.55)", borderRadius: 20, padding: "8px 16px", color: "#fff", fontWeight: 700, fontSize: 14, pointerEvents: "none" }}>
                  ⏩ Vitesse x2
                </div>
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
                onTouchStart={e => { showCtrl(); seekVideo(idx, e.touches[0].clientX, e.currentTarget.getBoundingClientRect()); }}
                onTouchMove={e => seekVideo(idx, e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
                onClick={e => seekVideo(idx, e.clientX, e.currentTarget.getBoundingClientRect())}
                style={{
                  position: "absolute",
                  bottom: "calc(env(safe-area-inset-bottom,0px) + 46px)",
                  left: 0, right: 0, height: 28,
                  display: "flex", alignItems: "center",
                  zIndex: 5, cursor: "pointer",
                  opacity: showControls ? 1 : 0,
                  transition: "opacity 0.3s ease",
                }}
              >
                <div style={{ height: 3, width: "100%", background: "rgba(255,255,255,0.25)", borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "rgba(255,255,255,0.85)", borderRadius: 3, transition: "width 0.05s linear" }} />
                </div>
              </div>

              {/* Infos auteur + caption */}
              <div style={{ position: "absolute", left: 14, right: 80, bottom: hasMarketplace ? "calc(178px + env(safe-area-inset-bottom,0px))" : "calc(112px + env(safe-area-inset-bottom,0px))", color: "#fff", zIndex: 2 }}>
                <div onClick={() => onUser?.(post.by)} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 6, cursor: "pointer" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{post.author?.fullName || post.author?.prenom || post.author?.name || ""}</span>
                  <Badge type={post.author?.badge} />
                  {T && Av && <DuoBadge sb={sb} T={T} Av={Av} postId={post.id} />}
                  {post.pinned && T && <span style={{ fontSize: 10, color: T.goldL, fontWeight: 700, background: T.goldBg, border: `1px solid ${T.gold}55`, padding: "2px 8px", borderRadius: 20, backdropFilter: "blur(4px)" }}>✦ Sponsorisé</span>}
                  {post.is_ai_generated && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#c4b5fd", background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.5)", padding: "2px 8px", borderRadius: 20, backdropFilter: "blur(4px)" }}><Sparkles size={10} /> IA</span>}
                </div>
                {(post.categories || []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                    {(post.categories || []).slice(0, 3).map((c, i) => (
                      <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20, padding: "3px 10px", backdropFilter: "blur(4px)" }}>
                        #{c.category}
                      </span>
                    ))}
                  </div>
                )}
                {caption.length > 0 && (
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.85)", textAlign: "left" }}>
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
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Eye size={12} />{viewCounts[post.id] ?? 0}
                </p>
                {post.sound?.title && (
                  <div style={{ marginTop: 8 }} onClick={() => onOpenSound?.(post.sound.id)}>
                    <SoundBadge title={post.sound.title} playing={isActive && !pausedMap[idx]} />
                  </div>
                )}
              </div>

              {/* Boutons marketplace */}
              {hasMarketplace && (
                <div style={{ position: "absolute", left: 14, right: 80, bottom: "calc(112px + env(safe-area-inset-bottom,0px))", zIndex: 2, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {post.whatsapp_contact && (
                    <a href={"https://wa.me/" + post.whatsapp_contact.replace(/\D/g, "")} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                      style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", padding: "8px 14px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", fontWeight: 700, fontSize: 12, textDecoration: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  )}
                  {post.contact_link && (
                    <a href={post.contact_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                      style={{ background: "rgba(74,144,217,0.9)", padding: "8px 14px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", fontWeight: 700, fontSize: 12, textDecoration: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
                      🔗 Voir le lien
                    </a>
                  )}
                </div>
              )}

              {/* Actions droite */}
              <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 22, zIndex: 2 }}>

                {/* Avatar + bouton connect */}
                <div style={{ position: "relative", width: 46, height: 46 }}>
                  <div onClick={() => onUser?.(post.by)} style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(255,255,255,0.2)", overflow: "hidden", border: "2px solid #fff", cursor: "pointer" }}>
                    {post.author?.avatar_url && <img src={post.author.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} alt="" />}
                  </div>
                  {!isMe && !isConnected && (
                    <button
                      onClick={() => handleConnectClick(post.by)}
                      style={{
                        position: "absolute", right: -4, bottom: -4,
                        background: connectAnimId === post.by ? "#4ade80" : "#ff2d55",
                        border: "2px solid #fff", borderRadius: "50%", width: 22, height: 22,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", padding: 0, color: "#fff",
                        fontSize: 14, fontWeight: 900, lineHeight: 1,
                        transform: connectAnimId === post.by ? "scale(1.35)" : "scale(1)",
                        transition: "transform 0.3s cubic-bezier(.34,1.56,.64,1), background 0.25s ease",
                      }}
                    >
                      {connectAnimId === post.by ? <Check size={13} /> : "+"}
                    </button>
                  )}
                </div>

                {/* Like : tap = like, maintien = remplissage + burst */}
                <div
                  onPointerDown={e => { e.stopPropagation(); startLikeHold(idx, post); }}
                  onPointerUp={e => { e.stopPropagation(); endLikeHold(idx, post); }}
                  onPointerLeave={() => cancelLikeHold(idx)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, touchAction: "none" }}
                >
                  <div style={{ position: "relative", width: 32, height: 32 }}>
                    <Heart size={32} fill={liked ? "#ff2d55" : "none"} color={liked ? "#ff2d55" : "#fff"} style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))", animation: liked ? "pulse .3s ease" : "none" }} />
                    {!liked && (likeFillMap[idx] || 0) > 0 && (
                      <div style={{ position: "absolute", inset: 0, overflow: "hidden", clipPath: `inset(${100 - likeFillMap[idx]}% 0 0 0)` }}>
                        <Heart size={32} fill="#ff2d55" color="#ff2d55" />
                      </div>
                    )}
                    {likeBurstMap[idx] && (
                      <Heart size={64} fill="#fff" color="#fff" style={{ position: "absolute", top: -16, left: -16, filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.4))", animation: "heartBurst .6s ease", pointerEvents: "none" }} />
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{(post.likes || []).length}</span>
                </div>

                {/* Commentaires : tap = ouvrir, maintien = menu réactions rapides */}
                <div
                  onPointerDown={e => { e.stopPropagation(); startLongPress(idx, e); }}
                  onPointerMove={e => { e.stopPropagation(); moveLongPress(idx, e); }}
                  onPointerUp={e => { e.stopPropagation(); endLongPress(idx, post); }}
                  onPointerLeave={() => { if (reactOpenIdx === idx) endLongPress(idx, post); else cancelLongPress(); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, position: "relative", touchAction: reactOpenIdx === idx ? "none" : "auto" }}
                >
                  <button
                    onClick={() => { if (reactOpenIdx !== idx) { setReelsModalOpen(true); onOpenComments(post, (newCount) => { setReelsModalOpen(false); if (typeof newCount === "number") setCommentCountOverrideMap(p => ({ ...p, [post.id]: newCount })); }); } }}
                    style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))" }}
                  >
                    <MessageCircle size={30} color="#fff" />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{commentCountOverrideMap[post.id] ?? ((post.commentsCount ?? (post.comments || []).length) + (commentBumpMap[post.id] || 0))}</span>
                  {reactOpenIdx === idx && (
                    <div style={{ position: "absolute", right: 44, top: "50%", width: 0, height: 0, zIndex: 50, pointerEvents: "none" }}>
                      {quickReactions.map(q => {
                        const active = reactDir === q.key;
                        const pos = { up: { x: -20, y: -58 }, down: { x: -20, y: 18 }, left: { x: -64, y: -20 }, right: { x: 4, y: -20 } }[q.key];
                        return (
                          <div key={q.key} style={{
                            position: "absolute", right: -pos.x, top: pos.y,
                            transform: `scale(${active ? 1.3 : 1})`,
                            width: 40, height: 40, borderRadius: "50%",
                            background: active ? "#C9952A" : "rgba(20,20,20,0.92)",
                            border: "1px solid rgba(201,149,42,0.55)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, transition: "transform .15s ease, background .15s ease",
                            boxShadow: active ? "0 0 16px rgba(201,149,42,0.55)" : "0 4px 12px rgba(0,0,0,0.4)",
                          }}>{q.emoji}</div>
                        );
                      })}
                    </div>
                  )}
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

                {/* Partager */}
                <button onClick={() => setShareModalPostId(post.id)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))" }}>
                  <Share2 size={27} />
                </button>

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

      {shareModalPost && (
        <SharePostModal
          post={shareModalPost}
          sb={sb}
          session={session}
          notify={notify}
          onClose={() => setShareModalPostId(null)}
          onShared={() => setShareModalPostId(null)}
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
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        @keyframes heartBurst {
          0%   { transform: scale(0.3); opacity: 1; }
          50%  { transform: scale(1.4); opacity: 0.9; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}