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
  const reactions = { ...(currentReactions || {}) };
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

export function ReactionBar({ reactions, T, myId }) {
  if (!reactions || Object.keys(reactions).length === 0) return null;
  const counts = {};
  Object.values(reactions).forEach(e => { counts[e] = (counts[e] || 0) + 1; });
  const mine = reactions[myId];
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
      {Object.entries(counts).map(([emoji, n]) => (
        <span key={emoji} style={{
          fontSize: 11, background: emoji === mine ? "rgba(201,149,42,0.18)" : "rgba(255,255,255,0.07)",
          border: `1px solid ${emoji === mine ? T.gold : T.border}`, borderRadius: 10,
          padding: "2px 6px", display: "flex", alignItems: "center", gap: 3
        }}>
          {emoji}{n > 1 && <span style={{ color: T.muted, fontWeight: 600 }}>{n}</span>}
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
      borderLeft: `3px solid ${mine ? "rgba(0,0,0,0.3)" : T.goldL}`, background: "rgba(255,255,255,0.05)",
      borderRadius: 8, cursor: message?.reply_to_id ? "pointer" : "default"
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: mine ? "rgba(0,0,0,0.55)" : T.goldL }}>
        {message.reply_to_author || "Message"}
      </span>
      <span style={{
        fontSize: 11, color: mine ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.55)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
      }}>{message.reply_to_text || "📎 Média"}</span>
    </div>
  );
}

/* ============================================================
   5. "EN TRAIN D'ÉCRIRE…" (broadcast realtime, sans écriture DB)
   ============================================================ */

export function useTypingIndicator(sb, convId, session) {
  const [peerTyping, setPeerTyping] = useState(false);
  const channelRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    if (!convId) return;
    const ch = sb.channel(`typing_${convId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload.userId === session?.user?.id) return;
      setPeerTyping(true);
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setPeerTyping(false), 2500);
    }).subscribe();
    channelRef.current = ch;
    return () => { clearTimeout(typingTimeout.current); sb.removeChannel(ch); };
  }, [convId, sb, session?.user?.id]);

  const notifyTyping = useCallback(() => {
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: session?.user?.id } });
  }, [session?.user?.id]);

  return { peerTyping, notifyTyping };
}

export function TypingIndicator({ T, userName }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 14px 8px" }}>
      <span style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>{userName} écrit</span>
      <div style={{ display: "flex", gap: 3 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: T.muted, animation: `pulse .6s ease ${i * 0.15}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   6. ÉDITION DE MESSAGE
   ============================================================ */

export async function editMessage(sb, msgId, newText) {
  return sb.from("messages").update({ text: newText, edited_at: new Date().toISOString() }).eq("id", msgId);
}

export function EditedBadge({ message, T }) {
  if (!message?.edited_at) return null;
  return <span style={{ fontSize: 9, color: T.muted, fontStyle: "italic", marginLeft: 4 }}>modifié</span>;
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
   8. CSS GLOBAL À AJOUTER UNE SEULE FOIS (dans ton fichier de styles globaux ou un <style> existant)
   ============================================================
@keyframes popIn { from{transform:scale(.7);opacity:0;} to{transform:scale(1);opacity:1;} }
@keyframes heartBurst {
  0%{transform:scale(0.3);opacity:0;}
  30%{transform:scale(1.2);opacity:1;}
  60%{transform:scale(1);opacity:1;}
  100%{transform:scale(1);opacity:0;}
}
============================================================ */