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
import { X, Heart, MessageCircle, Bookmark, Play, Volume2, VolumeX, MoreVertical, Trash2, Flag, EyeOff, ChevronLeft, Eye, Check, Share2, Sparkles, BarChart3, Calendar, MapPin, Clock, Users, UserPlus, CheckCircle2 } from "lucide-react";
import SharePostModal from "./SharePostModal";
import { useVideoEngagement } from "./lib/recommendation/useVideoEngagement";
import { SOUND_MATCH_BONUS } from "./lib/recommendation/useFeedRanking";
import SoundBadge from "./components/SoundBadge";
import SoundDiscBadge from "./components/SoundDiscBadge";
import { DuoBadge } from "./Duo";

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

// ── Raisons de suppression admin (motif communiqué à l'auteur) ────
const ADMIN_DELETE_REASONS = ["Contenu inapproprié ou choquant","Nudité ou contenu sexuel","Violence ou contenu dangereux","Discours haineux ou discrimination","Harcèlement ou intimidation","Fausses informations","Spam ou publicité non désirée","Contenu protégé (droits d'auteur)","Contenu réutilisé d'une autre plateforme (filigrane visible)","Signalement non fondé mais retiré pour une autre raison","Autre"];

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

// ── Sondage & événement (copiés/adaptés depuis App.jsx pour autonomie) ──
const POLL_COLORS = ["#8b5cf6","#22c55e","#f97316","#3b82f6","#ec4899","#eab308","#14b8a6","#f43f5e"];
function formatPollTimeLeft(expiresAt) {
  if (!expiresAt) return "Illimité";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Terminé";
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `${days}j restant${days > 1 ? "s" : ""}`;
  const hours = Math.floor(diff / 3600000);
  if (hours >= 1) return `${hours}h restante${hours > 1 ? "s" : ""}`;
  const mins = Math.max(1, Math.floor(diff / 60000));
  return `${mins}min restante${mins > 1 ? "s" : ""}`;
}
function formatEventDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return null;
  const days = ["DIMANCHE","LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI"];
  const months = ["JANV.","FÉVR.","MARS","AVR.","MAI","JUIN","JUIL.","AOÛT","SEPT.","OCT.","NOV.","DÉC."];
  return { dayName: days[d.getDay()], dayNum: d.getDate(), month: months[d.getMonth()] };
}

// ── Sondage interactif plein écran (vote en direct) ────────────────
function PhotoPollCard({ post, sb, session }) {
  const uid = session?.user?.id;
  const [options, setOptions] = useState([]);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
 
  const [justVoted, setJustVoted] = useState(null);
  const expired = post.expires_at ? new Date(post.expires_at).getTime() <= Date.now() : false;

  useEffect(() => {
    let cancelled = false;
    const hasInitialData = Array.isArray(post.poll_options);
    if (hasInitialData) {
      setOptions(post.poll_options || []); setVotes(post.poll_votes || []); setLoading(false);
    } else {
      (async () => {
        const [{ data: opts }, { data: v }] = await Promise.all([
          sb.from("poll_options").select("id,label,position").eq("post_id", post.id).order("position", { ascending: true }),
          sb.from("poll_votes").select("option_id,voter_id").eq("post_id", post.id)
        ]);
        if (cancelled) return;
        setOptions(opts || []); setVotes(v || []); setLoading(false);
      })();
    }
    const channel = sb.channel(`photoviewer_poll_${post.id}_${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `post_id=eq.${post.id}` }, payload => {
        setVotes(prev => {
          if (payload.eventType === "INSERT") return [...prev, { option_id: payload.new.option_id, voter_id: payload.new.voter_id }];
          if (payload.eventType === "DELETE") return prev.filter(x => !(x.option_id === payload.old.option_id && x.voter_id === payload.old.voter_id));
          return prev;
        });
      }).subscribe();
    return () => { cancelled = true; sb.removeChannel(channel); };
  }, [post.id]);

  const totalVotes = useMemo(() => new Set(votes.map(v => v.voter_id)).size, [votes]);
  const countsByOption = useMemo(() => {
    const m = {}; options.forEach(o => m[o.id] = 0);
    votes.forEach(v => { m[v.option_id] = (m[v.option_id] || 0) + 1; });
    return m;
  }, [votes, options]);
  const myOptionIds = useMemo(() => new Set(votes.filter(v => v.voter_id === uid).map(v => v.option_id)), [votes, uid]);

  const handleVote = async optId => {
    if (!uid || expired) return;
    setJustVoted(optId);
    setTimeout(() => setJustVoted(null), 450);
    const alreadyMine = myOptionIds.has(optId);
    if (alreadyMine) {
      setVotes(prev => prev.filter(v => !(v.option_id === optId && v.voter_id === uid)));
      sb.from("poll_votes").delete().eq("post_id", post.id).eq("option_id", optId).eq("voter_id", uid);
    } else if (!post.poll_multiple && myOptionIds.size > 0) {
      setVotes(prev => [...prev.filter(v => v.voter_id !== uid), { option_id: optId, voter_id: uid }]);
      sb.from("poll_votes").delete().eq("post_id", post.id).eq("voter_id", uid)
        .then(() => sb.from("poll_votes").insert({ post_id: post.id, option_id: optId, voter_id: uid }));
    } else {
      setVotes(prev => [...prev, { option_id: optId, voter_id: uid }]);
      sb.from("poll_votes").insert({ post_id: post.id, option_id: optId, voter_id: uid });
    }
  };

  return (
    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, padding: "0 22px" }}>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: .5, display: "flex", alignItems: "center", gap: 5 }}>
        <BarChart3 size={13} /> SONDAGE
      </p>
      {post.text && <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#fff", lineHeight: 1.4 }}>{post.text}</p>}
      {loading ? (
        <div style={{ padding: "30px 0", textAlign: "center" }}>
          <div style={{ width: 22, height: 22, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#a78bfa", borderRadius: "50%", margin: "0 auto", animation: "spin .7s linear infinite" }} />
        </div>
      ) : (
        <>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            {expired ? "Sondage terminé" : (post.poll_multiple ? "Plusieurs choix possibles" : "Un seul choix possible")}
          </p>
          {options.map((opt, i) => {
            const count = countsByOption[opt.id] || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const mine = myOptionIds.has(opt.id);
            const color = POLL_COLORS[i % POLL_COLORS.length];
            return (
              <button key={opt.id} disabled={expired} onClick={() => handleVote(opt.id)}
                style={{ display: "block", width: "100%", position: "relative", overflow: "hidden", border: `1px solid ${mine ? color + "aa" : "rgba(255,255,255,0.18)"}`, borderRadius: 14, padding: "13px 15px", marginBottom: 9, background: "rgba(255,255,255,0.06)", backdropFilter: "blur(6px)", cursor: expired ? "default" : "pointer", textAlign: "left", transition: "transform .12s cubic-bezier(0.34,1.56,0.64,1), border-color .15s ease", transform: justVoted === opt.id ? "scale(0.96)" : "scale(1)" }}>
                <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: `linear-gradient(90deg,${color}55,${color}22)`, transition: justVoted === opt.id ? "none" : "width .35s cubic-bezier(0.22,1,0.36,1)" }} />
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    {mine
                      ? <CheckCircle2 size={17} color={color} style={{ flexShrink: 0 }} />
                      : <span style={{ width: 17, height: 17, borderRadius: "50%", border: `2px solid ${color}aa`, flexShrink: 0 }} />}
                    <span style={{ fontSize: 14, color: "#fff", fontWeight: mine ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opt.label}</span>
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: mine ? color : "rgba(255,255,255,0.6)", flexShrink: 0 }}>{pct}%</span>
                </div>
              </button>
            );
          })}
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{totalVotes} vote{totalVotes > 1 ? "s" : ""} · {formatPollTimeLeft(post.expires_at)}</p>
        </>
      )}
    </div>
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
  onParticipate,
  T,
  Av,
  onNeedMore,
  hasMore,
  loadingMore,
}) {
  const [activeIdx,       setActiveIdx]       = useState(startIndex);
  const [mediaIdxMap,     setMediaIdxMap]     = useState(() => ({ [startIndex]: startMediaIndex }));
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [photoModalOpen,  setPhotoModalOpen]  = useState(false);
  const [hiddenPostIds,   setHiddenPostIds]   = useState(() => new Set());
  const [menuPostId,      setMenuPostId]      = useState(null);
  const [shareModalPostId, setShareModalPostId] = useState(null);
  const [reportPost,      setReportPost]      = useState(null);
  const [deleteReasonPost, setDeleteReasonPost] = useState(null);
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

  // ── Mode session : jongle entre les 3 derniers centres d'intérêt likés,
  // et suit aussi le dernier son liké (signal fort, spécifique aux photos) ──
  const [orderedPosts, setOrderedPosts] = useState(() => posts || []);
  const [interestBoost, setInterestBoost] = useState([]); // [{category,weight}] — plus récent en premier, fenêtre de 3
  const [soundBoost, setSoundBoost] = useState(null); // id du dernier son liké
  const activeIdxRef = useRef(startIndex);
  const [viewCounts, setViewCounts] = useState({});

  const containerRef  = useRef(null);
  const itemRefs      = useRef({});
  const carouselRefs  = useRef({});
  const lastTapRef    = useRef({});
  const heartIdRef    = useRef(0);
  const soundAudioRef = useRef(null);
  const [muted, setMuted] = useState(false);

  const [likeFillMap, setLikeFillMap] = useState({});
  const [likeBurstMap, setLikeBurstMap] = useState({});
  const likeHoldStartRef = useRef(null);
  const likeHoldFrameRef = useRef(null);
  const likeBurstFiredRef = useRef(false);
  const likeHalfFiredRef = useRef(false);
  const LIKE_HOLD_MS = 900;
  const haptic = pattern => { try { navigator.vibrate && navigator.vibrate(pattern); } catch (_) {} };

  const [reactOpenIdx, setReactOpenIdx] = useState(null);
  const [reactDir, setReactDir] = useState(null);
  const [commentBumpMap, setCommentBumpMap] = useState({});
  const [commentCountOverrideMap, setCommentCountOverrideMap] = useState({});
  const reactStartRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const lastReactDirRef = useRef(null);
  const quickReactions = [
    { key: "up",    dx: 0,  dy: -1, emoji: "👏", text: "👏 Bravo, superbe !" },
    { key: "down",  dx: 0,  dy: 1,  emoji: "🙏", text: "🙏 Merci pour ce partage" },
    { key: "left",  dx: -1, dy: 0,  emoji: "✨", text: "✨ J'ai adoré !" },
    { key: "right", dx: 1,  dy: 0,  emoji: "😲", text: "😲 Waouh, incroyable !" },
  ];

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
  const [participatingIds, setParticipatingIds] = useState(
    () => new Set((posts || []).filter(p => (p.participants || []).some(x => (x.user_id || x) === uid)).map(p => p.id))
  );
  const [participantCountMap, setParticipantCountMap] = useState(() => {
    const m = {};
    (posts || []).forEach(p => { m[p.id] = (p.participants || []).length; });
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

  const registerLikeInterest = useCallback((post) => {
    const cats = post.categories || [];
    if (cats.length) {
      setInterestBoost(prev => {
        const withoutDup = prev.filter(c => !cats.some(nc => nc.category === c.category));
        return [...cats, ...withoutDup].slice(0, 3);
      });
    }
    if (post.sound?.id) setSoundBoost(post.sound.id);
  }, []);

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
    () => (orderedPosts || []).filter(p => !hiddenPostIds.has(p.id) && (p.type === "poll" || p.type === "event" || (photosByPost[p.id] || []).length > 0)),
    [orderedPosts, hiddenPostIds, photosByPost]
  );

  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

  // Si la liste affichée se vide ou rétrécit sous l'index courant, on s'ajuste
  useEffect(() => {
    if (displayPosts.length === 0) { onClose?.(); return; }
    if (activeIdx >= displayPosts.length) setActiveIdx(displayPosts.length - 1);
  }, [displayPosts.length]);

  // ── Scroll initial + re-synchronisation quand le parent envoie un
  // nouveau point de départ (ex: navigation depuis la modale d'un son) ──
  useEffect(() => {
    setActiveIdx(startIndex);
    setOrderedPosts(posts || []);
    // Seed le mode session avec la photo tappée elle-même (catégories + son),
    // même logique que ReelsViewer : pas besoin d'attendre un like.
    const tapped = (posts || [])[startIndex];
    setInterestBoost(tapped?.categories || []);
    setSoundBoost(tapped?.sound?.id || null);
    setMediaIdxMap(m => ({ ...m, [startIndex]: startMediaIndex || 0 }));
    const el = containerRef.current;
    if (el) el.scrollTo({ top: startIndex * window.innerHeight, behavior: "auto" });
    const carEl = carouselRefs.current[startIndex];
    if (carEl) {
      carEl.scrollTo({ left: (startMediaIndex || 0) * carEl.clientWidth, behavior: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex]);

  // ── Jongle la suite de la file (pas encore vue) selon les derniers likes :
  // catégories ET son partagé ──
  useEffect(() => {
    if (!interestBoost.length && !soundBoost) return;
    setOrderedPosts(prev => {
      const cut = activeIdxRef.current + 1;
      const frozen = prev.slice(0, cut);
      const future = prev.slice(cut);
      if (future.length < 2) return prev;

      const relatedness = (p) => {
        let score = 0;
        const postCats = p.categories || [];
        if (postCats.length) {
          interestBoost.forEach((ic, i) => {
            const match = postCats.find(pc => pc.category === ic.category);
            if (match) score += (ic.weight || 1) * (match.weight || 1) * (interestBoost.length - i);
          });
        }
        if (soundBoost && p.sound?.id === soundBoost) score += SOUND_MATCH_BONUS;
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
  }, [interestBoost, soundBoost]);

  // ── Fusionne les nouvelles photos ramenées par onNeedMore() ──
  useEffect(() => {
    setOrderedPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const fresh = (posts || []).filter(p => !existingIds.has(p.id));
      if (!fresh.length) return prev;

      const refCats = interestBoost.length ? interestBoost : (prev[0]?.categories || []);
      const refSound = soundBoost || prev[0]?.sound?.id || null;
      const relatedness = (p) => {
        let score = 0;
        const postCats = p.categories || [];
        if (postCats.length && refCats.length) {
          refCats.forEach((rc, i) => {
            const match = postCats.find(pc => pc.category === rc.category);
            if (match) score += (rc.weight || 1) * (match.weight || 1) * (refCats.length - i);
          });
        }
        if (refSound && p.sound?.id === refSound) score += SOUND_MATCH_BONUS;
        return score;
      };

      const related = fresh.filter(p => relatedness(p) > 0).sort((a, b) => relatedness(b) - relatedness(a));
      const other = fresh.filter(p => relatedness(p) === 0);
      const merged = [];
      let ri = 0, oi = 0;
      while (ri < related.length || oi < other.length) {
        if (ri < related.length) merged.push(related[ri++]);
        if (ri < related.length) merged.push(related[ri++]);
        if (oi < other.length) merged.push(other[oi++]);
      }
      return [...prev, ...merged];
    });
  }, [posts]);

  // ── Déclenche onNeedMore() quand il ne reste plus que ~4 photos devant ──
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
      if (!likedIds.has(post.id)) { handleToggleLike(post); engagement.markLiked(myProfile?.is_admin); registerLikeInterest(post); }
    }
    lastTapRef.current[idx] = now;
  }, [handleToggleLike, likedIds, engagement, myProfile, registerLikeInterest]);

  const removeHeart = useCallback((id) => {
    setHearts(h => h.filter(hh => hh.id !== id));
  }, []);

  const handleConnectClick = useCallback((userId) => {
    onConnect?.(userId);
    setConnectAnimId(userId);
    setTimeout(() => setConnectAnimId(prev => (prev === userId ? null : prev)), 900);
  }, [onConnect]);

  const startLikeHold = useCallback((idx, post) => {
    if (likedIds.has(post.id)) return;
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
        handleToggleLike(post); engagement.markLiked(myProfile?.is_admin); registerLikeInterest(post);
        likeHoldStartRef.current = null;
        setTimeout(() => { setLikeBurstMap(p => ({ ...p, [idx]: false })); setLikeFillMap(p => ({ ...p, [idx]: 0 })); }, 650);
        return;
      }
      likeHoldFrameRef.current = requestAnimationFrame(tick);
    };
    likeHoldFrameRef.current = requestAnimationFrame(tick);
  }, [likedIds, handleToggleLike, engagement, myProfile, registerLikeInterest]);

  const endLikeHold = useCallback((idx, post) => {
    cancelAnimationFrame(likeHoldFrameRef.current);
    if (likeBurstFiredRef.current) { likeBurstFiredRef.current = false; return; }
    const held = likeHoldStartRef.current ? performance.now() - likeHoldStartRef.current : 0;
    setLikeFillMap(p => ({ ...p, [idx]: 0 }));
    likeHoldStartRef.current = null;
    haptic("light");
    const wasLiked = likedIds.has(post.id);
    handleToggleLike(post);
    if (!wasLiked) { engagement.markLiked(myProfile?.is_admin); registerLikeInterest(post); }
  }, [likedIds, handleToggleLike, engagement, myProfile, registerLikeInterest]);

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
  }, [uid, sb]);

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
  }, [uid, reportPost, notify, engagement]);

  useEffect(() => () => clearTimeout(longPressTimerRef.current), []);

  const menuPost = displayPosts.find(p => p.id === menuPostId) || null;
  const shareModalPost = displayPosts.find(p => p.id === shareModalPostId) || null;

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
          const hasMarketplace = post.is_for_sale && (post.whatsapp_contact || post.contact_link);
          const isPoll        = post.type === "poll";
          const isEvent       = post.type === "event";
          const participating = participatingIds.has(post.id);
          const participantsCount = participantCountMap[post.id] ?? (post.participants || []).length;
          const evDateParts   = isEvent ? formatEventDate(post.eventDate) : null;

          return (
            <div
              key={post.id}
              ref={el => itemRefs.current[idx] = el}
              data-idx={idx}
              style={{
                height: "calc(var(--app-vh, 1vh) * 100)", width: "100%",
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
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
                  {/* Carrousel horizontal des photos du post (ou fond sondage / événement) */}
                  <div
                    ref={el => carouselRefs.current[idx] = el}
                    onScroll={photos.length > 0 ? handleCarouselScroll(idx, photos.length) : undefined}
                    onClick={e => handleTap(idx, post, e)}
                    style={{
                      display: "flex", width: "100%", height: "100%",
                      alignItems: "center", justifyContent: "center",
                      overflowX: photos.length > 1 ? "auto" : "hidden",
                      scrollSnapType: "x mandatory",
                      WebkitOverflowScrolling: "touch",
                      scrollbarWidth: "none",
                      background: isPoll
                        ? "radial-gradient(circle at 30% 20%,#241635 0%,#0d0715 70%)"
                        : (isEvent && photos.length === 0)
                        ? "linear-gradient(160deg,#3d1220 0%,#7a1f3d 45%,#1a0510 100%)"
                        : undefined,
                    }}
                  >
                    {isPoll ? (
                      <PhotoPollCard post={post} sb={sb} session={session} />
                    ) : photos.length > 0 ? (
                      photos.map((url, pIdx) => (
                        <div key={pIdx} style={{ flex: "0 0 100%", scrollSnapAlign: "start", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <img
                            src={url}
                            alt=""
                            loading={Math.abs(pIdx - curMediaIdx) <= 1 ? "eager" : "lazy"}
                            style={{ width: "100%", height: "100%", objectFit: "contain", userSelect: "none" }}
                            draggable={false}
                          />
                        </div>
                      ))
                    ) : isEvent ? (
                      <Calendar size={64} color="rgba(255,255,255,0.18)" />
                    ) : null}
                  </div>

                  {/* Points du carrousel */}
                  {photos.length > 1 && (
                    <div style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top,0px) + 46px)", left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4, zIndex: 4, pointerEvents: "none" }}>
                      {photos.map((_, pIdx) => (
                        <div key={pIdx} style={{ width: pIdx === curMediaIdx ? 16 : 6, height: 6, borderRadius: 3, background: pIdx === curMediaIdx ? "#C9952A" : "rgba(255,255,255,0.4)", transition: "width .2s" }} />
                      ))}
                    </div>
                  )}

                  {/* Badge type (sondage / événement) */}
                  {(isPoll || isEvent) && (
                    <div style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top,0px))", left: "50%", transform: "translateX(-50%)", zIndex: 4, display: "inline-flex", alignItems: "center", gap: 5, background: isPoll ? "rgba(139,92,246,0.25)" : "linear-gradient(90deg,#ff3d6e,#ff8a3d)", border: isPoll ? "1px solid rgba(139,92,246,0.5)" : "none", borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: .3, backdropFilter: "blur(6px)" }}>
                      {isPoll ? <><BarChart3 size={12} /> Sondage</> : <><Calendar size={12} /> Événement</>}
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
              <div style={{ position: "absolute", left: 14, right: 80, bottom: "calc(90px + env(safe-area-inset-bottom,0px))", color: "#fff", zIndex: 2, pointerEvents: "none", maxHeight: "50vh", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div onClick={() => onUser?.(post.by)} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, cursor: "pointer", pointerEvents: "auto", width: "fit-content", flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{post.author?.fullName || post.author?.prenom || post.author?.name || ""}</span>
                  <Badge type={post.author?.badge} />
                  {T && Av && isActive && <DuoBadge sb={sb} T={T} Av={Av} postId={post.id} />}
                  {post.pinned && T && <span style={{ fontSize: 10, color: T.goldL, fontWeight: 700, background: T.goldBg, border: `1px solid ${T.gold}55`, padding: "2px 8px", borderRadius: 20, backdropFilter: "blur(4px)", pointerEvents: "auto" }}>✦ Sponsorisé</span>}
                  {post.is_ai_generated && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#c4b5fd", background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.5)", padding: "2px 8px", borderRadius: 20, backdropFilter: "blur(4px)", pointerEvents: "auto" }}><Sparkles size={10} /> IA</span>}
                </div>
                {(post.categories || []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6, pointerEvents: "auto" }}>
                    {(post.categories || []).slice(0, 3).map((c, i) => (
                      <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20, padding: "3px 10px", backdropFilter: "blur(4px)" }}>
                        #{c.category}
                      </span>
                    ))}
                  </div>
                )}
                {isEvent && post.title && (
                  <p style={{ margin: "0 0 4px", fontFamily: "'Cormorant Garamond',serif", fontSize: 19, fontWeight: 700, color: "#fff", pointerEvents: "auto" }}>{post.title}</p>
                )}
                {caption.length > 0 && !isPoll && (
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
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 4, pointerEvents: "none", flexShrink: 0 }}>
                  <Eye size={12} />{viewCounts[post.id] ?? 0}
                </p>
                {post.sound?.title && (
                  <div style={{ marginTop: 8, pointerEvents: "auto", width: "fit-content" }} onClick={() => onOpenSound?.(post.sound.id)}>
                    <SoundBadge title={post.sound.title} playing={isActive} />
                  </div>
                )}
                {hasMarketplace && (
                  <div style={{ marginTop: 8, pointerEvents: "auto", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {post.whatsapp_contact && (
                      <a href={"https://wa.me/" + post.whatsapp_contact.replace(/\D/g, "")} target="_blank" rel="noreferrer"
                        style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", padding: "8px 14px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", fontWeight: 700, fontSize: 12, textDecoration: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    )}
                    {post.contact_link && (
                      <a href={post.contact_link} target="_blank" rel="noreferrer"
                        style={{ background: "rgba(74,144,217,0.9)", padding: "8px 14px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", fontWeight: 700, fontSize: 12, textDecoration: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
                        🔗 Voir le lien
                      </a>
                    )}
                  </div>
                )}
                {isEvent && (
                  <div style={{ marginTop: 8, pointerEvents: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {evDateParts && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.14)", borderRadius: 20, padding: "6px 10px", fontSize: 11.5, color: "#fff", backdropFilter: "blur(4px)" }}>
                          <Calendar size={12} /> {evDateParts.dayName} {evDateParts.dayNum} {evDateParts.month}
                        </div>
                      )}
                      {post.eventTime && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.14)", borderRadius: 20, padding: "6px 10px", fontSize: 11.5, color: "#fff", backdropFilter: "blur(4px)" }}>
                          <Clock size={12} /> {post.eventTime}
                        </div>
                      )}
                      {post.eventLoc && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.14)", borderRadius: 20, padding: "6px 10px", fontSize: 11.5, color: "#fff", backdropFilter: "blur(4px)" }}>
                          <MapPin size={12} /> {post.eventLoc}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.14)", borderRadius: 20, padding: "6px 10px", fontSize: 11.5, color: "#fff", backdropFilter: "blur(4px)" }}>
                        <Users size={12} /> {participantsCount} participant{participantsCount > 1 ? "s" : ""}
                      </div>
                    </div>
                    <button onClick={e => {
                        e.stopPropagation();
                        const alreadyParticipating = participatingIds.has(post.id);
                        setParticipatingIds(prev => { const n = new Set(prev); alreadyParticipating ? n.delete(post.id) : n.add(post.id); return n; });
                        setParticipantCountMap(prev => ({ ...prev, [post.id]: Math.max(0, (prev[post.id] ?? (post.participants || []).length) + (alreadyParticipating ? -1 : 1)) }));
                        onParticipate?.(post.id);
                      }}
                      style={{ width: "fit-content", borderRadius: 20, padding: "9px 18px", fontSize: 13, fontWeight: 700, color: participating ? "#e0b84a" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, background: participating ? "rgba(255,255,255,0.14)" : "linear-gradient(90deg,#ff3d6e,#ff8a3d)", border: participating ? "1px solid rgba(224,184,74,0.5)" : "none", boxShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
                      {participating ? <><Check size={15} /> Vous participez</> : <><UserPlus size={15} /> Participer</>}
                    </button>
                  </div>
                )}
              </div>

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
                  onPointerCancel={() => cancelLikeHold(idx)}
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
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{likeCountMap[post.id] ?? (post.likes || []).length}</span>
                </div>

                {/* Commentaires : tap = ouvrir, maintien = menu réactions rapides */}
                <div
                  onPointerDown={e => { e.stopPropagation(); startLongPress(idx, e); }}
                  onPointerMove={e => { e.stopPropagation(); moveLongPress(idx, e); }}
                  onPointerUp={e => { e.stopPropagation(); endLongPress(idx, post); }}
                  onPointerLeave={() => { if (reactOpenIdx === idx) endLongPress(idx, post); else cancelLongPress(); }}
                  onPointerCancel={() => { if (reactOpenIdx === idx) { setReactOpenIdx(null); setReactDir(null); reactStartRef.current = null; lastReactDirRef.current = null; } cancelLongPress(); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, position: "relative", touchAction: "none" }}
                >
                  <button
                    onClick={() => { if (reactOpenIdx !== idx) { setPhotoModalOpen(true); onOpenComments(post, (newCount) => { setPhotoModalOpen(false); if (typeof newCount === "number") setCommentCountOverrideMap(p => ({ ...p, [post.id]: newCount })); }); } }}
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