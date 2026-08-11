// src/lib/groupMessageQueue.js
// File d'attente persistante pour l'envoi des messages de groupe.
// Miroir de src/lib/messageQueue.js (conversations 1-à-1), adapté à la table
// `group_messages` / colonne `group_id`. Un message "en cours d'envoi" reste
// visible et continue de tenter de s'envoyer même si l'utilisateur quitte
// l'écran, change d'onglet, ou perd temporairement la connexion.

const KEY = "celeste_group_msg_queue_v1";
const EVENT = "celeste_group_queue_update";

function readQueue() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function writeQueue(q) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch {}
  window.dispatchEvent(new CustomEvent(EVENT));
}

// Ajoute un message à la file. `payload` = champs à insérer dans `group_messages`
// (type, text, file_url, reply_to_id, etc.), hors group_id/sender_id.
export function enqueueGroupMessage(groupId, senderId, payload) {
  const q = readQueue();
  const item = {
    tempId: "tmp_g_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    groupId, senderId, payload,
    ts: Date.now(),
    status: "pending", // pending | error
    attempts: 0,
  };
  q.push(item);
  writeQueue(q);
  return item;
}

export function getQueueForGroup(groupId) {
  return readQueue().filter(m => m.groupId === groupId);
}

export function getAllQueuedGroupMessages() {
  return readQueue();
}

export function removeFromGroupQueue(tempId) {
  writeQueue(readQueue().filter(m => m.tempId !== tempId));
}

export function markGroupError(tempId) {
  const q = readQueue();
  const it = q.find(m => m.tempId === tempId);
  if (it) it.status = "error";
  writeQueue(q);
}

export function markGroupBlocked(tempId) {
  const q = readQueue();
  const it = q.find(m => m.tempId === tempId);
  if (it) it.status = "blocked";
  writeQueue(q);
}

// RLS bloque l'insertion (ex: mode annonce actif, membre non-admin) — un
// renvoi automatique ne changera rien tant que la condition ne change pas.
function isPermissionError(error) {
  return error?.code === "42501" || /row-level security/i.test(error?.message || "");
}

// S'abonner aux changements de la file (pour re-render quand un autre écran
// ou le processeur global modifie la file en arrière-plan).
export function subscribeGroupQueue(cb) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

const MAX_AUTO_ATTEMPTS = 5;

async function sendOne(sb, item) {
  const { error } = await sb.from("group_messages").insert({
    group_id: item.groupId,
    sender_id: item.senderId,
    created_at: new Date(item.ts).toISOString(),
    ...item.payload,
  });
  if (error) throw error;
  removeFromGroupQueue(item.tempId);
}

// Tente d'envoyer les messages en attente. Idempotent, safe à appeler
// depuis plusieurs endroits (reconnexion réseau, retour au premier plan, etc.)
// N'insiste plus tout seul au-delà de MAX_AUTO_ATTEMPTS : au-delà, le message
// reste visible avec le statut "error" et attend un renvoi manuel.
let processing = false;
export async function processGroupQueue(sb, notify) {
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
          markGroupBlocked(item.tempId);
          if (notify) notify("Message bloqué : le mode annonce est actif, seuls les admins peuvent écrire dans ce groupe");
          continue;
        }
        markGroupError(item.tempId);
        if (item.attempts >= MAX_AUTO_ATTEMPTS && notify) {
          notify("Un message de groupe n'a pas pu être envoyé — appuie dessus pour réessayer");
        }
      }
    }
  } finally {
    processing = false;
  }
}

// Renvoi manuel d'un message précis (ignore le plafond MAX_AUTO_ATTEMPTS).
export async function retryGroupMessage(sb, tempId, notify) {
  const item = readQueue().find(m => m.tempId === tempId);
  if (!item) return;
  try {
    await sendOne(sb, item);
  } catch (e) {
    item.attempts = (item.attempts || 0) + 1;
    if (isPermissionError(e)) {
      markGroupBlocked(item.tempId);
      if (notify) notify("Toujours bloqué : le mode annonce est actif dans ce groupe");
      return;
    }
    markGroupError(item.tempId);
    if (notify) notify("Toujours pas envoyé — vérifie ta connexion");
  }
}

// Pour la liste des groupes : { [groupId]: "pending" | "error" }
export function getGroupQueueStatuses() {
  const map = {};
  for (const item of readQueue()) {
    if (map[item.groupId] !== "error") map[item.groupId] = item.status;
  }
  return map;
}
