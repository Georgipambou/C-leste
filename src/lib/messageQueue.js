// src/lib/messageQueue.js
// File d'attente persistante pour l'envoi des messages de chat.
// Contrairement à l'ancien `sendingMsgs` (useState local à ChatScreen),
// cette file vit dans localStorage : un message "en cours d'envoi" reste visible
// et continue de tenter de s'envoyer même si l'utilisateur quitte la conversation,
// change d'onglet, ou perd temporairement la connexion — comme sur WhatsApp.

const KEY = "celeste_msg_queue_v2";
const EVENT = "celeste_queue_update";

function readQueue() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function writeQueue(q) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch {}
  window.dispatchEvent(new CustomEvent(EVENT));
}

// Ajoute un message à la file. `payload` = champs à insérer dans `messages`
// (type, text, media_url, reply_to, etc.), hors conv_id/sender_id.
export function enqueueMessage(convId, senderId, payload) {
  const q = readQueue();
  const item = {
    tempId: "tmp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    convId, senderId, payload,
    ts: Date.now(),
    status: "pending", // pending | error
    attempts: 0,
  };
  q.push(item);
  writeQueue(q);
  return item;
}

export function getQueueForConv(convId) {
  return readQueue().filter(m => m.convId === convId);
}

export function getAllQueued() {
  return readQueue();
}

export function removeFromQueue(tempId) {
  writeQueue(readQueue().filter(m => m.tempId !== tempId));
}

export function markError(tempId) {
  const q = readQueue();
  const it = q.find(m => m.tempId === tempId);
  if (it) it.status = "error";
  writeQueue(q);
}

export function markBlocked(tempId) {
  const q = readQueue();
  const it = q.find(m => m.tempId === tempId);
  if (it) it.status = "blocked";
  writeQueue(q);
}

// RLS bloque l'insertion (ex: utilisateurs bloqués mutuellement) — un
// renvoi automatique ne changera rien tant que la condition ne change pas.
function isPermissionError(error) {
  return error?.code === "42501" || /row-level security/i.test(error?.message || "");
}

// S'abonner aux changements de la file (pour re-render quand un autre écran
// ou le processeur global modifie la file en arrière-plan).
export function subscribeQueue(cb) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

const MAX_AUTO_ATTEMPTS = 5;

async function sendOne(sb, item) {
  const { error } = await sb.from("messages").insert({
    conv_id: item.convId,
    sender_id: item.senderId,
    created_at: new Date(item.ts).toISOString(),
    ...item.payload,
  });
  if (error) throw error;
  removeFromQueue(item.tempId);
}

// Tente d'envoyer les messages en attente. Idempotent, safe à appeler
// depuis plusieurs endroits (reconnexion réseau, retour au premier plan, etc.)
// N'insiste plus tout seul au-delà de MAX_AUTO_ATTEMPTS : au-delà, le message
// reste visible avec le statut "error" et attend un renvoi manuel.
let processing = false;
export async function processQueue(sb, notify) {
  if (processing) return;
  processing = true;
  try {
    const q = readQueue();
    for (const item of q) {
      if (!navigator.onLine) break;
      if (item.status === "blocked") continue; // permanent tant que le renvoi manuel n'est pas déclenché
      if ((item.attempts || 0) >= MAX_AUTO_ATTEMPTS) continue; // attend un renvoi manuel
      try {
        await sendOne(sb, item);
      } catch (e) {
        item.attempts = (item.attempts || 0) + 1;
        if (isPermissionError(e)) {
          markBlocked(item.tempId);
          if (notify) notify("Message bloqué : vous ne pouvez plus échanger de messages avec cette personne");
          continue;
        }
        markError(item.tempId);
        if (item.attempts >= MAX_AUTO_ATTEMPTS && notify) {
          notify("Un message n'a pas pu être envoyé — appuie dessus pour réessayer");
        }
      }
    }
  } finally {
    processing = false;
  }
}

// Renvoi manuel d'un message précis (ignore le plafond MAX_AUTO_ATTEMPTS).
export async function retryMessage(sb, tempId, notify) {
  const item = readQueue().find(m => m.tempId === tempId);
  if (!item) return;
  try {
    await sendOne(sb, item);
  } catch (e) {
    item.attempts = (item.attempts || 0) + 1;
    if (isPermissionError(e)) {
      markBlocked(item.tempId);
      if (notify) notify("Toujours bloqué : vous ne pouvez plus échanger de messages avec cette personne");
      return;
    }
    markError(item.tempId);
    if (notify) notify("Toujours pas envoyé — vérifie ta connexion");
  }
}

// Pour la liste des conversations : { [convId]: "pending" | "error" }
export function getConvStatuses() {
  const map = {};
  for (const item of readQueue()) {
    if (map[item.convId] !== "error" && map[item.convId] !== "blocked") map[item.convId] = item.status;
  }
  return map;
}

// --- Suivi en mémoire des envois de fichiers/vocaux (photo/vidéo/vocal) ---
// Le fichier lui-même ne survit pas à un redémarrage de l'app (pas de localStorage
// ici), mais l'objectif est qu'il survive à un simple changement d'écran dans la
// même session — ce qu'un useState local à ChatScreen ne permettait pas : en
// revenant sur la conversation, l'envoi en cours semblait avoir disparu alors
// qu'il continuait en fait de tourner en arrière-plan.
const fileSends = new Map(); // tempId -> {convId,fileType,fileName,ts,pct,status}
const FILE_EVENT = "celeste_file_send_update";

export function trackFileSend(tempId, convId, data) {
  fileSends.set(tempId, { convId, ts: Date.now(), pct: 0, status: "sending", ...data });
  window.dispatchEvent(new CustomEvent(FILE_EVENT));
}
export function updateFileSend(tempId, patch) {
  const it = fileSends.get(tempId);
  if (!it) return;
  fileSends.set(tempId, { ...it, ...patch });
  window.dispatchEvent(new CustomEvent(FILE_EVENT));
}
export function removeFileSend(tempId) {
  fileSends.delete(tempId);
  window.dispatchEvent(new CustomEvent(FILE_EVENT));
}
export function getFileSendsForConv(convId) {
  const out = [];
  for (const [id, v] of fileSends) if (v.convId === convId) out.push({ id, ...v });
  return out;
}
export function subscribeFileSends(cb) {
  window.addEventListener(FILE_EVENT, cb);
  return () => window.removeEventListener(FILE_EVENT, cb);
}