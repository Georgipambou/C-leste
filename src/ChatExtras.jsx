// ChatExtras.jsx
// Module additif pour la messagerie Céleste — réactions, réponses, statut "en train d'écrire",
// édition de message, recherche, séparateurs de jour, double-tap "like".
// Aucune dépendance directe sur App.jsx : tout reçoit sb/T/Btn/Av/session en paramètres.
// => zéro risque de casser l'existant, simple import dans App.jsx.

import { useState, useEffect, useRef, useCallback } from "react";
import { useSignedMediaList } from "./privateMedia";
import {
  ChevronLeft, User, Search, BellOff, Bell, MoreHorizontal,
  Sparkles, Edit2, Clock, Lock, Users, Flag, ChevronRight, Grid, Check, X
} from "lucide-react";

function readIdList(key) { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } }
function writeIdList(key, list) { try { localStorage.setItem(key, JSON.stringify(list)); } catch {} }

export function isConvMuted(conv, myId) {
  if (!conv) return false;
  return !!(conv.user1_id === myId ? conv.muted_by_user1 : conv.muted_by_user2);
}
export async function toggleConvMute(sb, userId, conv, nextMuted) {
  const col = conv.user1_id === userId ? "muted_by_user1" : "muted_by_user2";
  const { error } = await sb.from("conversations").update({ [col]: nextMuted }).eq("id", conv.id);
  if (error) { console.error("Erreur mute conversation:", error); throw error; }
  return nextMuted;
}

/* ============================================================
   1. SÉPARATEURS DE JOUR ("Aujourd'hui", "Hier", "12 juin")
   ============================================================ */

export function groupMessagesByDay(msgs) {
  const out = [];
  let lastDay = null;
  (msgs || []).forEach(m => {
    const d = new Date(m.ts || Date.now());
    const dayKey = d.toDateString();
    if (dayKey !== lastDay) {
      out.push({ _divider: true, key: "div_" + dayKey, label: formatDayLabel(d) });
      lastDay = dayKey;
    }
    out.push(m);
  });
  return out;
}

function formatDayLabel(d) {
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yest.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

export function DayDivider({ label, T }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "14px 0 6px" }}>
      <span style={{
        fontSize: 11, fontWeight: 600, color: T.muted, background: "rgba(255,255,255,0.06)",
        border: `1px solid ${T.border}`, borderRadius: 12, padding: "4px 12px", letterSpacing: 0.3
      }}>{label}</span>
    </div>
  );
}

/* ============================================================
   2. RÉACTIONS EMOJI
   ============================================================ */

export const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

// payload.reactions attendu en jsonb sur la table messages : { "userId": "emoji", ... }
export async function toggleReaction(sb, msgId, userId, emoji, currentReactions) {
  const { data: fresh } = await sb.from("messages").select("reactions").eq("id", msgId).single();
  const reactions = { ...(fresh?.reactions || currentReactions || {}) };
  if (reactions[userId] === emoji) delete reactions[userId];
  else reactions[userId] = emoji;
  await sb.from("messages").update({ reactions }).eq("id", msgId);
  return reactions;
}


export function ReactionPicker({ T, onSelect, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "rgba(20,20,20,0.98)", border: `1px solid ${T.border}`, borderRadius: 30,
        padding: "10px 14px", display: "flex", gap: 10, animation: "popIn .18s ease",
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
      }}>
        {QUICK_REACTIONS.map(e => (
          <button key={e} onClick={() => { onSelect(e); onClose(); }}
            style={{ background: "none", border: "none", fontSize: 26, cursor: "pointer", transition: "transform .15s", padding: 4 }}
            onTouchStart={ev => ev.currentTarget.style.transform = "scale(1.3)"}
            onTouchEnd={ev => ev.currentTarget.style.transform = "scale(1)"}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReactionBar({ reactions, T, myId, mine, onPress }) {
  if (!reactions || Object.keys(reactions).length === 0) return null;
  const counts = {};
  Object.values(reactions).forEach(e => { counts[e] = (counts[e] || 0) + 1; });
  const myEmoji = reactions[myId];
  return (
    <div onClick={onPress} style={{
      display: "flex", gap: 3, flexWrap: "wrap",
      marginTop: -8,
      marginBottom: 4,
      paddingLeft: mine ? 0 : 8,
      paddingRight: mine ? 8 : 0,
      justifyContent: mine ? "flex-end" : "flex-start"
    }}>
      {Object.entries(counts).map(([emoji, n]) => (
        <span key={emoji} style={{
          fontSize: 13,
          background: emoji === myEmoji ? "rgba(201,149,42,0.22)" : "rgba(30,30,30,0.85)",
          border: `1px solid ${emoji === myEmoji ? T.gold : "rgba(255,255,255,0.12)"}`,
          borderRadius: 12, padding: "2px 7px",
          display: "flex", alignItems: "center", gap: 3,
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)", cursor: "pointer"
        }}>
          {emoji}
          {n > 1 && <span style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>{n}</span>}
        </span>
      ))}
    </div>
  );
}

/* ============================================================
   3. DOUBLE-TAP POUR "LIKE" RAPIDE (effet addictif type Instagram)
   ============================================================ */

export function useDoubleTap(onDoubleTap, delay = 280) {
  const lastTap = useRef(0);
  return useCallback((e) => {
    const now = Date.now();
    if (now - lastTap.current < delay) { onDoubleTap(e); lastTap.current = 0; }
    else lastTap.current = now;
  }, [onDoubleTap, delay]);
}

export function HeartBurst({ show }) {
  if (!show) return null;
  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none", zIndex: 5
    }}>
      <span style={{ fontSize: 52, animation: "heartBurst .6s ease forwards", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}>❤️</span>
    </div>
  );
}
// CSS à ajouter une seule fois globalement (voir bloc CSS en bas de fichier)

/* ============================================================
   4. RÉPONDRE À UN MESSAGE PRÉCIS (reply threading)
   ============================================================ */

export function ReplyComposerBar({ replyTo, T, onCancel }) {
  if (!replyTo) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
      background: "rgba(201,149,42,0.08)", borderTop: `1px solid ${T.border}`, borderLeft: `3px solid ${T.gold}`
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.goldL }}>Réponse à {replyTo.authorName || "message"}</p>
        <p style={{ margin: 0, fontSize: 12, color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {replyTo.text || "📎 Média"}
        </p>
      </div>
      <button onClick={onCancel} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer" }}>✕</button>
    </div>
  );
}

export function MessageReplyQuote({ message, mine, T, onClick }) {
  if (!message?.reply_to_text && !message?.reply_to_id) return null;
  return (
    <div onClick={onClick} style={{
      display: "flex", flexDirection: "column", gap: 1, padding: "5px 9px", marginBottom: 6,
      minWidth: 0, maxWidth: "100%",
      borderLeft: `3px solid ${mine ? "rgba(0,0,0,0.3)" : T.goldL}`, background: "rgba(255,255,255,0.05)",
      borderRadius: 8, cursor: message?.reply_to_id ? "pointer" : "default"
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: mine ? "rgba(0,0,0,0.55)" : T.goldL }}>
        {message.reply_to_author || "Message"}
      </span>
      <span style={{
        fontSize: 11, color: mine ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.55)",
        minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        overflow: "hidden", whiteSpace: "normal", wordBreak: "break-word"
      }}>{message.reply_to_text || "📎 Média"}</span>
    </div>
  );
}

/* ============================================================
   5. "EN TRAIN D'ÉCRIRE…" (broadcast realtime, sans écriture DB)
   ============================================================ */

export function useTypingIndicator(sb, convId, session) {
  const [peerStatus, setPeerStatus] = useState(null); // null | "typing" | "recording"
  const channelRef = useRef(null);
  const typingTimeout = useRef(null);
  const recordingTimeout = useRef(null);

  useEffect(() => {
    if (!convId) return;
    const ch = sb.channel(`typing_${convId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload.userId === session?.user?.id) return;
      if (payload.action === "recording_start") {
        clearTimeout(typingTimeout.current);
        clearTimeout(recordingTimeout.current);
        setPeerStatus("recording");
        // Filet de sécurité si le "stop" n'arrive jamais (crash, coupure réseau)
        recordingTimeout.current = setTimeout(() => setPeerStatus(p => (p === "recording" ? null : p)), 90000);
      } else if (payload.action === "recording_stop") {
        clearTimeout(recordingTimeout.current);
        setPeerStatus(p => (p === "recording" ? null : p));
      } else {
        clearTimeout(recordingTimeout.current);
        setPeerStatus("typing");
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setPeerStatus(p => (p === "typing" ? null : p)), 2500);
      }
    }).subscribe();
    channelRef.current = ch;
    return () => { clearTimeout(typingTimeout.current); clearTimeout(recordingTimeout.current); sb.removeChannel(ch); };
  }, [convId, sb, session?.user?.id]);

  const notifyTyping = useCallback(() => {
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: session?.user?.id, action: "typing" } });
  }, [session?.user?.id]);

  const notifyRecording = useCallback((isRecording) => {
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: session?.user?.id, action: isRecording ? "recording_start" : "recording_stop" } });
  }, [session?.user?.id]);

  return { peerTyping: peerStatus === "typing", peerRecording: peerStatus === "recording", notifyTyping, notifyRecording };
}

// Variante "liste de conversations" : écoute le typing sur PLUSIEURS conversations
// en même temps et retourne une map { convId: true/false }.
// Utilisé dans MsgsTab (liste), alors que useTypingIndicator reste utilisé
// dans ChatScreen pour la conversation actuellement ouverte.
export function useTypingIndicatorForConvs(sb, convIds, myId) {
  const [statusMap, setStatusMap] = useState({}); // { convId: "typing" | "recording" | null }

  useEffect(() => {
    const ids = (convIds || []).filter(Boolean);
    const channels = {};
    const timeouts = {};

    ids.forEach(id => {
      const ch = sb.channel(`typing_${id}`, { config: { broadcast: { self: false } } });
      ch.on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === myId) return;
        clearTimeout(timeouts[id]);
        if (payload.action === "recording_start") {
          setStatusMap(p => ({ ...p, [id]: "recording" }));
          timeouts[id] = setTimeout(() => setStatusMap(p => ({ ...p, [id]: null })), 90000);
        } else if (payload.action === "recording_stop") {
          setStatusMap(p => ({ ...p, [id]: null }));
        } else {
          setStatusMap(p => ({ ...p, [id]: "typing" }));
          timeouts[id] = setTimeout(() => setStatusMap(p => ({ ...p, [id]: null })), 2500);
        }
      }).subscribe();
      channels[id] = ch;
    });

    return () => {
      Object.values(channels).forEach(ch => sb.removeChannel(ch));
      Object.values(timeouts).forEach(t => clearTimeout(t));
    };
  }, [sb, (convIds || []).join(","), myId]);

  return statusMap;
}
// TypingIndicator v2 — visible, coloré, placé juste AU-DESSUS de l'input
// => mettre JUSTE AVANT la <ReplyComposerBar> dans App.jsx (pas dans le header)
export function TypingIndicator({ T, userName, mode = "typing" }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 16px",
      background: "rgba(0,0,0,0.85)",
      borderTop: "1px solid rgba(201,149,42,0.2)",
    }}>
      {/* Bulles animées en or/rouge */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "linear-gradient(135deg,#c9952a,#e53935)",
            animation: `typingDot .9s ease ${i * 0.2}s infinite`,
            boxShadow: "0 0 6px rgba(229,57,53,0.6)"
          }} />
        ))}
      </div>
      <span style={{ fontSize: 12, color: "#e0b84a", fontWeight: 600 }}>
        {mode === "recording" ? `${userName} enregistre un message vocal…` : `${userName} est en train d'écrire…`}
      </span>
    </div>
  );
}
// CSS supplémentaire à ajouter dans ton bloc global :
// @keyframes typingDot {
//   0%,80%,100%{transform:scale(0.7);opacity:0.5;}
//   40%{transform:scale(1.2);opacity:1;}
// }

/* ============================================================
   6. ÉDITION DE MESSAGE (synchronisée realtime via Supabase)
   ============================================================ */

// editMessage écrit dans la DB — Supabase realtime propage le changement
// des deux côtés automatiquement via le listener postgres_changes existant.
// Assure-toi que ton listener realtime écoute l'event UPDATE sur messages :
//   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages'}, cb)
export async function editMessage(sb, msgId, newText) {
  return sb.from("messages").update({ text: newText, edited_at: new Date().toISOString() }).eq("id", msgId);
}

export function EditedBadge({ message, T }) {
  if (!message?.edited_at) return null;
  return <span style={{ fontSize: 9, color: T.muted, fontStyle: "italic", marginLeft: 4 }}>modifié</span>;
}

/* ============================================================
   7b. SWIPE GAUCHE POUR RÉPONDRE (style WhatsApp)
   ============================================================ */

// Wrapper à utiliser autour de chaque bulle de message.
// onReply(message) est appelé quand le swipe dépasse le seuil.
export function SwipeToReply({ children, message, onReply, mine }) {
  const startX = useRef(null);
  const startY = useRef(null);
  const locked = useRef(null); // 'horizontal' | 'vertical' | null
  const elRef = useRef(null);
  const triggered = useRef(false);
  const THRESHOLD = Math.min(100, Math.max(65, window.innerWidth * 0.16));

  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    triggered.current = false;
    locked.current = null;
  };

  const onTouchMove = (e) => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Détermine la direction dominante une seule fois, dès qu'un mouvement net apparaît
    if (locked.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      locked.current = Math.abs(dx) > Math.abs(dy) * 2.2 ? "horizontal" : "vertical";
    }

    // Si c'est un scroll vertical, on annule et on laisse la liste scroller normalement
    if (locked.current === "vertical") {
      if (elRef.current) elRef.current.style.transform = "translateX(0)";
      return;
    }

    if (dx > 0 && dx < THRESHOLD + 20) {
      if (elRef.current) elRef.current.style.transform = `translateX(${Math.min(dx, THRESHOLD + 20)}px)`;
    }
    if (dx > THRESHOLD && !triggered.current && locked.current === "horizontal") {
      triggered.current = true;
      onReply(message);
      if (navigator.vibrate) navigator.vibrate(30);
    }
  };

  const onTouchEnd = () => {
    startX.current = null;
    startY.current = null;
    locked.current = null;
    if (elRef.current) {
      elRef.current.style.transition = "transform .25s ease";
      elRef.current.style.transform = "translateX(0)";
      setTimeout(() => { if (elRef.current) elRef.current.style.transition = ""; }, 260);
    }
  };

  return (
    <div ref={elRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{ position: "relative", touchAction: "pan-y" }}>
      {children}
    </div>
  );
}

/* ============================================================
   7c. RÉACTIONS AU MAINTIEN DIRECT (long-press sur la bulle)
   ============================================================ */

// Hook : déclenche onLongPress après 500ms de maintien
export function useLongPress(onLongPress, delay = 500) {
  const timer = useRef(null);
  const start = useCallback((e) => {
    e.preventDefault();
    timer.current = setTimeout(() => onLongPress(e), delay);
  }, [onLongPress, delay]);
  const stop = useCallback(() => { clearTimeout(timer.current); }, []);
  return { onTouchStart: start, onTouchEnd: stop, onTouchMove: stop, onMouseDown: start, onMouseUp: stop, onMouseLeave: stop };
}

// Picker inline flottant au-dessus de la bulle (sans overlay noir)
export function InlineReactionPicker({ T, onSelect, onClose, mine }) {
  return (
    <div style={{
      position: "absolute", bottom: "110%", [mine ? "right" : "left"]: 0,
      zIndex: 50, background: "rgba(18,18,18,0.97)",
      border: `1px solid ${T.border}`, borderRadius: 28,
      padding: "8px 12px", display: "flex", gap: 8,
      animation: "popIn .15s ease",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
    }}>
      {QUICK_REACTIONS.map(e => (
        <button key={e} onClick={() => { onSelect(e); onClose(); }}
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 2 }}
          onTouchStart={ev => ev.currentTarget.style.transform = "scale(1.35)"}
          onTouchEnd={ev => ev.currentTarget.style.transform = "scale(1)"}>
          {e}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   7. RECHERCHE DANS LA CONVERSATION
   ============================================================ */

export function ChatSearchBar({ T, value, onChange, onClose, resultCount, children }) {
  return (
    <div style={{ position: "relative", zIndex: 3 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px", background: "rgba(0,0,0,0.95)", borderBottom: `1px solid ${T.border}`
      }}>
        <input autoFocus value={value} onChange={e => onChange(e.target.value)}
          placeholder="Rechercher dans la conversation…"
          style={{
            flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`,
            borderRadius: 14, padding: "8px 12px", color: T.text, fontSize: 13, outline: "none"
          }} />
        {value && resultCount !== undefined && <span style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>{resultCount} résultat{resultCount !== 1 ? "s" : ""}</span>}
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>
      {children}
    </div>
  );
}

// Comparaison sans accents ni majuscules, caractère par caractère (les positions restent alignées)
const _normChar = c => { const n = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); return n.length === 1 ? n : c.toLowerCase(); };
const _norm = s => Array.from(String(s || "")).map(_normChar).join("");

function SearchSnippet({ text, q, T }) {
  const chars = Array.from(String(text || ""));
  const hay = chars.map(_normChar).join("");
  const needle = _norm(q.trim());
  const idx = needle ? hay.indexOf(needle) : -1;
  if (idx < 0) return <span>{chars.slice(0, 120).join("")}</span>;
  const start = Math.max(0, idx - 30);
  const end = Math.min(chars.length, idx + needle.length + 70);
  return (
    <span>
      {start > 0 ? "…" : ""}{chars.slice(start, idx).join("")}
      <span style={{ color: T.gold, fontWeight: 700 }}>{chars.slice(idx, idx + needle.length).join("")}</span>
      {chars.slice(idx + needle.length, end).join("")}{end < chars.length ? "…" : ""}
    </span>
  );
}

// Résultats de recherche sur tout l'historique (appel serveur, avec délai de frappe)
export function ChatSearchResults({ T, query, fetcher, onPick, labelFor }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const q = (query || "").trim();
  useEffect(() => {
    if (q.length < 2) { setRows(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try { const r = await fetcher(q); if (alive) setRows(r || []); }
      catch (e) { if (alive) setRows([]); }
      finally { if (alive) setLoading(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);
  if (q.length < 2) return null;
  return (
    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: "calc(100dvh - 150px)", overflowY: "auto", background: T.bg, borderBottom: `1px solid ${T.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
      {loading && rows === null && <p style={{ margin: 0, padding: 16, textAlign: "center", fontSize: 12, color: T.muted }}>Recherche…</p>}
      {rows && rows.length === 0 && !loading && <p style={{ margin: 0, padding: 16, textAlign: "center", fontSize: 12, color: T.muted }}>Aucun message trouvé</p>}
      {(rows || []).map(r => {
        const label = r.text || (r.file_name ? "📎 " + r.file_name : r.type === "voice" ? "🎤 Message vocal" : "📷 Média");
        return (
          <div key={r.id} onClick={() => onPick(r)} style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.goldL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{labelFor ? labelFor(r) : ""}</span>
              <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>{new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.35, wordBreak: "break-word" }}><SearchSnippet text={label} q={q} T={T} /></div>
          </div>
        );
      })}
    </div>
  );
}

export function filterMessagesByQuery(msgs, query) {
  if (!query?.trim()) return msgs;
  const q = query.trim().toLowerCase();
  return (msgs || []).filter(m => (m.text || "").toLowerCase().includes(q));
}

/* ============================================================
   9. ÉCRAN "INFOS CONVERSATION" (façon Instagram)
   Ouvert en appuyant sur le nom/avatar dans l'en-tête du chat.
   Squelette de navigation — chaque section (thème, pseudos,
   éphémères, confidentialité, médias) sera branchée
   progressivement ; pour l'instant, placeholders.
   ============================================================ */
/* ============================================================
   VERROU LOCAL PAR CODE (4 chiffres) — par appareil, jamais envoyé au serveur
   ============================================================ */

function hashPin(pin) {
  let h = 0;
  for (let i = 0; i < pin.length; i++) { h = (h * 31 + pin.charCodeAt(i)) | 0; }
  return String(h);
}

export function getConvLock(convId) {
  try { return JSON.parse(localStorage.getItem("celeste_conv_locks") || "{}")[convId] || null; }
  catch { return null; }
}
export function isConvLocked(convId) {
  return !!getConvLock(convId);
}
export function setConvLock(convId, pin) {
  try {
    const all = JSON.parse(localStorage.getItem("celeste_conv_locks") || "{}");
    all[convId] = hashPin(pin);
    localStorage.setItem("celeste_conv_locks", JSON.stringify(all));
  } catch {}
}
export function removeConvLock(convId) {
  try {
    const all = JSON.parse(localStorage.getItem("celeste_conv_locks") || "{}");
    delete all[convId];
    localStorage.setItem("celeste_conv_locks", JSON.stringify(all));
  } catch {}
}
export function checkConvPin(convId, pin) {
  return getConvLock(convId) === hashPin(pin);
}

function PinPad({ T, value, error, onPress, onDelete }) {
  return (
    <>
      <div style={{ display: "flex", gap: 14 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: "50%",
            border: `2px solid ${error ? "#e05252" : T.gold}`,
            background: value.length > i ? (error ? "#e05252" : T.gold) : "transparent",
            transition: "background .15s"
          }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d,i) => d === "" ? <div key={i} /> : (
          <button key={i} onClick={() => d === "⌫" ? onDelete() : onPress(d)}
            style={{ width: 60, height: 60, borderRadius: "50%", border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.05)", color: T.text, fontSize: 20, cursor: "pointer" }}>
            {d}
          </button>
        ))}
      </div>
    </>
  );
}

export function ConvPinGateScreen({ T, Btn, convId, userName, onUnlocked, onBack, onForgotPin }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const press = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      if (checkConvPin(convId, next)) onUnlocked();
      else { setError(true); setTimeout(() => { setError(false); setPin(""); }, 500); }
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: 30 }}>
      <Btn onClick={onBack} style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top,0px))", left: 14, color: T.muted }}><ChevronLeft size={22} /></Btn>
      <Lock size={30} color={T.goldL} />
      <p style={{ margin: 0, fontSize: 15, color: T.text, textAlign: "center" }}>Conversation verrouillée{userName ? ` avec ${userName}` : ""}</p>
      <PinPad T={T} value={pin} error={error} onPress={press} onDelete={() => setPin(p => p.slice(0, -1))} />
      {!confirmDelete ? (
        <Btn onClick={() => setConfirmDelete(true)} style={{ color: T.muted, fontSize: 13, textDecoration: "underline", marginTop: 6 }}>
          Mot de passe oublié
        </Btn>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 6 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#e05252", textAlign: "center", maxWidth: 240 }}>
            Cette conversation sera supprimée définitivement, pour toi et pour {userName || "l'autre personne"}.
          </p>
          <div style={{ display: "flex", gap: 14 }}>
            <Btn onClick={() => setConfirmDelete(false)} style={{ color: T.muted, fontSize: 13 }}>Annuler</Btn>
            <Btn onClick={onForgotPin} style={{ color: "#e05252", fontWeight: 700, fontSize: 13 }}>Supprimer la conversation</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ÉCRAN "CONFIDENTIALITÉ ET SÉCURITÉ" D'UNE CONVERSATION 1-À-1
   ============================================================ */

export function ConversationPrivacyScreen({ T, Btn, conv, sb, myId, userName, onBack, reload, notify }) {
  const [secureMode, setSecureMode] = useState(!!conv?.secure_mode);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(() => conv ? isConvLocked(conv.id) : false);
  const [pinStep, setPinStep] = useState(null); // null | "set1" | "set2" | "remove"
  const [pinBuffer, setPinBuffer] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const toggleSecureMode = async () => {
    if (!conv || saving) return;
    setSaving(true);
    const next = !secureMode;
    const { error } = await sb.from("conversations").update({ secure_mode: next, secure_mode_by: next ? myId : null }).eq("id", conv.id);
    setSaving(false);
    if (error) { notify?.("Erreur : impossible de changer le mode sécurisé"); return; }
    setSecureMode(next);
    reload?.();
    notify?.(next ? "Mode sécurisé activé ✦" : "Mode sécurisé désactivé");
  };

  const press = (d) => {
    if (pinBuffer.length >= 4) return;
    const next = pinBuffer + d;
    setPinBuffer(next);
    if (next.length < 4) return;
    if (pinStep === "set1") { setFirstPin(next); setPinBuffer(""); setPinStep("set2"); return; }
    if (pinStep === "set2") {
      if (next === firstPin) { setConvLock(conv.id, next); setLocked(true); setPinStep(null); setPinBuffer(""); setFirstPin(""); notify?.("Verrou activé ✦"); }
      else { setPinError(true); setTimeout(() => { setPinError(false); setPinBuffer(""); setFirstPin(""); setPinStep("set1"); }, 500); }
      return;
    }
    if (pinStep === "remove") {
      if (checkConvPin(conv.id, next)) { removeConvLock(conv.id); setLocked(false); setPinStep(null); setPinBuffer(""); notify?.("Verrou désactivé"); }
      else { setPinError(true); setTimeout(() => { setPinError(false); setPinBuffer(""); }, 500); }
    }
  };

  if (pinStep) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 210, background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: 30 }}>
        <Btn onClick={() => { setPinStep(null); setPinBuffer(""); setFirstPin(""); }} style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top,0px))", left: 14, color: T.muted }}><ChevronLeft size={22} /></Btn>
        <Lock size={30} color={T.goldL} />
        <p style={{ margin: 0, fontSize: 15, color: T.text, textAlign: "center" }}>
          {pinStep === "set1" ? "Choisis un code à 4 chiffres" : pinStep === "set2" ? "Confirme le code" : "Entre le code pour désactiver le verrou"}
        </p>
        <PinPad T={T} value={pinBuffer} error={pinError} onPress={press} onDelete={() => setPinBuffer(p => p.slice(0, -1))} />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: T.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", paddingTop: "calc(10px + env(safe-area-inset-top,0px))", borderBottom: `1px solid ${T.border}` }}>
        <Btn onClick={onBack} style={{ color: T.gold }}><ChevronLeft size={22} /></Btn>
        <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: T.text }}>Confidentialité et sécurité</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div onClick={toggleSecureMode} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 14, background: T.glassMid, border: `1px solid ${T.border}`, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, color: T.text }}>Mode sécurisé</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted, maxWidth: 240 }}>
              {userName || "Cette personne"} doit être sur l'app Céleste (pas le web) pour vous écrire, et les captures sont bloquées sur Android
            </p>
          </div>
          <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${secureMode ? T.gold : T.border}`, background: secureMode ? T.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {secureMode && <Check size={13} color="#000" />}
          </div>
        </div>

        <div onClick={() => setPinStep(locked ? "remove" : "set1")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 14, background: T.glassMid, border: `1px solid ${T.border}`, cursor: "pointer" }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, color: T.text }}>Verrouiller cette conversation</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted, maxWidth: 240 }}>
              Code à 4 chiffres demandé pour l'ouvrir, sur cet appareil uniquement
            </p>
          </div>
          <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${locked ? T.gold : T.border}`, background: locked ? T.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {locked && <Check size={13} color="#000" />}
          </div>
        </div>
      </div>
    </div>
  );
}
export function EphemeralSettingsScreen({ T, Btn, conv, sb, onBack, reload, notify }) {
  const [ttl, setTtl] = useState(conv?.ephemeral_ttl_seconds || 0);
  const [saving, setSaving] = useState(false);
  const options = [
    { value: 0, label: "Désactivé" },
    { value: 86400, label: "24 heures" },
    { value: 604800, label: "7 jours" },
    { value: 7776000, label: "90 jours" },
  ];

  const choose = async (value) => {
    if (!conv || saving || value === ttl) return;
    setSaving(true);
    const { error } = await sb.from("conversations").update({ ephemeral_ttl_seconds: value || null }).eq("id", conv.id);
    setSaving(false);
    if (error) { notify?.("Erreur : impossible de changer le réglage"); return; }
    setTtl(value);
    reload?.();
    notify?.(value ? "Messages éphémères activés ✦" : "Messages éphémères désactivés");
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: T.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", paddingTop: "calc(10px + env(safe-area-inset-top,0px))", borderBottom: `1px solid ${T.border}` }}>
        <Btn onClick={onBack} style={{ color: T.gold }}><ChevronLeft size={22} /></Btn>
        <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: T.text }}>Messages éphémères</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
          Les nouveaux messages envoyés dans cette conversation seront supprimés automatiquement après la durée choisie, pour vous deux. Les anciens messages ne sont pas concernés.
        </p>
        <div style={{ borderRadius: 14, background: T.glassMid, border: `1px solid ${T.border}`, overflow: "hidden", opacity: saving ? 0.6 : 1 }}>
          {options.map((o, i) => (
            <div key={o.value} onClick={() => choose(o.value)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", borderBottom: i < options.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <p style={{ margin: 0, fontSize: 14, color: T.text }}>{o.label}</p>
              {ttl === o.value && <Check size={16} color={T.gold} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
const BUBBLE_COLORS = [
  { id: "gold", value: null, swatch: "linear-gradient(135deg,#D4AF37,#C9952A)" },
  { id: "blue", value: "#4A90D9", swatch: "#4A90D9" },
  { id: "purple", value: "#7C3AED", swatch: "#7C3AED" },
  { id: "pink", value: "#E0559A", swatch: "#E0559A" },
  { id: "red", value: "#E05252", swatch: "#E05252" },
  { id: "orange", value: "#E08A3C", swatch: "#E08A3C" },
  { id: "teal", value: "#2FA88F", swatch: "#2FA88F" },
  { id: "green", value: "#3DB654", swatch: "#3DB654" },
];
const FONT_SIZE_OPTIONS = [{ key: "small", label: "Petit" }, { key: "normal", label: "Normal" }, { key: "large", label: "Grand" }];

export function readGroupStyle(groupId, groupDefault) {
  try {
    const c = localStorage.getItem(`chat_color_${groupId}`);
    const colorSet = c || localStorage.getItem(`chat_color_set_${groupId}`);
    const f = localStorage.getItem(`chat_fontsize_${groupId}`);
    return { color: colorSet ? (c || null) : (groupDefault?.bubble_color || null), font: f || groupDefault?.font_size || "normal" };
  } catch { return { color: groupDefault?.bubble_color || null, font: groupDefault?.font_size || "normal" }; }
}

export function ChatPersonalizationScreen({ T, Btn, conv, onBack, groupDefault, onSaveDefault }) {
  const [color, setColor] = useState(() => readGroupStyle(conv.id, groupDefault).color);
  const [fontSizeKey, setFontSizeKeyState] = useState(() => readGroupStyle(conv.id, groupDefault).font);

  const applyColor = (value) => {
    setColor(value);
    try { localStorage.setItem(`chat_color_set_${conv.id}`, "1"); if (value) localStorage.setItem(`chat_color_${conv.id}`, value); else localStorage.removeItem(`chat_color_${conv.id}`); } catch {}
    onSaveDefault?.({ bubble_color: value });
    window.dispatchEvent(new CustomEvent("celeste_chat_style_change", { detail: { convId: conv.id } }));
  };
  const resetToGroup = () => {
    try { localStorage.removeItem(`chat_color_${conv.id}`); localStorage.removeItem(`chat_color_set_${conv.id}`); localStorage.removeItem(`chat_fontsize_${conv.id}`); } catch {}
    const s = readGroupStyle(conv.id, groupDefault);
    setColor(s.color); setFontSizeKeyState(s.font);
    window.dispatchEvent(new CustomEvent("celeste_chat_style_change", { detail: { convId: conv.id } }));
  };
  const applyFontSize = (key) => {
    setFontSizeKeyState(key);
    try { localStorage.setItem(`chat_fontsize_${conv.id}`, key); } catch {}
    onSaveDefault?.({ font_size: key });
    window.dispatchEvent(new CustomEvent("celeste_chat_style_change", { detail: { convId: conv.id } }));
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: T.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", paddingTop: "calc(10px + env(safe-area-inset-top,0px))", borderBottom: `1px solid ${T.border}` }}>
        <Btn onClick={onBack} style={{ color: T.gold }}><ChevronLeft size={22} /></Btn>
        <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: T.text }}>Personnaliser</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Couleur des bulles</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 26 }}>
          {BUBBLE_COLORS.map(c => (
            <div key={c.id} onClick={() => applyColor(c.value)} style={{ width: 40, height: 40, borderRadius: "50%", background: c.swatch, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: color === c.value ? `2px solid ${T.text}` : "2px solid transparent" }}>
              {color === c.value && <Check size={16} color="#fff" />}
            </div>
          ))}
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Taille du texte</p>
        <div style={{ borderRadius: 14, background: T.glassMid, border: `1px solid ${T.border}`, overflow: "hidden" }}>
          {FONT_SIZE_OPTIONS.map((o, i) => (
            <div key={o.key} onClick={() => applyFontSize(o.key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", borderBottom: i < FONT_SIZE_OPTIONS.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <p style={{ margin: 0, fontSize: 14, color: T.text }}>{o.label}</p>
              {fontSizeKey === o.key && <Check size={16} color={T.gold} />}
            </div>
          ))}
        </div>
        <p style={{ margin: "16px 4px 0", fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
          {onSaveDefault ? "En tant qu'admin, ce réglage devient le style par défaut du groupe pour tous les membres qui n'ont encore rien personnalisé." : groupDefault ? "Ton réglage reste personnel. Sans réglage de ta part, tu vois le style choisi par l'admin." : "Ce réglage n'est visible que sur cet appareil, comme le fond d'écran de la discussion."}
          {groupDefault && !onSaveDefault && <span onClick={resetToGroup} style={{ display: "block", marginTop: 10, color: T.goldL, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Revenir au style du groupe</span>}
        </p>
      </div>
    </div>
  );
}
export function SharedMediaScreen({ T, Btn, conv, sb, onBack }) {
  const [items, setItems] = useState(null);
    const src = useSignedMediaList("dm", items, it => it.file_url);
  const [playingVideo, setPlayingVideo] = useState(null);

  useEffect(() => {
    if (!conv?.id) return;
    sb.from("messages").select("id,type,file_url,created_at")
      .eq("conv_id", conv.id).in("type", ["photo", "video"]).eq("view_once", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
  }, [conv?.id, sb]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: T.bg, display: "flex", flexDirection: "column" }}>
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
              <div key={it.id} onClick={() => it.type === "video" ? setPlayingVideo(src(it)) : window.dispatchEvent(new CustomEvent("celeste_view_img", { detail: { url: src(it) } }))}
                style={{ position: "relative", aspectRatio: "1", cursor: "pointer", background: T.glassMid }}>
                {it.type === "video"
                  ? <video src={src(it)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} muted />
                  : <img src={src(it)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
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
export function ConversationInfoScreen({ T, Av, Btn, user, conv, sb, myId, onBack, onOpenProfile, onCreateGroup, notify, reload }) {
  const soon = (label) => () => notify?.(`${label} — bientôt disponible ✦`);
   const [muted, setMuted] = useState(() => isConvMuted(conv, myId));
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showEphemeral, setShowEphemeral] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const ephemeralLabel = conv?.ephemeral_ttl_seconds === 86400 ? "24 heures" : conv?.ephemeral_ttl_seconds === 604800 ? "7 jours" : conv?.ephemeral_ttl_seconds === 7776000 ? "90 jours" : "Désactivé";

  const toggleMute = async () => {
    if (!conv) { soon("Mise en sourdine")(); return; }
    const next = !muted;
    try { await toggleConvMute(sb, myId, conv, next); setMuted(next); notify?.(next ? "Conversation mise en sourdine ✦" : "Sourdine désactivée"); }
    catch { notify?.("Impossible de changer la sourdine"); }
  };

  const topActions = [
    { key: "profil", label: "Profil", Icon: User, onClick: () => onOpenProfile && onOpenProfile(user?.id) },
    { key: "mute", label: muted ? "Sourdine" : "Mettre en s...", Icon: muted ? BellOff : Bell, onClick: toggleMute },
    { key: "options", label: "Options", Icon: MoreHorizontal, onClick: soon("Options") },
  ];

  const listItems = [
    { key: "theme", title: "Personnaliser", subtitle: "Thème et police", Icon: Sparkles, onClick: () => setShowTheme(true) },
    { key: "eph", title: "Messages éphémères", subtitle: ephemeralLabel, Icon: Clock, onClick: () => setShowEphemeral(true) },
    { key: "privacy", title: "Confidentialité et sécurité", Icon: Lock, onClick: () => setShowPrivacy(true) },
    { key: "group", title: "Créer une discussion de groupe", Icon: Users, onClick: () => onCreateGroup && onCreateGroup(user) },
  ];

  if (showPrivacy) {
    return (
      <ConversationPrivacyScreen T={T} Btn={Btn} conv={conv} sb={sb} myId={myId}
        userName={user?.fullName || user?.name} onBack={() => setShowPrivacy(false)} reload={reload} notify={notify} />
    );
  }

  if (showEphemeral) {
    return (
      <EphemeralSettingsScreen T={T} Btn={Btn} conv={conv} sb={sb}
        onBack={() => setShowEphemeral(false)} reload={reload} notify={notify} />
    );
  }

  if (showTheme) {
    return <ChatPersonalizationScreen T={T} Btn={Btn} conv={conv} onBack={() => setShowTheme(false)} />;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, background: T.bg, display: "flex", flexDirection: "column" }}>
      <div style={{
        position: "relative", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)",
        borderBottom: `1px solid ${T.border}`, padding: "10px 14px",
        paddingTop: "calc(10px + env(safe-area-inset-top,0px))", display: "flex", alignItems: "center", flexShrink: 0
      }}>
        <Btn onClick={onBack} style={{ color: T.gold, padding: 6, display: "flex", alignItems: "center" }}>
          <ChevronLeft size={22} />
        </Btn>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 0 40px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 20px 20px" }}>
          <Av u={user} size={92} />
          <p style={{ margin: "14px 0 0", fontSize: 19, fontWeight: 700, color: T.text }}>{user?.fullName || user?.name}</p>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 34, padding: "0 20px 22px" }}>
          {topActions.map(a => (
            <div key={a.key} onClick={a.onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <div style={{
                width: 46, height: 46, borderRadius: "50%", background: T.glassMid,
                border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.text
              }}>
                <a.Icon size={20} />
              </div>
              <span style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>{a.label}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${T.border}` }}>
          {listItems.map(it => (
            <div key={it.key} onClick={it.onClick} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
              borderBottom: `1px solid ${T.border}`, cursor: "pointer"
            }}>
              <it.Icon size={20} color={T.muted} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, color: T.text }}>{it.title}</p>
                {it.subtitle && <p style={{ margin: 0, fontSize: 12, color: T.muted }}>{it.subtitle}</p>}
              </div>
              <ChevronRight size={18} color={T.muted} />
            </div>
          ))}
        </div>

       <div onClick={() => setShowMedia(true)} style={{ padding: "20px", cursor: "pointer" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Médias partagés</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 0", color: T.muted }}>
            <Grid size={20} />
            <span style={{ fontSize: 13 }}>Voir les photos et vidéos</span>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>
      {showMedia && <SharedMediaScreen T={T} Btn={Btn} conv={conv} sb={sb} onBack={() => setShowMedia(false)} />}
      {showPrivacy && <ConversationPrivacyScreen T={T} Btn={Btn} conv={conv} sb={sb} myId={myId}
        userName={user?.fullName || user?.name} onBack={() => setShowPrivacy(false)} reload={reload} notify={notify} />}
    </div>
  );
}
/* ============================================================
   8. CSS GLOBAL À AJOUTER UNE SEULE FOIS
   ============================================================
@keyframes popIn { from{transform:scale(.7);opacity:0;} to{transform:scale(1);opacity:1;} }
@keyframes heartBurst {
  0%{transform:scale(0.3);opacity:0;}
  30%{transform:scale(1.2);opacity:1;}
  60%{transform:scale(1);opacity:1;}
  100%{transform:scale(1);opacity:0;}
}
@keyframes typingDot {
  0%,80%,100%{transform:scale(0.7);opacity:0.5;}
  40%{transform:scale(1.2);opacity:1;}
}
============================================================ */

/* ============================================================
   TRANSFÉRER UN MESSAGE
   ============================================================ */

export const FORWARDABLE_TYPES = ["text", "photo", "image", "video", "voice", "file", "sticker", "post_share"];

const fwNorm = s => Array.from(String(s || "")).map(c => c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()).join("");

export function ForwardSheet({ T, Btn, Av, sb, myId, msg, convs, members, excludeConvId, excludeGroupId, onClose, notify }) {
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState([]);
  const [sel, setSel] = useState([]);
  const [sending, setSending] = useState(false);
  const mediaType = !["text", "sticker", "voice"].includes(msg.type);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await sb.rpc("get_my_groups_summary");
      const list = data || [];
      let themeIds = new Set();
      if (list.length) {
        const { data: g } = await sb.from("groups").select("id,theme_id").in("id", list.map(x => x.id));
        themeIds = new Set((g || []).filter(x => x.theme_id).map(x => x.id));
      }
      if (alive) setGroups(list.map(x => ({ ...x, isTheme: themeIds.has(x.id) })));
    })();
    return () => { alive = false; };
  }, [sb]);

  const needle = fwNorm(q.trim());
  const dmRows = (convs || []).filter(c => c.id !== excludeConvId).map(c => {
    const u = (members || []).find(m => m.id === c.uid);
    return { kind: "dm", id: c.id, name: u?.name || "Conversation", u: u || { name: "?", initials: "?", color: "#888" } };
  }).filter(r => !needle || fwNorm(r.name).includes(needle));
  const groupRows = groups.filter(g => g.id !== excludeGroupId && !(g.isTheme && mediaType)).map(g => ({
    kind: "group", id: g.id, name: g.name || "Groupe",
    u: { name: g.name, avatar_url: g.photo_url, initials: (g.name || "?").slice(0, 2).toUpperCase(), color: "#888" }
  })).filter(r => !needle || fwNorm(r.name).includes(needle));

  const isSel = r => sel.some(s => s.kind === r.kind && s.id === r.id);
  const toggle = r => setSel(prev => isSel(r)
    ? prev.filter(s => !(s.kind === r.kind && s.id === r.id))
    : (prev.length >= 5 ? (notify?.("5 destinataires maximum"), prev) : [...prev, { kind: r.kind, id: r.id }]));

  const send = async () => {
    if (!sel.length || sending) return;
    setSending(true);
    const base = { type: msg.type, text: msg.text || "", view_once: false, reply_metadata: { ...(msg.reply_metadata || {}), forwarded: true } };
    if (msg.file_url) base.file_url = msg.file_url;
    if (msg.file_name) base.file_name = msg.file_name;
    if (msg.sticker_id) base.sticker_id = msg.sticker_id;
    if (msg.waveform) base.waveform = msg.waveform;
    if (msg.shared_post_id) base.shared_post_id = msg.shared_post_id;
    const results = await Promise.all(sel.map(async t => {
      const row = t.kind === "dm" ? { ...base, conv_id: t.id, sender_id: myId } : { ...base, group_id: t.id, sender_id: myId };
      const { error } = await sb.from(t.kind === "dm" ? "messages" : "group_messages").insert(row);
      return !error;
    }));
    setSending(false);
    const ok = results.filter(Boolean).length;
    notify?.(ok === results.length ? "Message transféré ✦" : ok ? `Transféré à ${ok} sur ${results.length}` : "Transfert impossible");
    if (ok) onClose();
  };

  const preview = msg.text || (msg.type === "voice" ? "🎤 Message vocal" : msg.type === "sticker" ? "Sticker" : msg.type === "post_share" ? "Publication" : msg.file_name ? "📎 " + msg.file_name : "📷 Média");
  const Row = ({ r }) => (
    <div onClick={() => toggle(r)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", cursor: "pointer" }}>
      <Av u={r.u} size={38} />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
      <span style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${isSel(r) ? T.gold : T.border}`, background: isSel(r) ? T.gold : "transparent", color: "#000", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{isSel(r) ? "✓" : ""}</span>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxHeight: "82dvh", display: "flex", flexDirection: "column", background: "#111", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: "env(safe-area-inset-bottom,12px)" }}>
        <div style={{ padding: "16px 16px 8px" }}>
          <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: T.text }}>Transférer à…</p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</p>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…"
            style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`, borderRadius: 14, padding: "8px 12px", color: T.text, fontSize: 13, outline: "none" }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {dmRows.length > 0 && <p style={{ margin: "8px 16px 2px", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Conversations</p>}
          {dmRows.map(r => <Row key={"d" + r.id} r={r} />)}
          {groupRows.length > 0 && <p style={{ margin: "10px 16px 2px", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Groupes</p>}
          {groupRows.map(r => <Row key={"g" + r.id} r={r} />)}
          {dmRows.length === 0 && groupRows.length === 0 && <p style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: 24 }}>Aucun résultat</p>}
        </div>
        <div style={{ padding: "10px 16px 0" }}>
          <Btn onClick={send} disabled={!sel.length || sending} style={{ width: "100%", padding: "13px", borderRadius: 14, background: sel.length ? T.gradGold : "rgba(255,255,255,0.08)", color: sel.length ? "#000" : T.muted, fontSize: 15, fontWeight: 700 }}>
            {sending ? "Envoi…" : sel.length ? `Envoyer (${sel.length})` : "Choisis un destinataire"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
/* ============================================================
   MESSAGES ÉPINGLÉS
   ============================================================ */

export function usePins(sb, kind, id) {
  const [pins, setPins] = useState([]);
  const table = kind === "dm" ? "conversation_pins" : "group_pins";
  const col = kind === "dm" ? "conv_id" : "group_id";
  const sel = kind === "dm"
    ? "id,message_id,created_at,message:messages(id,type,text,file_name,sender_id,created_at)"
    : "id,message_id,created_at,message:group_messages(id,type,text,file_name,sender_id,anon_alias,created_at)";
  const refresh = useCallback(async () => {
    if (!id) { setPins([]); return; }
    const { data } = await sb.from(table).select(sel).eq(col, id).order("created_at", { ascending: false });
    setPins((data || []).filter(p => p.message));
  }, [sb, id]);
  useEffect(() => {
    refresh();
    if (!id) return;
    const ch = sb.channel(`pins-${kind}-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => refresh())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [refresh]);
  const run = async (fn, mid) => {
    const { error } = await sb.rpc(fn, { p_message: mid });
    if (!error) refresh();
    return error || null;
  };
  const pin = mid => run(kind === "dm" ? "pin_conv_message" : "pin_group_message", mid);
  const unpin = mid => run(kind === "dm" ? "unpin_conv_message" : "unpin_group_message", mid);
  return { pins, pin, unpin, refresh };
}

export function PinnedBar({ T, pins, onJump }) {
  const [idx, setIdx] = useState(0);
  const n = (pins || []).length;
  if (!n) return null;
  const i = Math.min(idx, n - 1);
  const m = pins[i].message || {};
  const label = m.text || (m.type === "voice" ? "🎤 Message vocal" : m.type === "sticker" ? "Sticker" : m.type === "post_share" ? "Publication" : m.file_name ? "📎 " + m.file_name : "📷 Média");
  return (
    <div onClick={() => { onJump(pins[i]); setIdx((i + 1) % n); }}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "rgba(255,255,255,0.05)", borderBottom: `1px solid ${T.border}`, cursor: "pointer", flexShrink: 0 }}>
      <span style={{ fontSize: 16 }}>📌</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.goldL }}>Message épinglé{n > 1 ? ` · ${i + 1}/${n}` : ""}</p>
        <p style={{ margin: 0, fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</p>
      </div>
    </div>
  );
}
/* ============================================================
   SONDAGES RAPIDES (groupes et salons)
   ============================================================ */

export function usePollResults(sb, msgs) {
  const [res, setRes] = useState({});
  const ids = (msgs || []).filter(m => m.type === "poll" && /^[0-9a-f-]{36}$/i.test(String(m.id))).map(m => m.id);
  const key = ids.join(",");
  const refresh = useCallback(async () => {
    if (!ids.length) return;
    const { data } = await sb.rpc("get_poll_results", { p_messages: ids.slice(-100) });
    if (data) setRes(prev => { const n = { ...prev }; data.forEach(r => { n[r.message_id] = r; }); return n; });
  }, [key]);
  useEffect(() => {
    refresh();
    if (!ids.length) return;
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);
  const vote = async (mid, idx) => {
    const { error } = await sb.rpc("vote_group_poll", { p_message: mid, p_idx: idx });
    await refresh();
    return error || null;
  };
  return { res, vote, refresh };
}

export function PollCard({ T, question, data, mine, onVote }) {
  const ink = mine ? "#000" : T.text;
  const sub = mine ? "rgba(0,0,0,0.6)" : T.muted;
  const track = mine ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)";
  const fill = mine ? "rgba(0,0,0,0.22)" : "rgba(201,149,42,0.35)";
  const closed = data ? new Date(data.closes_at).getTime() <= Date.now() : false;
  const total = data ? data.total || 0 : 0;
  let foot = "";
  if (data) {
    const left = new Date(data.closes_at).getTime() - Date.now();
    const h = Math.ceil(left / 3600000);
    foot = `${total} vote${total !== 1 ? "s" : ""} · ` + (closed ? "Sondage terminé" : h > 48 ? `reste ${Math.ceil(h / 24)} j` : h > 1 ? `reste ${h} h` : "se termine bientôt");
  }
  return (
    <div style={{ width: 250, maxWidth: "100%" }}>
      <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: ink, wordBreak: "break-word" }}>📊 {question}</p>
      {!data && <p style={{ margin: 0, fontSize: 12, color: sub }}>Chargement…</p>}
      {data && (data.options || []).map((label, i) => {
        const n = (data.counts || [])[i] || 0;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        const isMine = data.my_vote === i;
        return (
          <div key={i} onClick={e => { e.stopPropagation(); if (!closed) onVote(isMine ? null : i); }}
            style={{ position: "relative", overflow: "hidden", borderRadius: 10, background: track, marginBottom: 6, cursor: closed ? "default" : "pointer", border: isMine ? `1.5px solid ${mine ? "rgba(0,0,0,0.55)" : T.gold}` : "1.5px solid transparent" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: pct + "%", background: fill, transition: "width .3s" }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
              <span style={{ flex: 1, fontSize: 13, color: ink, wordBreak: "break-word" }}>{isMine ? "✓ " : ""}{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: sub }}>{pct}%</span>
            </div>
          </div>
        );
      })}
      {data && <p style={{ margin: "2px 0 0", fontSize: 11, color: sub }}>{foot}</p>}
    </div>
  );
}

export function PollComposerSheet({ T, Btn, onClose, onSubmit }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const filled = opts.map(o => o.trim()).filter(Boolean);
  const ok = q.trim().length > 0 && filled.length >= 2;
  const inputStyle = { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "9px 12px", color: T.text, fontSize: 14, outline: "none", marginBottom: 8 };
  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true);
    await onSubmit({ question: q.trim(), options: filled, hours });
    setBusy(false);
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxHeight: "88dvh", overflowY: "auto", background: "#111", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "18px 16px", paddingBottom: "calc(18px + env(safe-area-inset-bottom,0px))" }}>
        <p style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: T.text }}>📊 Nouveau sondage</p>
        <input value={q} onChange={e => setQ(e.target.value.slice(0, 140))} placeholder="Ta question" style={inputStyle} />
        {opts.map((o, i) => (
          <input key={i} value={o} onChange={e => setOpts(prev => prev.map((x, j) => j === i ? e.target.value.slice(0, 60) : x))} placeholder={`Réponse ${i + 1}`} style={inputStyle} />
        ))}
        {opts.length < 4 && (
          <p onClick={() => setOpts(prev => [...prev, ""])} style={{ margin: "0 0 12px", fontSize: 13, color: T.goldL, cursor: "pointer" }}>+ Ajouter une réponse</p>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: T.muted }}>Durée :</span>
          {[[1, "1 h"], [24, "24 h"], [72, "3 j"], [168, "7 j"]].map(([h, l]) => (
            <span key={h} onClick={() => setHours(h)} style={{ padding: "5px 12px", borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: "pointer", background: hours === h ? T.gold : "rgba(255,255,255,0.08)", color: hours === h ? "#000" : T.text }}>{l}</span>
          ))}
        </div>
        <Btn onClick={submit} disabled={!ok || busy} style={{ width: "100%", padding: "13px", borderRadius: 14, background: ok ? T.gradGold : "rgba(255,255,255,0.08)", color: ok ? "#000" : T.muted, fontSize: 15, fontWeight: 700 }}>
          {busy ? "Publication…" : "Publier le sondage"}
        </Btn>
      </div>
    </div>
  );
}