// Groups.jsx
// Module autonome pour les groupes de discussion (façon WhatsApp).
// Connecté à App.jsx uniquement par import — aucune dépendance inverse.
// La messagerie du groupe (écran de chat, envoi de messages/médias) sera
// branchée dans une prochaine étape, une fois cette brique validée.

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { X, Search, Check, Camera, Users, Lock, ChevronRight, ChevronLeft, Send, Smile, UserPlus, Flag, LogOut, Trash2, Paperclip, FileText, Pin, BellOff, Bell, Mic, Pause, Play, Image as ImageIcon, Eye, EyeOff, Sparkles, Grid } from "lucide-react";
import EasyCrop from "react-easy-crop";
import VideoTrimModal from "./components/VideoTrimModal";
import { uploadToR2 } from "./uploadMedia";
import { enqueueGroupMessage, getQueueForGroup, subscribeGroupQueue, processGroupQueue, retryGroupMessage, trackGroupFileSend, updateGroupFileSend, removeGroupFileSend, getGroupFileSendsForConv, subscribeGroupFileSends } from "./lib/groupMessageQueue";
import StickerPicker from "./components/StickerPicker";
import { computeWaveform, fallbackBars } from "./lib/waveform";
import { Capacitor } from "@capacitor/core";
import { PrivacyScreen } from "@capacitor-community/privacy-screen";
import previewDark from "./assets/preview.webp";
import previewLight from "./assets/preview-light.webp";
import {
  groupMessagesByDay, DayDivider, QUICK_REACTIONS, ReactionBar, InlineReactionPicker,
  useLongPress, useDoubleTap, HeartBurst, ReplyComposerBar, MessageReplyQuote,
  useTypingIndicator, TypingIndicator, EditedBadge, SwipeToReply,
  ChatPersonalizationScreen, readGroupStyle
} from "./ChatExtras";

// Dupliqué depuis App.jsx (pas de dépendance inverse possible, voir en-tête du fichier)
function ProtectedImage({ url, style = {} }) {
  if (!url) return null;
  return (
    <img src={url} alt="" draggable={false} onContextMenu={e => e.preventDefault()}
      style={{ maxWidth: 220, borderRadius: 14, display: "block", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none", ...style }} />
  );
}
function ProtectedVideo({ url, style = {} }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const toggle = e => {
    e.stopPropagation();
    const v = ref.current; if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };
  return (
    <div onClick={toggle} onContextMenu={e => e.preventDefault()} style={{ position: "relative", cursor: "pointer", borderRadius: 14, overflow: "hidden", WebkitTouchCallout: "none", ...style }}>
      <video ref={ref} src={url} playsInline disablePictureInPicture controlsList="nodownload noremoteplayback noplaybackrate"
        style={{ maxWidth: 220, maxHeight: 260, display: "block", background: "#000", pointerEvents: "none" }} />
      {!playing &&
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21" /></svg>
          </div>
        </div>
      }
    </div>
  );
}
function isLightBg(hex) {
  if (!hex || hex[0] !== "#") return false;
  const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : hex;
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
}
/* ============================================================
   0. ÉPINGLER / SOURDINE / FOND D'ÉCRAN — préférences locales
   (par appareil, comme WhatsApp Web : pas de synchronisation serveur)
   ============================================================ */

const isNative = Capacitor.isNativePlatform();
const hm = ts => { try { return new Date(ts).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

function readIdList(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function writeIdList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch {}
}

export function isGroupPinned(groupId) {
  return readIdList("celeste_pinned_groups").includes(groupId);
}
export function toggleGroupPin(groupId) {
  const list = readIdList("celeste_pinned_groups");
  const next = list.includes(groupId) ? list.filter(id => id !== groupId) : [...list, groupId];
  writeIdList("celeste_pinned_groups", next);
  return next.includes(groupId);
}
export function isGroupFavorite(groupId) {
  return readIdList("celeste_favorite_groups").includes(groupId);
}
export function toggleGroupFavorite(groupId) {
  const list = readIdList("celeste_favorite_groups");
  const next = list.includes(groupId) ? list.filter(id => id !== groupId) : [...list, groupId];
  writeIdList("celeste_favorite_groups", next);
  return next.includes(groupId);
}
export function isGroupHidden(groupId) {
  return readIdList("celeste_hidden_groups").includes(groupId);
}
export function hideGroupForMe(groupId) {
  const list = readIdList("celeste_hidden_groups");
  writeIdList("celeste_hidden_groups", [...new Set([...list, groupId])]);
}
export function isGroupMuted(groupId) {
  return readIdList("celeste_muted_groups").includes(groupId);
}
export async function toggleGroupMute(sb, userId, groupId, nextMuted) {
  // Écrit en base (source de vérité, utilisée par le serveur pour bloquer les push)
  // et garde le cache local pour un affichage instantané / hors-ligne.
  const { error } = await sb.from("group_members").update({ muted: nextMuted }).eq("group_id", groupId).eq("user_id", userId);
  if (error) { console.error("Erreur mute groupe:", error); throw error; }
  const list = readIdList("celeste_muted_groups");
  const next = nextMuted ? [...new Set([...list, groupId])] : list.filter(id => id !== groupId);
  writeIdList("celeste_muted_groups", next);
  return nextMuted;
}

/* ============================================================
   1. RÉGLAGE "QUI PEUT M'AJOUTER À UN GROUPE"
   ============================================================ */

const GROUP_PRIVACY_OPTIONS = [
  { key: "everyone", label: "Tout le monde" },
  { key: "followers", label: "Mes abonnés" },
  { key: "none", label: "Personne" },
];

export async function saveGroupInvitePermission(sb, userId, value) {
  return sb.from("profiles").update({ group_invite_permission: value }).eq("id", userId);
}

export function GroupPrivacySetting({ sb, T, Btn, session, value, onChange, notify }) {
  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      const { data } = await sb.from("profiles").select("group_invite_permission").eq("id", session.user.id).maybeSingle();
      if (data?.group_invite_permission) onChange(data.group_invite_permission);
    })();
  }, [session?.user?.id]);

  const choose = async (key) => {
    onChange(key);
    await saveGroupInvitePermission(sb, session?.user?.id, key);
    notify?.("Préférence enregistrée ✦");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: T.muted }}>Qui peut m'ajouter à un groupe</p>
      {GROUP_PRIVACY_OPTIONS.map(o => (
        <Btn key={o.key} onClick={() => choose(o.key)} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", borderRadius: 12,
          border: `1px solid ${value === o.key ? T.gold : T.border}`,
          background: value === o.key ? "rgba(201,149,42,0.08)" : "transparent",
          color: value === o.key ? T.goldL : T.text, fontSize: 14
        }}>
          {o.label}
          {value === o.key && <Check size={16} />}
        </Btn>
      ))}
      <p style={{ margin: "6px 0 0", fontSize: 11, color: T.muted }}>
        Dans tous les cas, une invitation doit être acceptée avant d'entrer dans un groupe.
      </p>
    </div>
  );
}

/* ============================================================
   2. LISTE DES GROUPES DE L'UTILISATEUR
   ============================================================ */

function formatGroupTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function groupsCacheKey(userId) { return `celeste_groups_cache_${userId}`; }

function readGroupsCache(userId) {
  try {
    const raw = localStorage.getItem(groupsCacheKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeGroupsCache(userId, groups) {
  try { localStorage.setItem(groupsCacheKey(userId), JSON.stringify(groups)); } catch {}
}

export function useMyGroups(sb, userId) {
  // Démarre avec la dernière liste connue en local (téléphone) pour un affichage
  // immédiat même hors-ligne, exactement comme les conversations normales.
  const [groups, setGroups] = useState(() => (userId ? readGroupsCache(userId) : []));
  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await sb.rpc("get_my_groups_summary");
    if (error) {
      // Pas de réseau ou erreur : on garde la liste en cache déjà affichée,
      // on ne l'efface surtout pas.
      console.error("Erreur chargement des groupes:", error);
      return;
    }
    const mapped = (data || []).map(g => ({
      id: g.id,
      name: g.name,
      photo_url: g.photo_url,
      myRole: g.role,
      lastMessageText: g.last_message_text,
      lastMessageType: g.last_message_type,
      lastMessageAt: g.last_message_at,
      lastSenderId: g.last_sender_id,
      lastSenderName: g.last_sender_name,
      unreadCount: Number(g.unread_count) || 0,
      muted: !!g.muted,
      secure_mode: !!g.secure_mode, // snake_case volontaire : matche announce_only/EditGroupModal et le verrou de GroupChatScreen
    }));
    setGroups(mapped);
    writeGroupsCache(userId, mapped);
  }, [sb, userId]);
  useEffect(() => {
    // Au changement d'utilisateur, recharge d'abord le cache propre à ce compte
    // avant de relancer la requête réseau.
    if (userId) setGroups(readGroupsCache(userId));
    load();
  }, [userId, load]);
  useEffect(() => {
    if (!userId) return;
    const ch = sb.channel(`my_groups_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `user_id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages" }, () => load())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_members" }, p => { if (p.old?.user_id === userId) load(); })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, userId, load]);
  return { groups, reloadGroups: load };
}

export function GroupRow({ g, T, Av, onOpen, onLongPress }) {
  const hasLast = !!g.lastMessageAt;
  const previewBody = g.lastMessageType === "photo" ? "📷 Photo"
    : g.lastMessageType === "video" ? "🎥 Vidéo"
    : g.lastMessageType === "file" ? "📎 Fichier"
    : g.lastMessageType === "voice" ? "🎤 Message vocal"
    : g.lastMessageType === "sticker" ? "Sticker"
    : (g.lastMessageText || "");
  const preview = (g.secure_mode && !isNative)
    ? "🔒 Message masqué"
    : hasLast
      ? (g.lastSenderName ? `${g.lastSenderName} : ${previewBody}` : previewBody)
      : "Groupe";
  const pinned = isGroupPinned(g.id);
  const fav = isGroupFavorite(g.id);
  const muted = g.muted ?? isGroupMuted(g.id);
  const unread = g.unreadCount > 0;
  const pressTimerRef = useRef(null);
  return (
    <div onClick={() => onOpen(g)}
      onContextMenu={e => { e.preventDefault(); onLongPress?.(g.id); }}
      onTouchStart={e => { const startY = e.touches[0].clientY; const startX = e.touches[0].clientX; pressTimerRef.current = setTimeout(() => onLongPress?.(g.id), 600); e.currentTarget._startY = startY; e.currentTarget._startX = startX; }}
      onTouchMove={e => { const dy = Math.abs(e.touches[0].clientY - (e.currentTarget._startY || 0)); const dx = Math.abs(e.touches[0].clientX - (e.currentTarget._startX || 0)); if (dy > 10 || dx > 10) clearTimeout(pressTimerRef.current); }}
      onTouchEnd={() => clearTimeout(pressTimerRef.current)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer", background: pinned ? "rgba(255,255,255,0.03)" : "transparent" }}>
      <Av u={{ name: g.name, avatar_url: g.photo_url, initials: (g.name || "?").slice(0, 2).toUpperCase(), color: "#888" }} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
          {pinned && <Pin size={12} color={T.goldL} style={{ flexShrink: 0 }} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
          {fav && <span style={{ fontSize: 12, flexShrink: 0 }}>⭐</span>}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: unread ? T.text : T.muted, fontWeight: unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        {hasLast && <span style={{ fontSize: 11, color: unread ? T.goldL : T.muted, fontWeight: unread ? 700 : 400 }}>{formatGroupTime(g.lastMessageAt)}</span>}
        {muted
          ? <BellOff size={14} color={T.muted} />
          : (unread && (
              <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: T.gradGold, color: "#000", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {g.unreadCount > 99 ? "99+" : g.unreadCount}
              </span>
            ))
        }
      </div>
    </div>
  );
}

/* ============================================================
   3. CRÉATION D'UN GROUPE (modale plein écran, façon WhatsApp)
   ============================================================ */

export async function postSystemMessage(sb, groupId, senderId, text) {
  const { error } = await sb.from("group_messages").insert({ group_id: groupId, sender_id: senderId, type: "system", text });
  if (error) console.error("Message système non envoyé:", error);
}

export async function createGroup(sb, { name, photoUrl, creatorId, memberIds, memberNames }) {
  const { data: group, error } = await sb.from("groups").insert({ name, photo_url: photoUrl || null, created_by: creatorId }).select().single();
  if (error) throw error;

  // Le créateur doit être inséré (et commité) séparément en premier : les policies RLS
  // qui autorisent les invitations exigent que l'inviteur soit déjà membre accepté,
  // ce qui n'est pas visible tant que cette ligne n'est pas dans une requête à part.
  const { error: creatorErr } = await sb.from("group_members")
    .insert({ group_id: group.id, user_id: creatorId, role: "admin", status: "accepted", invited_by: creatorId });
  if (creatorErr) throw creatorErr;

  if (memberIds.length) {
    const inviteRows = memberIds.map(uid => ({ group_id: group.id, user_id: uid, role: "member", status: "pending", invited_by: creatorId }));
    const { error: inviteErr } = await sb.from("group_members").insert(inviteRows);
    if (inviteErr) throw inviteErr;
  }

  // Notifie chaque invité — adapte les noms de colonnes à ta table `notifications` existante
 for (const uid of memberIds) {
  const { error: notifErr } = await sb.from("notifications").insert({
    user_id: uid, type: "group_invite", from_id: creatorId,
    group_id: group.id, text: name, read: false
  });
  if (notifErr) console.error("Notif non envoyée:", notifErr);
}

  await postSystemMessage(sb, group.id, creatorId, "a créé le groupe");
  if (memberNames && memberNames.length) {
    await postSystemMessage(sb, group.id, creatorId, `a ajouté ${memberNames.join(", ")}`);
  }

  return group;
}

export async function addGroupMembers(sb, { groupId, groupName, inviterId, memberIds, memberNames }) {
  const rows = memberIds.map(uid => ({ group_id: groupId, user_id: uid, role: "member", status: "pending", invited_by: inviterId }));
  // upsert + ignoreDuplicates : si la personne est déjà membre/déjà invitée (409/23505
  // sur la clé group_id+user_id), on ignore la ligne au lieu de faire échouer tout le lot.
  const { data, error } = await sb.from("group_members")
    .upsert(rows, { onConflict: "group_id,user_id", ignoreDuplicates: true })
    .select("user_id");
  if (error) throw error;
  const addedIds = new Set((data || []).map(r => r.user_id));

  for (const uid of memberIds) {
    if (!addedIds.has(uid)) continue; // déjà membre ou déjà invité — pas de nouvelle notif
    const { error: notifErr } = await sb.from("notifications").insert({
      user_id: uid, type: "group_invite", from_id: inviterId,
      group_id: groupId, text: groupName, read: false
    });
    if (notifErr) console.error("Notif non envoyée:", notifErr);
  }

  if (memberNames && memberNames.length) {
    await postSystemMessage(sb, groupId, inviterId, `a ajouté ${memberNames.join(", ")}`);
  }
}

const MAX_OWNED_GROUPS = 2;

export function CreateGroupModal({ sb, T, Av, Btn, session, members, myConnections, myFollowers, onClose, onCreated, notify }) {
  const [step, setStep] = useState(1); // 1 = choix des membres, 2 = nom + photo
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ownedCount, setOwnedCount] = useState(null); // null = en cours de vérification
  const stepRef = useRef(1);
  stepRef.current = step;
  useEffect(() => {
    const onBack = e => { if (stepRef.current === 2) { e.preventDefault(); setStep(1); } };
    window.addEventListener("celeste_create_group_back", onBack);
    return () => window.removeEventListener("celeste_create_group_back", onBack);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count, error } = await sb.from("groups").select("id", { count: "exact", head: true }).eq("created_by", session?.user?.id);
      if (!cancelled) setOwnedCount(error ? 0 : (count || 0));
    })();
    return () => { cancelled = true; };
  }, [sb, session?.user?.id]);

  const limitReached = ownedCount !== null && ownedCount >= MAX_OWNED_GROUPS;

  const candidates = useMemo(() => {
    const known = new Set([...(myConnections || []), ...(myFollowers || [])]);
    return (members || [])
      .filter(m => m.id !== session?.user?.id)
      .filter(m => !query.trim() || (m.fullName || m.name || "").toLowerCase().includes(query.trim().toLowerCase()))
      .map(m => {
        const perm = m.group_invite_permission || "everyone";
        const eligible = perm === "everyone" || (perm === "followers" && (myConnections || []).includes(m.id));
        return { ...m, __eligible: eligible, __known: known.has(m.id) };
      })
      .sort((a, b) => (b.__known - a.__known) || (b.__eligible - a.__eligible));
  }, [members, query, myConnections, myFollowers, session?.user?.id]);

  const toggle = (uid) => setSelected(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result); // aperçu local uniquement ; l'upload réel vers R2 se fait dans submit()
    reader.readAsDataURL(file);
  };

  const submitLock = useRef(false);
  const submit = async () => {
    if (!name.trim() || selected.length === 0 || submitLock.current) return;
    submitLock.current = true;
    setSaving(true);
    try {
      let finalPhotoUrl = null;
      if (photoFile) {
        finalPhotoUrl = await uploadToR2(photoFile, "group_photos");
      }
      const memberNames = candidates.filter(m => selected.includes(m.id)).map(m => m.fullName || m.name);
      const group = await createGroup(sb, { name: name.trim(), photoUrl: finalPhotoUrl, creatorId: session.user.id, memberIds: selected, memberNames });
      notify?.("Groupe créé ✦");
      onCreated?.(group);
      onClose?.();
    } catch (e) {
      console.error("Erreur création groupe:", e);
      notify?.(`Erreur : ${e?.message || "création du groupe impossible"}`);
      submitLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        paddingTop: "calc(10px + env(safe-area-inset-top,0px))",
        borderBottom: `1px solid ${T.border}`
      }}>
        <Btn onClick={step === 2 ? () => setStep(1) : onClose} style={{ color: T.muted }}>{step === 2 ? <ChevronLeft size={22} /> : <X size={22} />}</Btn>
        <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: T.text }}>
          {step === 1 ? "Nouveau groupe" : "Détails du groupe"}
        </p>
        {step === 1 && !limitReached && (
          <Btn onClick={() => selected.length > 0 && setStep(2)} disabled={selected.length === 0}
            style={{ color: selected.length > 0 ? T.goldL : T.muted, fontWeight: 700, fontSize: 14 }}>
            Suivant ({selected.length})
          </Btn>
        )}
      </div>

      {limitReached && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 12, textAlign: "center" }}>
          <Lock size={28} color={T.muted} />
          <p style={{ margin: 0, fontSize: 15, color: T.text, fontWeight: 700 }}>Limite de groupes atteinte</p>
          <p style={{ margin: 0, fontSize: 13, color: T.muted, maxWidth: 280 }}>
            Tu es déjà propriétaire de {MAX_OWNED_GROUPS} groupes. Quitte ou supprime l'un d'eux pour pouvoir en créer un nouveau.
          </p>
        </div>
      )}

      {step === 1 && !limitReached && (
        <>
          <div style={{ padding: "10px 14px" }}>
            <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, borderRadius: 20, padding: "9px 14px", display: "flex", gap: 8, alignItems: "center" }}>
              <Search size={14} color={T.muted} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher…"
                style={{ flex: 1, background: "none", border: "none", color: T.text, fontSize: 13, outline: "none" }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {candidates.map(m => (
              <div key={m.id} onClick={() => m.__eligible && toggle(m.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                opacity: m.__eligible ? 1 : 0.4, cursor: m.__eligible ? "pointer" : "not-allowed"
              }}>
                <Av u={m} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, color: T.text }}>{m.fullName || m.name}</p>
                  {!m.__eligible && <p style={{ margin: 0, fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}><Lock size={10} /> N'accepte pas les invitations de groupe</p>}
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", border: `2px solid ${selected.includes(m.id) ? T.gold : T.border}`,
                  background: selected.includes(m.id) ? T.gold : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {selected.includes(m.id) && <Check size={13} color="#000" />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <label style={{ position: "relative", cursor: "pointer" }}>
            <div style={{
              width: 96, height: 96, borderRadius: "50%", background: "rgba(255,255,255,0.06)",
              border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center",
              backgroundImage: photoUrl ? `url(${photoUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center"
            }}>
              {!photoUrl && <Camera size={26} color={T.muted} />}
            </div>
            <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
          </label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du groupe" autoFocus
            style={{
              width: "100%", maxWidth: 320, background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`,
              borderRadius: 14, padding: "12px 16px", color: T.text, fontSize: 15, outline: "none", textAlign: "center"
            }} />
          <p style={{ fontSize: 12, color: T.muted, textAlign: "center" }}>
            {selected.length} membre{selected.length !== 1 ? "s" : ""} invité{selected.length !== 1 ? "s" : ""} — chacun devra accepter pour rejoindre le groupe
          </p>
          <Btn onClick={submit} disabled={!name.trim() || saving} style={{
            width: "100%", maxWidth: 320, padding: "13px", borderRadius: 14,
            background: name.trim() ? T.gradGold : "rgba(255,255,255,0.08)",
            color: name.trim() ? "#000" : T.muted, fontWeight: 700, fontSize: 15
          }}>
            {saving ? "Création…" : "Créer le groupe"}
          </Btn>
        </div>
      )}
    </div>
  );
}

export function AddMembersModal({ sb, T, Av, Btn, session, members, myConnections, myFollowers, group, existingMemberIds, onClose, onAdded, notify }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const excluded = useMemo(() => new Set(existingMemberIds || []), [existingMemberIds]);

  const candidates = useMemo(() => {
    const known = new Set([...(myConnections || []), ...(myFollowers || [])]);
    return (members || [])
      .filter(m => m.id !== session?.user?.id)
      .filter(m => !excluded.has(m.id))
      .filter(m => !query.trim() || (m.fullName || m.name || "").toLowerCase().includes(query.trim().toLowerCase()))
      .map(m => {
        const perm = m.group_invite_permission || "everyone";
        const eligible = perm === "everyone" || (perm === "followers" && (myConnections || []).includes(m.id));
        return { ...m, __eligible: eligible, __known: known.has(m.id) };
      })
      .sort((a, b) => (b.__known - a.__known) || (b.__eligible - a.__eligible));
  }, [members, query, myConnections, myFollowers, session?.user?.id, excluded]);

  const toggle = (uid) => setSelected(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);

  const submitLock = useRef(false);
  const submit = async () => {
    if (selected.length === 0 || submitLock.current) return;
    submitLock.current = true;
    setSaving(true);
    try {
      const memberNames = candidates.filter(m => selected.includes(m.id)).map(m => m.fullName || m.name);
      await addGroupMembers(sb, { groupId: group.id, groupName: group.name, inviterId: session.user.id, memberIds: selected, memberNames });
      notify?.(selected.length > 1 ? "Invitations envoyées ✦" : "Invitation envoyée ✦");
      onAdded?.();
      onClose?.();
    } catch (e) {
      console.error("Erreur ajout de membres:", e);
      notify?.(`Erreur : ${e?.message || "ajout de membres impossible"}`);
      submitLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 310, background: T.bg, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        paddingTop: "calc(10px + env(safe-area-inset-top,0px))",
        borderBottom: `1px solid ${T.border}`
      }}>
        <Btn onClick={onClose} style={{ color: T.muted }}><X size={22} /></Btn>
        <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: T.text }}>Ajouter des participants</p>
        <Btn onClick={submit} disabled={selected.length === 0 || saving}
          style={{ color: selected.length > 0 ? T.goldL : T.muted, fontWeight: 700, fontSize: 14 }}>
          {saving ? "…" : `Inviter (${selected.length})`}
        </Btn>
      </div>

      <div style={{ padding: "10px 14px" }}>
        <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, borderRadius: 20, padding: "9px 14px", display: "flex", gap: 8, alignItems: "center" }}>
          <Search size={14} color={T.muted} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher…"
            style={{ flex: 1, background: "none", border: "none", color: T.text, fontSize: 13, outline: "none" }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {candidates.map(m => (
          <div key={m.id} onClick={() => m.__eligible && toggle(m.id)} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
            opacity: m.__eligible ? 1 : 0.4, cursor: m.__eligible ? "pointer" : "not-allowed"
          }}>
            <Av u={m} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, color: T.text }}>{m.fullName || m.name}</p>
              {!m.__eligible && <p style={{ margin: 0, fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}><Lock size={10} /> N'accepte pas les invitations de groupe</p>}
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", border: `2px solid ${selected.includes(m.id) ? T.gold : T.border}`,
              background: selected.includes(m.id) ? T.gold : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {selected.includes(m.id) && <Check size={13} color="#000" />}
            </div>
          </div>
        ))}
        {candidates.length === 0 && (
          <p style={{ textAlign: "center", color: T.muted, fontSize: 13, marginTop: 30 }}>Personne à ajouter pour le moment</p>
        )}
      </div>
    </div>
  );
}

export function EditGroupModal({ sb, T, Av, Btn, group, actorId, onClose, onSaved, notify }) {
  const [name, setName] = useState(group.name || "");
  const [photoUrl, setPhotoUrl] = useState(group.photo_url || null);
  const [photoFile, setPhotoFile] = useState(null);
  const [announceOnly, setAnnounceOnly] = useState(!!group.announce_only);
  const [secureMode, setSecureMode] = useState(!!group.secure_mode);
  const EPH_OPTIONS = [{ value: 0, label: "Désactivé" }, { value: 86400, label: "24 heures" }, { value: 604800, label: "7 jours" }, { value: 7776000, label: "90 jours" }];
  const [ephemeralTtl, setEphemeralTtl] = useState(group.ephemeral_ttl_seconds || 0);
  const cycleEphemeral = () => { const idx = EPH_OPTIONS.findIndex(o => o.value === ephemeralTtl); setEphemeralTtl(EPH_OPTIONS[(idx + 1) % EPH_OPTIONS.length].value); };
  const [saving, setSaving] = useState(false);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const submitLock = useRef(false);
  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitLock.current) return;
    submitLock.current = true;
    setSaving(true);
    try {
      const updates = {};
      const patch = {};
      if (trimmed !== group.name) { updates.name = trimmed; patch.name = trimmed; }
      if (photoFile) {
        const newPhotoUrl = await uploadToR2(photoFile, "group_photos");
        updates.photo_url = newPhotoUrl;
        patch.photo_url = newPhotoUrl;
      }
      if (announceOnly !== !!group.announce_only) { updates.announce_only = announceOnly; patch.announce_only = announceOnly; }
      if (secureMode !== !!group.secure_mode) { updates.secure_mode = secureMode; patch.secure_mode = secureMode; }
      if (ephemeralTtl !== (group.ephemeral_ttl_seconds || 0)) { updates.ephemeral_ttl_seconds = ephemeralTtl || null; patch.ephemeral_ttl_seconds = ephemeralTtl || null; }
      if (Object.keys(updates).length > 0) {
        const { error } = await sb.from("groups").update(updates).eq("id", group.id);
        if (error) throw error;
        if (updates.name) await postSystemMessage(sb, group.id, actorId, `a changé le nom du groupe en "${updates.name}"`);
        if (updates.photo_url) await postSystemMessage(sb, group.id, actorId, "a changé la photo du groupe");
        if (updates.announce_only !== undefined) await postSystemMessage(sb, group.id, actorId, updates.announce_only ? "a activé le mode annonce" : "a désactivé le mode annonce");
        if (updates.secure_mode !== undefined) await postSystemMessage(sb, group.id, actorId, updates.secure_mode ? "a activé le mode sécurisé (captures bloquées, groupe réservé à l'app)" : "a désactivé le mode sécurisé");
        if (updates.ephemeral_ttl_seconds !== undefined) await postSystemMessage(sb, group.id, actorId, updates.ephemeral_ttl_seconds ? `a activé les messages éphémères (${EPH_OPTIONS.find(o => o.value === updates.ephemeral_ttl_seconds)?.label})` : "a désactivé les messages éphémères");
      }
      notify?.("Groupe mis à jour ✦");
      onSaved?.(patch);
    } catch (e) {
      console.error("Erreur mise à jour du groupe:", e);
      notify?.(`Erreur : ${e?.message || "mise à jour impossible"}`);
      submitLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 320, background: T.bg, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        paddingTop: "calc(10px + env(safe-area-inset-top,0px))",
        borderBottom: `1px solid ${T.border}`
      }}>
        <Btn onClick={onClose} style={{ color: T.muted }}><X size={22} /></Btn>
        <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: T.text }}>Modifier le groupe</p>
        <Btn onClick={submit} disabled={!name.trim() || saving}
          style={{ color: name.trim() ? T.goldL : T.muted, fontWeight: 700, fontSize: 14 }}>
          {saving ? "…" : "Enregistrer"}
        </Btn>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <label style={{ position: "relative", cursor: "pointer" }}>
          <div style={{
            width: 96, height: 96, borderRadius: "50%", background: "rgba(255,255,255,0.06)",
            border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center",
            backgroundImage: photoUrl ? `url(${photoUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center"
          }}>
            {!photoUrl && <Camera size={26} color={T.muted} />}
          </div>
          <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
        </label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du groupe" autoFocus
          style={{
            width: "100%", maxWidth: 320, background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`,
            borderRadius: 14, padding: "12px 16px", color: T.text, fontSize: 15, outline: "none", textAlign: "center"
          }} />
        <div onClick={() => setAnnounceOnly(v => !v)} style={{
          width: "100%", maxWidth: 320, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, cursor: "pointer"
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, color: T.text }}>Mode annonce</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted }}>Seuls les admins peuvent écrire</p>
          </div>
          <div style={{
            width: 22, height: 22, borderRadius: 6, border: `2px solid ${announceOnly ? T.gold : T.border}`,
            background: announceOnly ? T.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {announceOnly && <Check size={13} color="#000" />}
          </div>
        </div>
        <div onClick={() => setSecureMode(v => !v)} style={{
          width: "100%", maxWidth: 320, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, cursor: "pointer"
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, color: T.text }}>Mode sécurisé</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted }}>Bloque captures d'écran/vidéo (Android) et limite le groupe à l'app</p>
          </div>
          <div style={{
            width: 22, height: 22, borderRadius: 6, border: `2px solid ${secureMode ? T.gold : T.border}`,
            background: secureMode ? T.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {secureMode && <Check size={13} color="#000" />}
          </div>
        </div>
        <div onClick={cycleEphemeral} style={{
          width: "100%", maxWidth: 320, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: 14, background: T.glassMid, border: `1px solid ${T.border}`, cursor: "pointer"
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, color: T.text }}>Messages éphémères</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted }}>Supprime automatiquement les nouveaux messages du groupe</p>
          </div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.goldL }}>{EPH_OPTIONS.find(o => o.value === ephemeralTtl)?.label}</p>
        </div>
      </div>
    </div>
  );
}
/* ============================================================
   4. ÉCRAN DE CHAT DE GROUPE
   ============================================================ */

function ImageCropModal({ imageSrc, onClose, onDone }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_, cap) => setCroppedAreaPixels(cap), []);

  const handleDone = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const image = await new Promise((res, rej) => { const img = new window.Image(); img.crossOrigin = "anonymous"; img.onload = () => res(img); img.onerror = rej; img.src = imageSrc; });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const maxSize = Math.max(croppedAreaPixels.width, croppedAreaPixels.height);
      const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));
      canvas.width = safeArea; canvas.height = safeArea;
      ctx.translate(safeArea / 2, safeArea / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-safeArea / 2, -safeArea / 2);
      ctx.drawImage(image, safeArea / 2 - image.naturalWidth / 2, safeArea / 2 - image.naturalHeight / 2);
      const data = ctx.getImageData(0, 0, safeArea, safeArea);
      canvas.width = croppedAreaPixels.width; canvas.height = croppedAreaPixels.height;
      ctx.putImageData(data, Math.round(0 - safeArea / 2 + image.naturalWidth * 0.5 - croppedAreaPixels.x), Math.round(0 - safeArea / 2 + image.naturalHeight * 0.5 - croppedAreaPixels.y));
      canvas.toBlob(blob => {
        setProcessing(false);
        onDone(new File([blob], "cropped.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    } catch (e) {
      setProcessing(false);
      if (imageSrc.startsWith("blob:")) {
        const res = await fetch(imageSrc);
        const blob = await res.blob();
        onDone(new File([blob], "photo.jpg", { type: "image/jpeg" }));
      } else {
        onDone(null);
      }
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", paddingTop: "calc(12px + env(safe-area-inset-top,0px))", background: "rgba(0,0,0,0.95)", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 15, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
          <X size={18} />Garder l'originale
        </button>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#fff" }}>Recadrer</p>
        <button onClick={handleDone} disabled={processing} style={{ background: "none", border: "none", color: processing ? "rgba(201,149,42,0.4)" : "#C9952A", fontSize: 15, fontWeight: 700, cursor: processing ? "default" : "pointer", padding: "4px 0" }}>
          {processing ? "…" : "Valider ✦"}
        </button>
      </div>
      <div style={{ flex: 1, position: "relative", background: "#111" }}>
        <EasyCrop
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid={true}
          style={{
            containerStyle: { background: "#111" },
            cropAreaStyle: { border: "2px solid rgba(201,149,42,0.8)", boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" },
          }}
        />
      </div>
      <div style={{ background: "rgba(0,0,0,0.95)", padding: "14px 20px calc(14px + env(safe-area-inset-bottom,0px))", display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", minWidth: 36 }}>Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1, accentColor: "#C9952A" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", minWidth: 28, textAlign: "right" }}>{zoom.toFixed(1)}×</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", minWidth: 36 }}>Rotation</span>
          <input type="range" min={-180} max={180} step={1} value={rotation} onChange={e => setRotation(Number(e.target.value))} style={{ flex: 1, accentColor: "#C9952A" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", minWidth: 28, textAlign: "right" }}>{rotation}°</span>
        </div>
        <button onClick={() => { setZoom(1); setRotation(0); setCrop({ x: 0, y: 0 }); }} style={{ alignSelf: "center", background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "6px 16px", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

export async function toggleGroupReaction(sb, msgId, userId, emoji, currentReactions) {
  const { data: fresh } = await sb.from("group_messages").select("reactions").eq("id", msgId).single();
  const reactions = { ...(fresh?.reactions || currentReactions || {}) };
  if (reactions[userId] === emoji) delete reactions[userId];
  else reactions[userId] = emoji;
  await sb.from("group_messages").update({ reactions }).eq("id", msgId);
  return reactions;
}

export async function editGroupMessage(sb, msgId, newText) {
  return sb.from("group_messages").update({ text: newText, edited_at: new Date().toISOString() }).eq("id", msgId);
}

function GroupVoicePlayer({ src, mine, T, wf }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(wf?.d || 0);
  const [speed, setSpeed] = useState(1);
  const [bars, setBars] = useState(wf?.p ? wf.p.map(v => v / 100) : null);
  const audioRef = useRef(null);
  const barsRef = useRef(null);
  const draggingRef = useRef(false);
  const fmt = s => { if (!s || !isFinite(s) || isNaN(s)) return "0:00"; const m = Math.floor(s / 60), sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, "0")}`; };
  useEffect(() => {
    const a = new Audio();
    a.preload = "metadata";
    a.src = src;
    a.playbackRate = speed;
    audioRef.current = a;
    a.onloadedmetadata = () => { if (isFinite(a.duration)) setDuration(a.duration); };
    a.ontimeupdate = () => setProgress(a.duration && isFinite(a.duration) ? (a.currentTime / a.duration) * 100 : 0);
    a.onended = () => { setPlaying(false); setProgress(0); };
    return () => { a.pause(); a.src = ""; };
  }, [src]);
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed]);
  
    
  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); } else { a.play(); setPlaying(true); }
  };
  const cycleSpeed = e => { e.stopPropagation(); setSpeed(s => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1)); };
  const seekAtClientX = clientX => {
    const a = audioRef.current, el = barsRef.current; if (!a || !el || !duration) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    a.currentTime = pct * duration;
    setProgress(pct * 100);
  };
  const onPointerDown = e => { draggingRef.current = true; seekAtClientX(e.touches ? e.touches[0].clientX : e.clientX); };
  const onPointerMove = e => { if (!draggingRef.current) return; seekAtClientX(e.touches ? e.touches[0].clientX : e.clientX); };
  const onPointerUp = () => { draggingRef.current = false; };
  const displayBars = bars || fallbackBars(src);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", maxWidth: 220, padding: "4px 0" }}>
      <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: "50%", background: mine ? "rgba(0,0,0,0.15)" : "rgba(201,149,42,0.15)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: mine ? "#000" : T.goldL }}>
        {playing
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>}
      </button>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        <div ref={barsRef}
          onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
          style={{ display: "flex", alignItems: "center", gap: 2, height: 24, cursor: "pointer", touchAction: "none" }}>
          {displayBars.map((h, i) => {
            const barPct = (i / displayBars.length) * 100;
            const played = barPct <= progress;
            return (<div key={i} style={{ flex: 1, minWidth: 2, height: `${Math.round(h * 22) + 2}px`, borderRadius: 2, background: played ? (mine ? "rgba(0,0,0,0.55)" : T.goldL) : (mine ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)") }} />);
          })}
        </div>
        <span style={{ fontSize: 10, color: mine ? "rgba(0,0,0,0.5)" : T.muted }}>{fmt(audioRef.current?.currentTime || 0)} / {fmt(duration)}</span>
      </div>
      <button onClick={cycleSpeed} style={{ fontSize: 11, fontWeight: 700, color: mine ? "rgba(0,0,0,0.65)" : T.goldL, background: mine ? "rgba(0,0,0,0.14)" : "rgba(201,149,42,0.15)", border: "none", borderRadius: 10, padding: "3px 7px", cursor: "pointer", flexShrink: 0, lineHeight: 1.4 }}>{speed}×</button>
    </div>
  );
}

const mediaReplyLabel = (type, fileName) => {
  if (type === "photo" || type === "image") return "📷 Photo";
  if (type === "video") return "🎥 Vidéo";
  if (type === "voice") return "🎤 Message vocal";
  if (type === "sticker") return "🎨 Autocollant";
  if (type === "file") return "📎 " + (fileName || "Fichier");
  return null;
};

function GroupMessageBubble({ m, mine, T, Av, Btn, myId, showHeader, onOpenProfile, onReply, onLongPress, onDoubleTap, burstOn, onRetry, onScrollToReply, registerRef, highlighted, revealedOnce, viewedByMeIds, onRevealOnce, bubbleColor, fontSizeKey, viewOnceUrls, viewOnceTexts, revealingOnce }) {
  if (m.type === "system") {
    const senderName = m.sender ? `${m.sender.prenom || ""} ${m.sender.nom || ""}`.replace(/\s+/g, " ").trim() : "";
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
       <span style={{ fontSize: 12, fontWeight: 600, color: T.sub, background: T.glassMid, borderRadius: 12, padding: "5px 12px", textAlign: "center", maxWidth: "80%" }}>
          {senderName ? `${senderName} ` : ""}{m.text}
        </span>
      </div>
    );
  }
  return (
    <SwipeToReply message={m} onReply={onReply} mine={mine}>
      <div ref={registerRef} style={{ display: "flex", gap: 8, marginTop: showHeader ? 10 : 1, flexDirection: mine ? "row-reverse" : "row", borderRadius: 14, transition: "background .6s", background: highlighted ? "rgba(201,149,42,0.18)" : "transparent" }}>
        {!mine && (
          <div style={{ width: 28, flexShrink: 0 }}>
            {showHeader && <Av u={m.sender} size={28} onClick={() => onOpenProfile?.(m.sender_id)} />}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", maxWidth: "75%", position: "relative" }}>
          {!mine && showHeader && (
            <span onClick={() => onOpenProfile?.(m.sender_id)} style={{ fontSize: 11, fontWeight: 600, color: T.goldL, marginBottom: 2, cursor: "pointer" }}>
              {m.sender?.prenom} {m.sender?.nom}
            </span>
          )}
          <div
            {...useLongPress(() => onLongPress(m))}
            onClick={onDoubleTap}
            style={{
              padding: m.type === "photo" || m.type === "sticker" || m.type === "video" ? 3 : "9px 13px", borderRadius: 16,
              background: m.type === "sticker" ? "transparent" : (mine ? (bubbleColor || T.gradGold) : (isLightBg(T.bg) ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)")),
              color: mine ? (bubbleColor ? "#fff" : "#000") : T.text, fontSize: { small: 13, normal: 14, large: 17 }[fontSizeKey] || 14, fontWeight: 500, wordBreak: "break-word", cursor: "pointer", position: "relative"
            }}
          >
            <HeartBurst show={burstOn} />
            <MessageReplyQuote message={m} mine={mine} T={T} onClick={() => m.reply_to_id && onScrollToReply?.(m.reply_to_id)} />
            {m.type === "photo" && (
              m.view_once
                ? (mine
                    ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", color: mine ? "rgba(0,0,0,0.55)" : T.muted }}><EyeOff size={16} /><span style={{ fontSize: 12, fontWeight: 600 }}>Photo vue unique envoyée</span></div>
                    : (revealedOnce?.has(m.id)
                        ? <ProtectedImage url={viewOnceUrls?.[m.id]} />
                        : (viewedByMeIds?.has(m.id)
                            ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", color: T.muted }}><EyeOff size={16} /><span style={{ fontSize: 12, fontWeight: 600 }}>Photo vue unique consultée</span></div>
                            : <Btn onClick={e => { e.stopPropagation(); onRevealOnce?.(m.id); }} disabled={revealingOnce?.has(m.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", color: T.text, opacity: revealingOnce?.has(m.id) ? 0.6 : 1 }}><Eye size={18} /><span style={{ fontSize: 13, fontWeight: 600 }}>{revealingOnce?.has(m.id) ? "Ouverture…" : "Appuyer pour voir · vue unique"}</span></Btn>
                          )
                      )
                  )
                : (m.file_url && <img src={m.file_url} style={{ maxWidth: 220, borderRadius: 14, display: "block" }}
                    onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("celeste_view_img", { detail: { url: m.file_url } })); }} />)
            )}
            {m.type === "video" && (
              m.view_once
                ? (mine
                    ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", color: mine ? "rgba(0,0,0,0.55)" : T.muted }}><EyeOff size={16} /><span style={{ fontSize: 12, fontWeight: 600 }}>Vidéo vue unique envoyée</span></div>
                    : (revealedOnce?.has(m.id)
                        ? <ProtectedVideo url={viewOnceUrls?.[m.id]} />
                        : (viewedByMeIds?.has(m.id)
                            ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", color: T.muted }}><EyeOff size={16} /><span style={{ fontSize: 12, fontWeight: 600 }}>Vidéo vue unique consultée</span></div>
                            : <Btn onClick={e => { e.stopPropagation(); onRevealOnce?.(m.id); }} disabled={revealingOnce?.has(m.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", color: T.text, opacity: revealingOnce?.has(m.id) ? 0.6 : 1 }}><Eye size={18} /><span style={{ fontSize: 13, fontWeight: 600 }}>{revealingOnce?.has(m.id) ? "Ouverture…" : "Appuyer pour voir · vue unique"}</span></Btn>
                          )
                      )
                  )
                : (m.file_url && <video src={m.file_url} controls playsInline style={{ maxWidth: 220, maxHeight: 260, borderRadius: 14, display: "block", background: "#000" }} />)
            )}
            {m.type === "file" && m.file_url && (
              <Btn onClick={() => window.open(m.file_url, "_blank")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ display: "flex", flexShrink: 0 }}>
                  {(m.file_name || "").match(/\.(pdf|docx?)$/i) ? <FileText size={22} color={T.goldL} /> : <Paperclip size={22} color={T.goldL} />}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: mine ? "#000" : T.text, wordBreak: "break-all" }}>{m.file_name || "Fichier"}</span>
              </Btn>
            )}
            {m.type === "voice" && (
              m.view_once
                ? (mine
                    ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", color: mine ? "rgba(0,0,0,0.55)" : T.muted }}><EyeOff size={16} /><span style={{ fontSize: 12, fontWeight: 600 }}>Vocal vue unique envoyé</span></div>
                    : (revealedOnce?.has(m.id)
                        ? <GroupVoicePlayer src={viewOnceUrls?.[m.id]} mine={mine} T={T} wf={m.waveform} />
                        : (viewedByMeIds?.has(m.id)
                            ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", color: T.muted }}><EyeOff size={16} /><span style={{ fontSize: 12, fontWeight: 600 }}>Vocal vue unique consulté</span></div>
                            : <Btn onClick={e => { e.stopPropagation(); onRevealOnce?.(m.id); }} disabled={revealingOnce?.has(m.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", color: T.text, opacity: revealingOnce?.has(m.id) ? 0.6 : 1 }}><Eye size={18} /><span style={{ fontSize: 13, fontWeight: 600 }}>{revealingOnce?.has(m.id) ? "Ouverture…" : "Appuyer pour écouter · vue unique"}</span></Btn>
                          )
                      )
                  )
                : (m.file_url && <GroupVoicePlayer src={m.file_url} mine={mine} T={T} wf={m.waveform} />)
            )}
             {m.type === "sticker" && <img src={m.file_url} style={{ width: 100, height: 100, objectFit: "contain", display: "block" }} />}
            {m.type === "post_share" && (
              <div onClick={e => { e.stopPropagation(); m.shared_post_id && window.dispatchEvent(new CustomEvent("celeste_open_post", { detail: { postId: m.shared_post_id } })); }}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "8px 10px", cursor: m.shared_post_id ? "pointer" : "default", maxWidth: 240, width: "100%", boxSizing: "border-box" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {m.reply_metadata?.mediaUrl
                    ? <img src={m.reply_metadata.mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <FileText size={18} color={T.goldL} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: mine ? "rgba(0,0,0,0.55)" : T.goldL }}>
                    Publication{m.reply_metadata?.authorName ? ` de ${m.reply_metadata.authorName}` : ""}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: mine ? "rgba(0,0,0,0.6)" : T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.reply_metadata?.previewText || "Voir la publication"}
                  </p>
                </div>
              </div>
            )}
            {m.type === "text" && m.view_once
              ? (mine
                  ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", color: mine ? "rgba(0,0,0,0.55)" : T.muted }}><EyeOff size={16} /><span style={{ fontSize: 12, fontWeight: 600 }}>Message vue unique envoyé</span></div>
                  : (revealedOnce?.has(m.id)
                      ? <>{viewOnceTexts?.[m.id] || ""}</>
                      : (viewedByMeIds?.has(m.id)
                          ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", color: T.muted }}><EyeOff size={16} /><span style={{ fontSize: 12, fontWeight: 600 }}>Message vue unique consulté</span></div>
                          : <Btn onClick={e => { e.stopPropagation(); onRevealOnce?.(m.id, "text"); }} disabled={revealingOnce?.has(m.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", color: T.text, opacity: revealingOnce?.has(m.id) ? 0.6 : 1 }}><Eye size={18} /><span style={{ fontSize: 13, fontWeight: 600 }}>{revealingOnce?.has(m.id) ? "Ouverture…" : "Appuyer pour lire · vue unique"}</span></Btn>
                        )
                    )
                )
              : <>{m.type === "text" && m.text}{m.type === "text" && <EditedBadge message={m} T={T} />}</>
            }
            {m.sending && (m.type === "photo" || m.type === "video" || m.type === "file" || m.type === "voice") && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: mine ? "rgba(0,0,0,0.5)" : T.muted }}>Envoi en cours…</span>
                  <span style={{ fontSize: 9, color: mine ? "rgba(0,0,0,0.5)" : T.muted, fontWeight: 700 }}>{m.pct || 0}%</span>
                </div>
                <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${m.pct || 0}%`, background: "linear-gradient(90deg,#A855F7,#7C3AED)", borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              </div>
            )}
            {m.blocked && m.tempId && (
              <span onClick={e => { e.stopPropagation(); onRetry?.(m.tempId); }} style={{ fontSize: 10, color: "#e0a852", fontWeight: 600, cursor: "pointer" }}>🔒 Mode annonce actif — appuie pour réessayer</span>
            )}
            {m.error && m.tempId && (
              <span onClick={e => { e.stopPropagation(); onRetry?.(m.tempId); }} style={{ fontSize: 10, color: "#e05252", fontWeight: 600, cursor: "pointer" }}>⚠️ Échec — appuie pour réessayer</span>
            )}
            {m.error && !m.tempId && <span style={{ fontSize: 10, color: "#e05252", fontWeight: 600 }}>⚠️ Échec — réessaie</span>}
          </div>
          <ReactionBar reactions={m.reactions} T={T} myId={myId} mine={mine} onPress={() => onLongPress(m)} />
          {m.ts && <span style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{hm(m.ts)}</span>}
        </div>
      </div>
    </SwipeToReply>
  );
}

export function GroupChatScreen({ sb, T, Av, Btn, group, session, notify, onBack, onOpenProfile, members, myConnections, myFollowers, pushNav, popNav }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [burstMsgId, setBurstMsgId] = useState(null);
  const [groupOverride, setGroupOverride] = useState(null);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [blockedIds, setBlockedIds] = useState(() => new Set());
  const [revealedOnce, setRevealedOnce] = useState(() => new Set());
  const [viewedByMeIds, setViewedByMeIds] = useState(() => new Set());
  const [viewOnceUrls, setViewOnceUrls] = useState({});
  const [viewOnceTexts, setViewOnceTexts] = useState({});
  const [revealingOnce, setRevealingOnce] = useState(() => new Set());
  const viewOnceUrlsRef = useRef({});
  useEffect(() => () => { Object.values(viewOnceUrlsRef.current).forEach(u => { try { URL.revokeObjectURL(u); } catch {} }); }, []);
  const wipeQueueRef = useRef(new Set());
  useEffect(() => {
    return () => {
      const ids = [...wipeQueueRef.current];
      wipeQueueRef.current = new Set();
      if (ids.length) sb.from("group_messages").update({ file_url: null, text: "" }).in("id", ids).catch(() => {});
    };
  }, [group.id, sb]);
  const groupStyleRef = useRef({ bubble_color: group.bubble_color, font_size: group.font_size });
  const [bubbleColor, setBubbleColor] = useState(() => readGroupStyle(group.id, groupStyleRef.current).color);
  const [fontSizeKey, setFontSizeKey] = useState(() => readGroupStyle(group.id, groupStyleRef.current).font);
  useEffect(() => {
    const h = e => {
      if (e.detail?.convId !== group.id) return;
      const s = readGroupStyle(group.id, groupStyleRef.current); setBubbleColor(s.color); setFontSizeKey(s.font);
    };
    window.addEventListener("celeste_chat_style_change", h);
    return () => window.removeEventListener("celeste_chat_style_change", h);
  }, [group.id]);
  useEffect(() => {
    groupStyleRef.current = { bubble_color: groupOverride?.bubble_color ?? group.bubble_color, font_size: groupOverride?.font_size ?? group.font_size };
    const s = readGroupStyle(group.id, groupStyleRef.current);
    setBubbleColor(s.color); setFontSizeKey(s.font);
  }, [group.id, groupOverride?.bubble_color, groupOverride?.font_size]);
  const displayGroup = groupOverride ? { ...group, ...groupOverride } : group;
  const canWrite = !displayGroup.announce_only || isGroupAdmin;
  const bottomRef = useRef(null);
  const msgsScrollRef = useRef(null);
  const iRef = useRef(null);
  const fRef = useRef(null);
  const msgRefs = useRef({});
  const [highlightMsgId, setHighlightMsgId] = useState(null);
  const scrollToMessage = useCallback(id => {
    const el = msgRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightMsgId(id);
    setTimeout(() => setHighlightMsgId(h => (h === id ? null : h)), 1500);
  }, []);
  const [cropSrc, setCropSrc] = useState(null);
  const [cropResolve, setCropResolve] = useState(null);
  const [videoTrimSrc, setVideoTrimSrc] = useState(null);
  const [bgPhoto, setBgPhoto] = useState(null);
  const bgRef = useRef(null);
  const myId = session?.user?.id;
  const [recording, setRecording] = useState(false);
  const [recInitializing, setRecInitializing] = useState(false);
  const [recPaused, setRecPaused] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const mediaRecRef = useRef(null);
  const recTimerRef = useRef(null);
  const cancelledInitRef = useRef(false);
  const canPauseRec = typeof MediaRecorder !== "undefined" && typeof MediaRecorder.prototype.pause === "function";
  const mapQueue = q => ({ id: q.tempId, tempId: q.tempId, ...q.payload, sender_id: q.senderId, ts: q.ts, sending: q.status !== "error" && q.status !== "blocked", error: q.status === "error", blocked: q.status === "blocked" });
  const buildSendingMsgs = useCallback(() => getQueueForGroup(group.id).map(mapQueue), [group.id]);
  const [sendingMsgs, setSendingMsgs] = useState(buildSendingMsgs);
  const sendingMsgsRef = useRef(sendingMsgs);
  useEffect(() => { sendingMsgsRef.current = sendingMsgs; }, [sendingMsgs]);
  // Même protection anti-clignotement que ChatScreen (conversations 1-à-1) : une bulle
  // "en cours d'envoi" ne doit disparaître que lorsque le message confirmé équivalent
  // est déjà visible dans `msgs` — sinon on la garde affichée le temps que Realtime
  // livre la confirmation. Évite "le message disparaît puis réapparaît".
  const isConfirmedInMsgs = useCallback(m => (msgs || []).some(cm => cm.sender_id === myId && Math.abs((cm.ts || 0) - (m.ts || 0)) < 15000 && (cm.text || "") === (m.text || "") && (cm.type || "text") === (m.type || "text")), [msgs, myId]);
  useEffect(() => {
    const applyQueue = () => {
      const fresh = buildSendingMsgs();
      const freshIds = new Set(fresh.map(m => m.id));
      const stillPending = sendingMsgsRef.current.filter(m => !freshIds.has(m.id) && !isConfirmedInMsgs(m));
      setSendingMsgs([...fresh, ...stillPending].sort((a, b) => a.ts - b.ts));
    };
    applyQueue();
    return subscribeGroupQueue(applyQueue);
  }, [group.id, buildSendingMsgs, isConfirmedInMsgs]);
  useEffect(() => {
    setSendingMsgs(p => p.filter(m => {
      const stillQueued = getQueueForGroup(group.id).some(q => q.tempId === m.id);
      return stillQueued || !isConfirmedInMsgs(m);
    }));
  }, [msgs, group.id, isConfirmedInMsgs]);
  const mapFileQueue = f => ({ id: f.id, type: f.fileType, file_name: f.fileName, sender_id: myId, ts: f.ts, pct: f.pct, sending: f.status !== "error", error: f.status === "error" });
  const [sendingFiles, setSendingFiles] = useState(() => getGroupFileSendsForConv(group.id).map(mapFileQueue));
  useEffect(() => subscribeGroupFileSends(() => {
    setSendingFiles(getGroupFileSendsForConv(group.id).map(mapFileQueue));
  }), [group.id]);
  const { peerTyping, notifyTyping } = useTypingIndicator(sb, `group_${group.id}`, session);

  useEffect(() => {
    if (!group?.id || !myId) return;
    sb.from("groups").select("announce_only,secure_mode,ephemeral_ttl_seconds,bubble_color,font_size").eq("id", group.id).maybeSingle()
      .then(({ data }) => { if (data) setGroupOverride(prev => ({ ...(prev || {}), announce_only: !!data.announce_only, secure_mode: !!data.secure_mode, ephemeral_ttl_seconds: data.ephemeral_ttl_seconds || null, bubble_color: data.bubble_color || null, font_size: data.font_size || null })); });
    sb.from("group_members").select("role").eq("group_id", group.id).eq("user_id", myId).eq("status", "accepted").maybeSingle()
      .then(({ data }) => setIsGroupAdmin(data?.role === "admin" || group.created_by === myId));
    sb.from("blocks").select("blocked_id").eq("blocker_id", myId)
      .then(({ data }) => setBlockedIds(new Set((data || []).map(b => b.blocked_id))));
  }, [sb, group?.id, myId]);
  

  useEffect(() => {
    // FLAG_SECURE côté Android / preventScreenshots côté iOS : écran noir sur capture/enregistrement tant que
    // secure_mode est actif sur ce groupe, OU qu'un média vue-unique est
    // actuellement révélé à l'écran (sinon la vue unique ne protège de rien).
    // Se désactive aussi si l'admin repasse secure_mode à false pendant que le chat est ouvert.
    if (displayGroup.secure_mode || revealedOnce.size > 0) { PrivacyScreen.enable().catch(() => {}); }
    else { PrivacyScreen.disable().catch(() => {}); }
    return () => { PrivacyScreen.disable().catch(() => {}); };
  }, [displayGroup.secure_mode, revealedOnce]);

  useEffect(() => {
    // Alerte enregistrement d'écran / capture d'écran (iOS, "screenRecordingStarted"/"screenRecordingStopped"/"screenshotTaken").
    // Si un média vue-unique est révélé au moment où ça se produit, on le masque
    // immédiatement à l'écran et on prévient tout le groupe via un message système.
    let startedHandle, stoppedHandle, screenshotHandle;
    PrivacyScreen.addListener("screenRecordingStarted", () => {
      if (revealedOnce.size > 0) {
        setRevealedOnce(new Set());
        postSystemMessage(sb, group.id, myId, `${session?.user?.user_metadata?.prenom || "Un membre"} a peut-être enregistré du contenu à vue unique`);
      }
    }).then(h => { startedHandle = h; });
    PrivacyScreen.addListener("screenRecordingStopped", () => {}).then(h => { stoppedHandle = h; });
    PrivacyScreen.addListener("screenshotTaken", () => {
      if (revealedOnce.size > 0) {
        setRevealedOnce(new Set());
        postSystemMessage(sb, group.id, myId, `${session?.user?.user_metadata?.prenom || "Un membre"} a peut-être capturé du contenu à vue unique`);
      }
    }).then(h => { screenshotHandle = h; });
    return () => { startedHandle?.remove(); stoppedHandle?.remove(); screenshotHandle?.remove(); };
  }, [group.id, myId, revealedOnce, sb, session]);

  useEffect(() => {
    const ch = sb.channel(`group_deleted:${group.id}`)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "groups" }, (payload) => {
        if (payload.old?.id !== group.id) return;
        if (window.__celesteGroupDeletedByMe === group.id) return;
        notify?.(`Le groupe "${group.name}" a été supprimé`);
        onBack();
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, group.id]);
    useEffect(() => {
    const goneRef = { current: false };
    const ch = sb.channel(`group_live:${group.id}`)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "groups" }, p => { if (p.old?.id === group.id) goneRef.current = true; })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_members" }, p => {
        if (p.old?.group_id !== group.id || p.old?.user_id !== myId) return;
        if (window.__celesteLeftGroup === group.id || window.__celesteGroupDeletedByMe === group.id) return;
        setTimeout(() => {
          if (goneRef.current) return;
          notify?.(`Tu as été exclu du groupe "${group.name}"`);
          onBack();
        }, 1200);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "groups", filter: `id=eq.${group.id}` }, p => {
        setGroupOverride(prev => ({ ...(prev || {}), bubble_color: p.new.bubble_color || null, font_size: p.new.font_size || null }));
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, group.id, myId]);

  const load = useCallback(async () => {
    const { data } = await sb
      .from("group_messages")
      .select("id,sender_id,text,type,file_url,file_name,sticker_id,reply_to_id,reply_to_text,reply_to_author,reactions,edited_at,created_at,view_once,shared_post_id,reply_metadata,waveform,sender:profiles!group_messages_sender_id_fkey(id,prenom,nom,avatar_url)")
      .eq("group_id", group.id)
      .order("created_at", { ascending: true })
      .limit(300);
    const mapped = (data || []).map(m => ({ ...m, ts: new Date(m.created_at).getTime(), authorName: m.sender ? `${m.sender.prenom || ""} ${m.sender.nom || ""}`.trim() : "" }));
    setMsgs(mapped);
    const voIds = mapped.filter(m => m.view_once && m.sender_id !== myId).map(m => m.id);
    if (voIds.length) {
      const { data: views } = await sb.from("group_message_views").select("message_id").eq("viewer_id", myId).in("message_id", voIds);
      if (views?.length) setViewedByMeIds(prev => new Set([...prev, ...views.map(v => v.message_id)]));
    }
  }, [sb, group.id, myId]);

  useEffect(() => { load(); }, [load]);

  // Récupère UN message avec son auteur joint (même select que load(), mais pour un seul id) —
  // évite de recharger les 300 derniers messages à chaque réaction/édition/nouveau message.
  const fetchMessageById = useCallback(async id => {
    const { data } = await sb
      .from("group_messages")
      .select("id,sender_id,text,type,file_url,file_name,sticker_id,reply_to_id,reply_to_text,reply_to_author,reactions,edited_at,created_at,view_once,shared_post_id,reply_metadata,waveform,sender:profiles!group_messages_sender_id_fkey(id,prenom,nom,avatar_url)")
      .eq("id", id)
      .single();
    return data;
  }, [sb]);

  useEffect(() => {
    const mapOne = full => ({ ...full, ts: new Date(full.created_at).getTime(), authorName: full.sender ? `${full.sender.prenom || ""} ${full.sender.nom || ""}`.trim() : "" });
    const ch = sb.channel(`group_messages:${group.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` }, async payload => {
        const full = await fetchMessageById(payload.new.id);
        if (!full) return;
        const mapped = mapOne(full);
        setMsgs(prev => prev.some(m => m.id === mapped.id) ? prev : [...prev, mapped]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` }, async payload => {
        const full = await fetchMessageById(payload.new.id);
        if (!full) return;
        const mapped = mapOne(full);
        setMsgs(prev => prev.map(m => m.id === mapped.id ? mapped : m));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` }, payload => {
        setMsgs(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, group.id, fetchMessageById]);

  const [lastReadAt, setLastReadAt] = useState(undefined); // undefined = pas encore chargé, null = jamais lu
  const initialScrollRef = useRef(false);
  useEffect(() => {
    if (!group?.id || !myId) return;
    sb.from("group_members").select("last_read_at").eq("group_id", group.id).eq("user_id", myId).maybeSingle()
      .then(({ data }) => {
        setLastReadAt(data?.last_read_at || null);
        Promise.resolve(sb.rpc("mark_group_read", { p_group_id: group.id })).catch(() => {});
      });
  }, [sb, group?.id, myId]);

  useEffect(() => {
    processGroupQueue(sb, notify).then(load);
    const onOnline = () => processGroupQueue(sb, notify).then(load);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sb, group.id]);

  useEffect(() => {
    if (!msgs.length || lastReadAt === undefined) return;
    if (!initialScrollRef.current) {
      initialScrollRef.current = true;
      const firstUnread = lastReadAt
        ? msgs.find(m => m.sender_id !== myId && new Date(m.created_at) > new Date(lastReadAt))
        : null;
      const target = firstUnread ? msgRefs.current[firstUnread.id] : null;
      if (target) {
        target.scrollIntoView({ block: "start" });
        setHighlightMsgId(firstUnread.id);
        setTimeout(() => setHighlightMsgId(h => (h === firstUnread.id ? null : h)), 1500);
      } else {
        bottomRef.current?.scrollIntoView({ block: "end" });
      }
      return;
    }
    const lastMsg = msgs[msgs.length - 1];
    const isMine = lastMsg && lastMsg.sender_id === myId;
    const el = msgsScrollRef.current;
    const nearBottom = !el || (el.scrollHeight - el.scrollTop - el.clientHeight < 150);
    if (isMine || nearBottom) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, lastReadAt, myId]);

  useEffect(() => {
    try { const s = localStorage.getItem(`chat_bg_group_${group.id}`); if (s) setBgPhoto(s); } catch (_) {}
  }, [group.id]);

  const handleBgPhoto = e => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { setBgPhoto(ev.target.result); try { localStorage.setItem(`chat_bg_group_${group.id}`, ev.target.result); } catch (_) {} };
    r.readAsDataURL(f);
    e.target.value = "";
  };

  const [viewOnceNext, setViewOnceNext] = useState(false);
  const revealOnce = async (msgId, msgType) => {
    if (!isNative) { notify("Vue unique disponible uniquement depuis l'app iOS ou Android"); return; }
    if (revealedOnce.has(msgId) || revealingOnce.has(msgId)) return;
    setRevealingOnce(p => new Set([...p, msgId]));
    try {
      const { data, error } = await sb.functions.invoke("view-once-group-media", { body: { message_id: msgId }, headers: { "X-Celeste-Platform": Capacitor.getPlatform() } });
      if (error || !data) throw error || new Error("Contenu indisponible");
      if (msgType === "text") {
        if (typeof data.text !== "string") throw new Error("Contenu indisponible");
        setViewOnceTexts(p => ({ ...p, [msgId]: data.text }));
     } else {
        if (!data.url) throw new Error("Contenu indisponible");
        viewOnceUrlsRef.current = { ...viewOnceUrlsRef.current, [msgId]: data.url };
        setViewOnceUrls(p => ({ ...p, [msgId]: data.url }));
      }
      setRevealedOnce(p => new Set([...p, msgId]));
      wipeQueueRef.current.add(msgId);
    } catch (err) {
      notify("Impossible d'ouvrir ce contenu · " + (err?.message || "réessaie"));
    } finally {
      setRevealingOnce(p => { const n = new Set(p); n.delete(msgId); return n; });
    }
  };
  const sendViewOnceGroupText = async (t, replyPayload) => {
    const attempt = async (tries = 0) => {
      try {
        const { data: inserted, error } = await sb.from("group_messages").insert({ group_id: group.id, sender_id: myId, type: "text", text: "", view_once: true, ...replyPayload }).select("id").single();
        if (error) throw error;
        const { error: secretErr } = await sb.from("group_message_texts").insert({ message_id: inserted.id, content: t });
        if (secretErr) throw secretErr;
        load();
      } catch (err) {
        if (tries < 2) { setTimeout(() => attempt(tries + 1), 1500 * (tries + 1)); }
        else { notify("❌ Message non envoyé — vérifie ta connexion"); }
      }
    };
    attempt();
  };
  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    const wantViewOnce = viewOnceNext;
    setViewOnceNext(false);
    setText("");
    if (editingMsg) {
      setSending(true);
      await editGroupMessage(sb, editingMsg.id, t);
      setEditingMsg(null); setSending(false); return;
    }
    const replyPayload = replyTo ? { reply_to_id: replyTo.id, reply_to_text: replyTo.text || "", reply_to_author: replyTo.authorName || "" } : {};
    setReplyTo(null);
    if (wantViewOnce) { sendViewOnceGroupText(t, replyPayload); return; }
    enqueueGroupMessage(group.id, myId, { type: "text", text: t, view_once: false, ...replyPayload });
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
    processGroupQueue(sb, notify).then(load);
  };
  const retryOwnMessage = tempId => { retryGroupMessage(sb, tempId, notify).then(load); };

  const cropImage = src => new Promise(resolve => { setCropSrc(src); setCropResolve({ fn: resolve }); });

  const handleFile = async (e, isMedia) => {
    let f = e.target.files?.[0];
    if (!f) return;
    const input = e.target;
    const wantViewOnce = viewOnceNext;
    setViewOnceNext(false);
    if (f.size > 50 * 1024 * 1024) { notify?.("Fichier trop lourd (max 50MB)"); input.value = ""; return; }
    if (isMedia && f.type.startsWith("image/")) {
      const reader = new FileReader();
      const src = await new Promise(res => { reader.onload = ev => res(ev.target.result); reader.readAsDataURL(f); });
      const croppedFile = await cropImage(src);
      if (croppedFile) f = croppedFile;
    }
    if (f.type.startsWith("video/")) {
      const src = await new Promise(res => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsDataURL(f); });
      const trimData = await new Promise(resolve => setVideoTrimSrc({ src, resolve }));
      setVideoTrimSrc(null);
      if (!trimData) { input.value = ""; return; }
      if (trimData.file) f = trimData.file;
    }
    const tempId = "tmp_gfile_" + Date.now();
    const fileType = f.type.startsWith("video/") ? "video" : (isMedia ? "photo" : "file");
    const fileName = f.name;
    trackGroupFileSend(tempId, group.id, { fileType, fileName });
    input.value = "";

    const attempt = async (tries = 0) => {
      try {
        const url = await uploadToR2(f, "group_messages", pct => updateGroupFileSend(tempId, { pct }));
        const { error } = await sb.from("group_messages").insert({ group_id: group.id, sender_id: myId, type: fileType, file_url: url, file_name: fileName, text: "", view_once: wantViewOnce && fileType !== "file" });
        if (error) throw error;
        removeGroupFileSend(tempId);
        load();
      } catch (err) {
        if (tries < 2) {
          setTimeout(() => attempt(tries + 1), 1500 * (tries + 1));
        } else {
          updateGroupFileSend(tempId, { sending: false, status: "error" });
          notify?.("Échec de l'envoi — vérifie ta connexion");
        }
      }
    };
    attempt();
  };

  const sendSticker = (sticker) => {
    popNav();
    setShowStickerPicker(false);
    const replyPayload = replyTo ? { reply_to_id: replyTo.id, reply_to_text: replyTo.text || "", reply_to_author: replyTo.authorName || "" } : {};
    enqueueGroupMessage(group.id, myId, { type: "sticker", text: "", file_url: sticker.url, sticker_id: sticker.id, ...replyPayload });
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
    setReplyTo(null);
    processGroupQueue(sb, notify).then(load);
    Promise.resolve(sb.rpc("increment_sticker_usage", { sticker_id: sticker.id })).catch(() => {});
  };

  const startRecording = async () => {
    cancelledInitRef.current = false;
    const wantViewOnce = viewOnceNext;
    setViewOnceNext(false);
    const replyPayload = replyTo ? { reply_to_id: replyTo.id, reply_to_text: replyTo.text || "", reply_to_author: replyTo.authorName || "" } : {};
    setRecording(true); setRecordSecs(0); setRecInitializing(true);    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 } });
      if (cancelledInitRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 128000 } : { audioBitsPerSecond: 128000 });
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
        const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        const audioFile = new File([blob], `voice_group_${Date.now()}.${ext}`, { type: mimeType });
        const waveform = await computeWaveform(blob);
        const tempId = "tmp_gvoice_" + Date.now();
        trackGroupFileSend(tempId, group.id, { fileType: "voice", fileName: null });
        const attempt = async (tries = 0) => {
          try {
            const url = await uploadToR2(audioFile, "group_messages", pct => updateGroupFileSend(tempId, { pct }));
           
            const { error } = await sb.from("group_messages").insert({ group_id: group.id, sender_id: myId, type: "voice", file_url: url, text: "", view_once: wantViewOnce, waveform, ...replyPayload });
            if (error) throw error;
            removeGroupFileSend(tempId);
            load();
            setReplyTo(null);          } catch (err) {
            if (tries < 2) { setTimeout(() => attempt(tries + 1), 1500 * (tries + 1)); }
            else {
              updateGroupFileSend(tempId, { sending: false, status: "error" });
              notify?.("Échec de l'envoi du vocal");
            }
          }
        };
        attempt();
      };
      rec.start(250); mediaRecRef.current = rec;
      setRecInitializing(false);
      recTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch {
      setRecording(false); setRecInitializing(false);
      notify?.("Microphone non accessible");
    }
  };
  const cancelRecording = () => {
    if (mediaRecRef.current) { mediaRecRef.current.onstop = null; mediaRecRef.current.stop(); }
    else cancelledInitRef.current = true;
    clearInterval(recTimerRef.current);
    setRecording(false); setRecordSecs(0); setRecPaused(false); setRecInitializing(false);
  };
  const stopRecording = () => {
    mediaRecRef.current?.stop();
    clearInterval(recTimerRef.current);
    setRecording(false); setRecordSecs(0); setRecPaused(false);
  };
  const pauseRecording = () => {
    if (!canPauseRec || mediaRecRef.current?.state !== "recording") return;
    try { mediaRecRef.current.pause(); } catch { return; }
    clearInterval(recTimerRef.current);
    setRecPaused(true);
  };
  const resumeRecording = () => {
    if (!canPauseRec || mediaRecRef.current?.state !== "paused") return;
    try { mediaRecRef.current.resume(); } catch { return; }
    recTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    setRecPaused(false);
  };

  const doubleTap = useDoubleTap(m => {
    toggleGroupReaction(sb, m.id, myId, "❤️", m.reactions).then(load);
    setBurstMsgId(m.id); setTimeout(() => setBurstMsgId(null), 600);
  });

  const displayList = useMemo(() => {
    const visibleMsgs = msgs.filter(m => m.type === "system" || !blockedIds.has(m.sender_id));
    const withDividers = groupMessagesByDay(visibleMsgs);
    let lastSender = null;
    const mapped = withDividers.map(item => {
      if (item._divider) { lastSender = null; return item; }
      if (item.type === "system") { lastSender = null; return { ...item, showHeader: false }; }
      const showHeader = lastSender !== item.sender_id;
      lastSender = item.sender_id;
      return { ...item, showHeader };
    });
    return [...mapped, ...sendingMsgs.map(m => ({ ...m, showHeader: true })), ...sendingFiles.map(f => ({ ...f, showHeader: true }))];
  }, [msgs, blockedIds, sendingMsgs, sendingFiles]);

  if (displayGroup.secure_mode && !isNative && !isGroupAdmin) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 260, background: "#000", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", paddingTop: "calc(10px + env(safe-area-inset-top,0px))", borderBottom: `1px solid ${T.border}` }}>
          <Btn onClick={onBack} style={{ color: T.gold }}><ChevronLeft size={22} /></Btn>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 30 }}>
          <Lock size={32} color={T.goldL} />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text, textAlign: "center" }}>Groupe privé et sécurisé</p>
          <p style={{ margin: 0, fontSize: 13, color: T.muted, textAlign: "center" }}>L'admin a activé le mode sécurisé — ce groupe n'est accessible que depuis l'app Céleste.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 250, display: "flex", flexDirection: "column",
      backgroundImage: `linear-gradient(${isLightBg(T.bg) ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.6)"},${isLightBg(T.bg) ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.6)"}),url(${isLightBg(T.bg) ? previewLight : previewDark})`,
      backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat"
    }}>
      {bgPhoto && <div style={{ position: "absolute", inset: 0, zIndex: 0, backgroundImage: `url(${bgPhoto})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.35, pointerEvents: "none" }} />}
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onClose={() => { setCropSrc(null); cropResolve?.fn(null); setCropResolve(null); }}
          onDone={file => { setCropSrc(null); cropResolve?.fn(file); setCropResolve(null); }}
        />
      )}
      {videoTrimSrc && (
        <VideoTrimModal
          videoSrc={videoTrimSrc.src}
          maxDuration={600}
          onClose={() => { const r = videoTrimSrc.resolve; setVideoTrimSrc(null); r(null); }}
          onDone={data => { videoTrimSrc.resolve(data); }}
        />
      )}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        paddingTop: "calc(10px + env(safe-area-inset-top,0px))",
        borderBottom: `1px solid ${T.border}`, background: "rgba(0,0,0,0.92)"
      }}>
        <Btn onClick={onBack} style={{ color: T.gold }}><ChevronLeft size={22} /></Btn>
        <div onClick={() => { pushNav(() => setShowGroupInfo(false)); setShowGroupInfo(true); }} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}>
          <Av u={{ name: displayGroup.name, avatar_url: displayGroup.photo_url, initials: (displayGroup.name || "?").slice(0, 2).toUpperCase(), color: "#888" }} size={34} />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>{displayGroup.name}</p>
        </div>
        <input ref={bgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBgPhoto} />
        <Btn onClick={() => bgRef.current?.click()} style={{ color: T.muted, padding: "6px", display: "flex", alignItems: "center" }}><ImageIcon size={18} /></Btn>
      </div>

      <div ref={msgsScrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 12px" }}>
        {displayList.map(item =>
          item._divider
            ? <DayDivider key={item.key} label={item.label} T={T} />
            : (
              <GroupMessageBubble
                key={item.id} m={item} mine={item.sender_id === myId} T={T} Av={Av} Btn={Btn} myId={myId}
                showHeader={item.showHeader} onOpenProfile={onOpenProfile}
                onReply={m => setReplyTo({ ...m, text: m.text || mediaReplyLabel(m.type, m.file_name) || "" })}
                onLongPress={m => { pushNav(() => setActionMsg(null)); setActionMsg(m); }}
                onDoubleTap={() => doubleTap(item)}
                burstOn={burstMsgId === item.id}
                onRetry={retryOwnMessage}
                onScrollToReply={scrollToMessage}
                registerRef={el => { if (el) msgRefs.current[item.id] = el; }}
                highlighted={highlightMsgId === item.id}
                revealedOnce={revealedOnce}
                viewedByMeIds={viewedByMeIds}
                onRevealOnce={revealOnce}
                bubbleColor={bubbleColor}
                fontSizeKey={fontSizeKey}
                viewOnceUrls={viewOnceUrls}
                viewOnceTexts={viewOnceTexts}
                revealingOnce={revealingOnce}
              />
            )
        )}
        <div ref={bottomRef} />
      </div>

      {peerTyping && <TypingIndicator T={T} userName="Quelqu'un" />}
      <ReplyComposerBar replyTo={replyTo} T={T} onCancel={() => setReplyTo(null)} />

      {canWrite ? (
      <div style={{ display: "flex", gap: 8, padding: "10px 12px", paddingBottom: "calc(10px + env(safe-area-inset-bottom,0px) + var(--kb-height,0px))", borderTop: `1px solid ${T.border}`, position: "relative" }}>
        <input type="file" accept="image/*,video/*" ref={iRef} style={{ display: "none" }} onChange={e => handleFile(e, true)} />
        <input type="file" accept="*/*" ref={fRef} style={{ display: "none" }} onChange={e => handleFile(e, false)} />
        {!recording && (<>
        <Btn onClick={() => iRef.current?.click()} style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>
          <Camera size={20} />
        </Btn>
        <Btn onClick={() => notify("Vue unique indisponible pour le moment (en travaux)")} style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>
          <Eye size={20} />
        </Btn>
        <Btn onClick={() => fRef.current?.click()} style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>
          <Paperclip size={20} />
        </Btn>
        <Btn onClick={() => { if (showStickerPicker) { popNav(); setShowStickerPicker(false); } else { pushNav(() => setShowStickerPicker(false)); setShowStickerPicker(true); } }} style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: showStickerPicker ? T.goldL : T.muted }}>
          <Smile size={20} />
        </Btn>
        {showStickerPicker && (
          <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, zIndex: 40 }}>
            <StickerPicker sb={sb} userId={myId} T={T} onClose={() => { popNav(); setShowStickerPicker(false); }} onSelect={sendSticker} />
          </div>
        )}
        </>)}
        {recording ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(200,64,64,0.08)", border: `1px solid ${T.err || "#c84040"}44`, borderRadius: 20, padding: "10px 12px", flex: 1, minWidth: 0 }}>
            <span style={{ flex: 1, color: T.err || "#c84040", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.err || "#c84040", display: "inline-block" }} />
              {recInitializing ? "Connexion micro…" : `${recordSecs}s${recPaused ? " (pause)" : ""}`}
            </span>
            {canPauseRec && (
              <Btn onClick={recPaused ? resumeRecording : pauseRecording} disabled={recInitializing} style={{ color: T.err || "#c84040", padding: "8px", display: "flex", alignItems: "center", opacity: recInitializing ? 0.4 : 1 }}>
                {recPaused ? <Play size={18} /> : <Pause size={18} />}
              </Btn>
            )}
            <Btn onClick={cancelRecording} style={{ color: T.err || "#c84040", padding: "8px", display: "flex", alignItems: "center" }}><Trash2 size={20} /></Btn>
            <Btn onClick={stopRecording} disabled={recInitializing} style={{ background: T.gradGold, borderRadius: 20, padding: "8px 16px", color: "#000", fontWeight: 700, fontSize: 13, opacity: recInitializing ? 0.5 : 1 }}>Envoyer</Btn>
          </div>
        ) : (
          <>
            <input
              value={text}
              onChange={e => { setText(e.target.value); notifyTyping(); }}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder={editingMsg ? "Modifier le message…" : "Message…"}
              style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, borderRadius: 20, padding: "10px 16px", color: T.text, fontSize: 14, outline: "none" }}
            />
            {text.trim()
              ? (
                <Btn onClick={send} style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: T.gradGold, color: "#000", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Send size={17} />
                </Btn>
              ) : (
                <Btn onClick={startRecording} style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)", color: T.muted, display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Mic size={17} />
                </Btn>
              )}
          </>
        )}
      </div>
      ) : (
      <div style={{ padding: "12px 16px", paddingBottom: "calc(12px + env(safe-area-inset-bottom,0px))", borderTop: `1px solid ${T.border}`, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 12, color: T.muted }}>Seuls les admins peuvent envoyer des messages dans ce groupe</p>
      </div>
      )}

      {actionMsg && (
        <div style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }} onClick={() => { popNav(); setActionMsg(null); }}>
          <div style={{ width: "100%", background: "#111", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "16px 0 24px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", gap: 14, padding: "0 16px 14px", borderBottom: `1px solid ${T.border}` }}>
              {QUICK_REACTIONS.map(em => (
                <span key={em} onClick={() => { toggleGroupReaction(sb, actionMsg.id, myId, em, actionMsg.reactions).then(load); popNav(); setActionMsg(null); }} style={{ fontSize: 24, cursor: "pointer" }}>{em}</span>
              ))}
            </div>
            <div onClick={() => { setReplyTo(actionMsg ? { ...actionMsg, text: actionMsg.text || mediaReplyLabel(actionMsg.type, actionMsg.file_name) || "" } : null); popNav(); setActionMsg(null); }} style={{ padding: "14px 20px", fontSize: 15, color: T.text, cursor: "pointer" }}>Répondre</div>
            {actionMsg.sender_id === myId && actionMsg.type === "text" && (
              <div onClick={() => { setEditingMsg(actionMsg); setText(actionMsg.text); popNav(); setActionMsg(null); }} style={{ padding: "14px 20px", fontSize: 15, color: T.text, cursor: "pointer" }}>Modifier</div>
            )}
            {actionMsg.sender_id === myId && (
              <div onClick={async () => { await sb.from("group_messages").delete().eq("id", actionMsg.id); popNav(); setActionMsg(null); load(); }} style={{ padding: "14px 20px", fontSize: 15, color: T.err || "#c84040", cursor: "pointer" }}>Supprimer</div>
            )}
          </div>
        </div>
      )}
      {showGroupInfo && (
        <GroupInfoScreen sb={sb} T={T} Av={Av} Btn={Btn} group={displayGroup} session={session} notify={notify}
          allMembers={members} myConnections={myConnections} myFollowers={myFollowers}
          onGroupUpdated={patch => setGroupOverride(prev => ({ ...(prev || {}), ...patch }))}
          onOpenProfile={onOpenProfile}
          pushNav={pushNav} popNav={popNav}
          onBack={() => { popNav(); setShowGroupInfo(false); }}
          onLeftGroup={() => { popNav(); setShowGroupInfo(false); onBack(); }}
          onDeletedGroup={() => { popNav(); setShowGroupInfo(false); onBack(); }}
        />
      )}
    </div>
  );
}
/* ============================================================
   5. INFOS DU GROUPE (quitter / supprimer / signaler)
   ============================================================ */

const GROUP_REPORT_REASONS = ["Contenu inapproprié", "Spam", "Harcèlement", "Fausses informations", "Autre"];

function ConfirmSheet({ T, Btn, title, text, confirmLabel, onCancel, onConfirm }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 280, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }} onClick={onCancel}>
      <div style={{ width: "100%", background: "#111", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "20px 20px 30px" }} onClick={e => e.stopPropagation()}>
        <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: T.text }}>{title}</p>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: T.muted }}>{text}</p>
        <Btn onClick={onConfirm} style={{ width: "100%", padding: "13px", borderRadius: 14, background: T.err || "#c84040", color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{confirmLabel}</Btn>
        <Btn onClick={onCancel} style={{ width: "100%", padding: "13px", borderRadius: 14, background: "rgba(255,255,255,0.06)", color: T.text, fontSize: 15 }}>Annuler</Btn>
      </div>
    </div>
  );
}

function ReportSheet({ T, reasons, onClose, onSubmit }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 280, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ width: "100%", background: "#111", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "20px 0 30px" }} onClick={e => e.stopPropagation()}>
        <p style={{ margin: "0 20px 14px", fontSize: 16, fontWeight: 700, color: T.text }}>Motif du signalement</p>
        {reasons.map(r => (
          <div key={r} onClick={() => onSubmit(r, "")} style={{ padding: "14px 20px", fontSize: 15, color: T.text, cursor: "pointer" }}>{r}</div>
        ))}
      </div>
    </div>
  );
}

function MemberActionSheet({ T, member, onPromote, onDemote, onKick, onProfile, onClose }) {
  const memberIsAdmin = member.role === "admin";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 290, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ width: "100%", background: "#111", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "20px 0 30px" }} onClick={e => e.stopPropagation()}>
        <p style={{ margin: "0 20px 14px", fontSize: 16, fontWeight: 700, color: T.text }}>{member.profiles?.prenom} {member.profiles?.nom}</p>
        <div onClick={onProfile} style={{ padding: "14px 20px", fontSize: 15, color: T.text, cursor: "pointer" }}>Voir le profil</div>
        <div onClick={memberIsAdmin ? onDemote : onPromote} style={{ padding: "14px 20px", fontSize: 15, color: T.text, cursor: "pointer" }}>
          {memberIsAdmin ? "Retirer le rôle admin" : "Promouvoir admin"}
        </div>
        <div onClick={onKick} style={{ padding: "14px 20px", fontSize: 15, color: T.err || "#c84040", cursor: "pointer" }}>
          Exclure du groupe
        </div>
      </div>
    </div>
  );
}

function GroupSharedMediaScreen({ T, Btn, group, sb, onBack }) {
  const [items, setItems] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);

  useEffect(() => {
    if (!group?.id) return;
    sb.from("group_messages").select("id,type,file_url,created_at")
      .eq("group_id", group.id).in("type", ["photo", "video"]).eq("view_once", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
  }, [group?.id, sb]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 280, background: T.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", paddingTop: "calc(10px + env(safe-area-inset-top,0px))", borderBottom: `1px solid ${T.border}` }}>
        <Btn onClick={onBack} style={{ color: T.gold }}><ChevronLeft size={22} /></Btn>
        <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: T.text }}>Médias partagés</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 2 }}>
        {items === null ? (
          <p style={{ textAlign: "center", color: T.muted, fontSize: 13, marginTop: 40 }}>Chargement…</p>
        ) : items.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "60px 0", color: T.muted }}>
            <Grid size={28} />
            <span style={{ fontSize: 13 }}>Aucun média partagé pour l'instant</span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {items.map(it => (
              <div key={it.id} onClick={() => it.type === "video" ? setPlayingVideo(it.file_url) : window.dispatchEvent(new CustomEvent("celeste_view_img", { detail: { url: it.file_url } }))}
                style={{ position: "relative", aspectRatio: "1", cursor: "pointer", background: T.glassMid }}>
                {it.type === "video"
                  ? <video src={it.file_url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} muted />
                  : <img src={it.file_url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                }
                {it.type === "video" && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "9px solid #fff", marginLeft: 2 }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {playingVideo && (
        <div onClick={() => setPlayingVideo(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <video src={playingVideo} controls autoPlay playsInline style={{ maxWidth: "100%", maxHeight: "100%" }} onClick={e => e.stopPropagation()} />
          <Btn onClick={() => setPlayingVideo(null)} style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top,0px))", right: 14, color: "#fff", padding: 8 }}><X size={26} /></Btn>
        </div>
      )}
    </div>
  );
}
export function GroupInfoScreen({ sb, T, Av, Btn, group, session, notify, onBack, onLeftGroup, onDeletedGroup, allMembers, myConnections, myFollowers, onGroupUpdated, onOpenProfile, pushNav, popNav }) {
  const [members, setMembers] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionMember, setActionMember] = useState(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [muted, setMuted] = useState(() => isGroupMuted(group.id));
  const [pinned, setPinned] = useState(() => isGroupPinned(group.id));
  const [showTheme, setShowTheme] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const myId = session?.user?.id;
  const [createdBy, setCreatedBy] = useState(group.created_by || null);
  const [groupStyle, setGroupStyle] = useState({ bubble_color: group.bubble_color || null, font_size: group.font_size || null });
  useEffect(() => {
    sb.from("groups").select("created_by,bubble_color,font_size").eq("id", group.id).maybeSingle()
      .then(({ data }) => { if (data?.created_by) setCreatedBy(data.created_by); if (data) setGroupStyle({ bubble_color: data.bubble_color || null, font_size: data.font_size || null }); });
  }, [sb, group.id]);
  const isCreator = createdBy === myId;
  const myMembership = members.find(m => m.user_id === myId);
  const isAdmin = isCreator || myMembership?.role === "admin";

  const loadMembers = useCallback(() => {
    sb.from("group_members").select("user_id,role,profiles:user_id(id,prenom,nom,avatar_url)").eq("group_id", group.id).eq("status", "accepted")
      .then(({ data }) => setMembers(data || []));
  }, [sb, group.id]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  const promote = async (uid) => {
    const tp = members.find(m => m.user_id === uid)?.profiles;
    const targetName = tp ? `${tp.prenom || ""} ${tp.nom || ""}`.trim() : "";
    await sb.from("group_members").update({ role: "admin" }).eq("group_id", group.id).eq("user_id", uid);
    popNav();
    setActionMember(null);
    notify?.("Membre promu admin ✦");
    if (targetName) postSystemMessage(sb, group.id, myId, `a promu ${targetName} admin`);
    loadMembers();
  };
  const demote = async (uid) => {
    const tp = members.find(m => m.user_id === uid)?.profiles;
    const targetName = tp ? `${tp.prenom || ""} ${tp.nom || ""}`.trim() : "";
    await sb.from("group_members").update({ role: "member" }).eq("group_id", group.id).eq("user_id", uid);
    popNav();
    setActionMember(null);
    notify?.("Rôle admin retiré");
    if (targetName) postSystemMessage(sb, group.id, myId, `a retiré le rôle admin à ${targetName}`);
    loadMembers();
  };
    const kick = async (uid) => {
    const tp = members.find(m => m.user_id === uid)?.profiles;
    const targetName = tp ? `${tp.prenom || ""} ${tp.nom || ""}`.trim() : "";
    const { data: removed, error } = await sb.from("group_members").delete().eq("group_id", group.id).eq("user_id", uid).select("user_id");
    popNav();
    setActionMember(null);
    if (error || !removed?.length) { notify?.("Impossible d'exclure ce membre"); console.error("Erreur kick:", error); return; }
    notify?.("Membre exclu du groupe");
    if (targetName) postSystemMessage(sb, group.id, myId, `a exclu ${targetName} du groupe`);
    sb.from("notifications").insert({ user_id: uid, from_id: myId, type: "group_removed", text: group.name, read: false })
      .then(({ error: nErr }) => { if (nErr) console.error("Notif exclusion non envoyée:", nErr); });
    sb.functions.invoke("send-push", { body: { targetUserId: uid, title: "Retiré du groupe", body: `Tu as été exclu du groupe "${group.name}"` } });
    loadMembers();
  };

  const leave = async () => {
    popNav();
    setConfirmLeave(false);
    // Le message système doit être posté AVANT la suppression : une fois la ligne
    // group_members supprimée, la policy RLS sur group_messages (réservée aux
    // membres acceptés) bloque l'insertion et personne n'est prévenu.
    await postSystemMessage(sb, group.id, myId, "a quitté le groupe");
    window.__celesteLeftGroup = group.id;
    const { error } = await sb.from("group_members").delete().eq("group_id", group.id).eq("user_id", myId);
    if (error) { notify?.("Impossible de quitter le groupe"); console.error("Erreur leave:", error); return; }
    notify?.("Tu as quitté le groupe");
    onLeftGroup?.();
  };

    const remove = async () => {
    popNav();
    setConfirmDelete(false);
    const { data: others } = await sb.from("group_members").select("user_id").eq("group_id", group.id).neq("user_id", myId);
    const targetIds = (others || []).map(r => r.user_id);
    window.__celesteGroupDeletedByMe = group.id;
    const { data: deleted, error } = await sb.from("groups").delete().eq("id", group.id).select("id");
    if (error || !deleted?.length) {
      window.__celesteGroupDeletedByMe = null;
      notify?.("Impossible de supprimer le groupe");
      console.error("Erreur remove:", error || "aucune ligne supprimée (RLS ?)");
      return;
    }
    if (targetIds.length) {
      const { error: nErr } = await sb.from("notifications").insert(
        targetIds.map(uid => ({ user_id: uid, from_id: myId, type: "group_deleted", text: group.name, read: false }))
      );
      if (nErr) console.error("Notif suppression non envoyée:", nErr);
      targetIds.forEach(uid => {
        sb.functions.invoke("send-push", { body: { targetUserId: uid, title: "Groupe supprimé", body: `Le groupe "${group.name}" a été supprimé` } });
      });
    }
    notify?.("Groupe supprimé");
    onDeletedGroup?.();
  };

  const submitReport = async (reason) => {
    await sb.from("reports").insert({ reporter_id: myId, reported_id: createdBy, group_id: group.id, reason });
    popNav();
    setShowReport(false);
    notify?.("Signalement envoyé ✦");
  };

  if (showTheme) return <ChatPersonalizationScreen T={T} Btn={Btn} conv={group} groupDefault={groupStyle}
    onSaveDefault={isAdmin ? (patch) => { setGroupStyle(p => ({ ...p, ...patch })); sb.from("groups").update(patch).eq("id", group.id).then(({ error }) => { if (error) { console.error("Style groupe non enregistré:", error); notify?.("Impossible d'enregistrer le style du groupe"); } }); } : undefined}
    onBack={() => { popNav(); setShowTheme(false); }} />;
  if (showMedia) return <GroupSharedMediaScreen T={T} Btn={Btn} group={group} sb={sb} onBack={() => { popNav(); setShowMedia(false); }} />;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 270, background: T.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", paddingTop: "calc(10px + env(safe-area-inset-top,0px))", borderBottom: `1px solid ${T.border}` }}>
        <Btn onClick={onBack} style={{ color: T.gold }}><ChevronLeft size={22} /></Btn>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 0 40px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 20px 20px" }}>
          <div onClick={() => { if (!isAdmin) return; pushNav(() => setShowEditGroup(false)); setShowEditGroup(true); }} style={{ cursor: isAdmin ? "pointer" : "default", position: "relative" }}>
            <Av u={{ name: group.name, avatar_url: group.photo_url, initials: (group.name || "?").slice(0, 2).toUpperCase(), color: "#888" }} size={92} />
            {isAdmin && (
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: T.gradGold, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #000" }}>
                <Camera size={13} color="#000" />
              </div>
            )}
          </div>
          <p style={{ margin: "14px 0 2px", fontSize: 19, fontWeight: 700, color: T.text, textAlign: "center" }}>{group.name}</p>
          {isAdmin && (
            <p onClick={() => { pushNav(() => setShowEditGroup(false)); setShowEditGroup(true); }} style={{ margin: "0 0 4px", fontSize: 12, color: T.goldL, cursor: "pointer" }}>Modifier le groupe</p>
          )}
          <p style={{ margin: 0, fontSize: 13, color: T.muted }}>Groupe · {members.length} membre{members.length !== 1 ? "s" : ""}</p>
          {group.secure_mode && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
              <Lock size={12} color={T.goldL} />
              <p style={{ margin: 0, fontSize: 12, color: T.goldL, fontWeight: 600 }}>Groupe privé et sécurisé</p>
            </div>
          )}
        </div>

        <div style={{ padding: "0 20px 16px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Paramètres</p>
          <div style={{ borderRadius: 14, background: T.glassMid, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            <div onClick={async () => { const next = !muted; try { await toggleGroupMute(sb, myId, group.id, next); setMuted(next); } catch { notify?.("Impossible de changer la sourdine"); } }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", cursor: "pointer", borderBottom: `1px solid ${T.border}` }}>
              {muted ? <BellOff size={18} color={T.muted} /> : <Bell size={18} color={T.muted} />}
              <p style={{ margin: 0, fontSize: 14, color: T.text, flex: 1 }}>Mettre en sourdine</p>
              <div style={{ width: 40, height: 24, borderRadius: 12, background: muted ? T.gradGold : (isLightBg(T.bg) ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)"), position: "relative", transition: "background .2s" }}>
                <div style={{ position: "absolute", top: 2, left: muted ? 18 : 2, width: 20, height: 20, borderRadius: "50%", background: muted ? "#000" : "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.35)" }} />
              </div>
            </div>
            <div onClick={() => setPinned(toggleGroupPin(group.id))} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", cursor: "pointer", borderBottom: `1px solid ${T.border}` }}>
              <Pin size={18} color={T.muted} />
              <p style={{ margin: 0, fontSize: 14, color: T.text, flex: 1 }}>Épingler le groupe</p>
              <div style={{ width: 40, height: 24, borderRadius: 12, background: pinned ? T.gradGold : (isLightBg(T.bg) ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)"), position: "relative", transition: "background .2s" }}>
                <div style={{ position: "absolute", top: 2, left: pinned ? 18 : 2, width: 20, height: 20, borderRadius: "50%", background: pinned ? "#000" : "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.35)" }} />
              </div>
            </div>
            <div onClick={() => { pushNav(() => setShowTheme(false)); setShowTheme(true); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", cursor: "pointer" }}>
              <Sparkles size={18} color={T.muted} />
              <p style={{ margin: 0, fontSize: 14, color: T.text, flex: 1 }}>Personnaliser</p>
              <ChevronRight size={16} color={T.muted} />
            </div>
          </div>
        </div>

        {isAdmin && (
          <div onClick={() => { pushNav(() => setShowAddMembers(false)); setShowAddMembers(true); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: "pointer", borderTop: `1px solid ${T.border}` }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(201,149,42,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserPlus size={18} color={T.goldL} />
            </div>
            <p style={{ margin: 0, fontSize: 14, color: T.goldL, fontWeight: 600 }}>Ajouter des participants</p>
          </div>
        )}
        <div style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
          {members.map(m => {
            const canManage = isAdmin && m.user_id !== myId;
            return (
              <div key={m.user_id} onClick={() => { if (!canManage) return; pushNav(() => setActionMember(null)); setActionMember(m); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: canManage ? "pointer" : "default" }}>
                <Av u={m.profiles} size={40} onClick={canManage ? undefined : (e => { e.stopPropagation(); onOpenProfile?.(m.user_id); })} />
                <p onClick={canManage ? undefined : (e => { e.stopPropagation(); onOpenProfile?.(m.user_id); })}
                  style={{ margin: 0, fontSize: 14, color: T.text, flex: 1, cursor: "pointer" }}>{m.profiles?.prenom} {m.profiles?.nom}</p>
                {m.role === "admin" && <span style={{ fontSize: 11, color: T.goldL, marginRight: canManage ? 4 : 0 }}>Admin</span>}
                {canManage && <ChevronRight size={14} color={T.muted} />}
              </div>
            );
          })}
        </div>

        <div onClick={() => { pushNav(() => setShowMedia(false)); setShowMedia(true); }} style={{ padding: "20px", cursor: "pointer" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Médias partagés</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 0", color: T.muted }}>
            <Grid size={20} />
            <span style={{ fontSize: 13 }}>Voir les photos et vidéos</span>
            <ChevronRight size={16} />
          </div>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {!isCreator && (
            <>
              <Btn onClick={() => { pushNav(() => setShowReport(false)); setShowReport(true); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "13px 16px", borderRadius: 14, background: T.glassMid, border: `1px solid ${T.border}`, color: T.text, fontSize: 15, textAlign: "left" }}>
                <Flag size={17} />
                Signaler le groupe
              </Btn>
              <Btn onClick={() => { pushNav(() => setConfirmLeave(false)); setConfirmLeave(true); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "13px 16px", borderRadius: 14, background: "rgba(200,64,64,0.1)", border: "1px solid rgba(200,64,64,0.25)", color: T.err || "#c84040", fontSize: 15, textAlign: "left" }}>
                <LogOut size={17} />
                Quitter le groupe
              </Btn>
            </>
          )}
          {isCreator && (
            <Btn onClick={() => { pushNav(() => setConfirmDelete(false)); setConfirmDelete(true); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "13px 16px", borderRadius: 14, background: "rgba(200,64,64,0.1)", border: "1px solid rgba(200,64,64,0.25)", color: T.err || "#c84040", fontSize: 15, textAlign: "left" }}>
                <Trash2 size={17} />
                Supprimer le groupe
              </Btn>
          )}
        </div>
      </div>

      {confirmLeave && <ConfirmSheet T={T} Btn={Btn} title="Quitter le groupe ?" text="Tu ne recevras plus les messages de ce groupe." confirmLabel="Quitter" onCancel={() => { popNav(); setConfirmLeave(false); }} onConfirm={leave} />}
      {confirmDelete && <ConfirmSheet T={T} Btn={Btn} title="Supprimer le groupe ?" text="Cette action est définitive pour tous les membres." confirmLabel="Supprimer" onCancel={() => { popNav(); setConfirmDelete(false); }} onConfirm={remove} />}
      {showReport && <ReportSheet T={T} reasons={GROUP_REPORT_REASONS} onClose={() => { popNav(); setShowReport(false); }} onSubmit={submitReport} />}
      {actionMember && (
        <MemberActionSheet T={T} member={actionMember} onClose={() => { popNav(); setActionMember(null); }}
          onPromote={() => promote(actionMember.user_id)}
          onDemote={() => demote(actionMember.user_id)}
          onKick={() => kick(actionMember.user_id)}
          onProfile={() => { const uid = actionMember.user_id; popNav(); setActionMember(null); onOpenProfile?.(uid); }}
        />
      )}
      {showAddMembers && (
        <AddMembersModal sb={sb} T={T} Av={Av} Btn={Btn} session={session} group={group}
          members={allMembers} myConnections={myConnections} myFollowers={myFollowers}
          existingMemberIds={members.map(m => m.user_id)}
          onClose={() => { popNav(); setShowAddMembers(false); }}
          onAdded={loadMembers}
          notify={notify}
        />
      )}
      {showEditGroup && (
        <EditGroupModal sb={sb} T={T} Av={Av} Btn={Btn} group={group} actorId={myId}
          onClose={() => { popNav(); setShowEditGroup(false); }}
          onSaved={patch => { popNav(); setShowEditGroup(false); onGroupUpdated?.(patch); }}
          notify={notify}
        />
      )}
      </div>
  );
}
/* ============================================================
   6. INVITATIONS DE GROUPE EN ATTENTE
   ============================================================ */

export function usePendingGroupInvites(sb, userId) {
  const [invites, setInvites] = useState([]);
  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await sb
      .from("group_members")
      .select("group_id,invited_by,groups(id,name,photo_url),inviter:profiles!group_members_invited_by_fkey(id,prenom,nom)")
      .eq("user_id", userId)
      .eq("status", "pending");
    setInvites(data || []);
  }, [sb, userId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!userId) return;
    const ch = sb.channel(`group_invites_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, userId, load]);
  return { invites, reloadInvites: load };
}

export function PendingGroupInviteCard({ sb, T, Av, Btn, invite, userId, notify }) {
  const g = invite.groups;
  const respond = async (accept) => {
    if (accept) {
      await sb.from("group_members").update({ status: "accepted" }).eq("group_id", invite.group_id).eq("user_id", userId);
      notify?.(`Tu as rejoint "${g.name}" ✦`);
    } else {
      const { data: me } = await sb.from("profiles").select("prenom,nom").eq("id", userId).maybeSingle();
      const myName = me ? `${me.prenom || ""} ${me.nom || ""}`.trim() : "";
      await sb.from("group_members").delete().eq("group_id", invite.group_id).eq("user_id", userId);
      if (invite.invited_by) {
        const { error: notifErr } = await sb.from("notifications").insert({
          user_id: invite.invited_by, type: "group_invite_declined", from_id: userId,
          group_id: invite.group_id, text: g?.name || "", read: false,
        });
        if (notifErr) console.error("Notif refus non envoyée:", notifErr);
      }
      notify?.("Invitation refusée");
    }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
      <Av u={{ name: g?.name, avatar_url: g?.photo_url, initials: (g?.name || "?").slice(0, 2).toUpperCase(), color: "#888" }} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.text }}>{g?.name}</p>
        <p style={{ margin: 0, fontSize: 12, color: T.muted }}>Invité par {invite.inviter?.prenom} {invite.inviter?.nom}</p>
      </div>
      <Btn onClick={() => respond(true)} style={{ padding: "7px 14px", borderRadius: 10, background: T.gradGold, color: "#000", fontSize: 12, fontWeight: 700 }}>Accepter</Btn>
      <Btn onClick={() => respond(false)} style={{ padding: "7px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: T.muted, fontSize: 12 }}>Refuser</Btn>
    </div>
  );
}