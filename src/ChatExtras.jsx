// ChatExtras.jsx
// Module additif pour la messagerie Céleste — réactions, réponses, statut "en train d'écrire",
// édition de message, recherche, séparateurs de jour, double-tap "like".
// Aucune dépendance directe sur App.jsx : tout reçoit sb/T/Btn/Av/session en paramètres.
// => zéro risque de casser l'existant, simple import dans App.jsx.

import { useState, useEffect, useRef, useCallback } from "react";

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
  const THRESHOLD = Math.min(80, Math.max(45, window.innerWidth * 0.12));

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
    if (locked.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      locked.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? "horizontal" : "vertical";
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

export function ChatSearchBar({ T, value, onChange, onClose, resultCount }) {
  return (
    <div style={{
      position: "relative", zIndex: 3, display: "flex", alignItems: "center", gap: 8,
      padding: "8px 14px", background: "rgba(0,0,0,0.95)", borderBottom: `1px solid ${T.border}`
    }}>
      <input autoFocus value={value} onChange={e => onChange(e.target.value)}
        placeholder="Rechercher dans la conversation…"
        style={{
          flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`,
          borderRadius: 14, padding: "8px 12px", color: T.text, fontSize: 13, outline: "none"
        }} />
      {value && <span style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>{resultCount} résultat{resultCount !== 1 ? "s" : ""}</span>}
      <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 16, cursor: "pointer" }}>✕</button>
    </div>
  );
}

export function filterMessagesByQuery(msgs, query) {
  if (!query?.trim()) return msgs;
  const q = query.trim().toLowerCase();
  return (msgs || []).filter(m => (m.text || "").toLowerCase().includes(q));
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