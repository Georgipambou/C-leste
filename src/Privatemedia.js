import { useState, useEffect, useCallback } from "react";

// Médias privés des messages (DM + groupes) : l'adresse publique R2 est
// remplacée par une adresse signée temporaire (fonction sign-media).
const MARGIN_MS = 15 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cache = new Map();
const pending = new Set();
const failed = new Set();
const listeners = new Set();
const queue = { dm: new Set(), group: new Set() };
let timer = null;
let client = null;
export function setMediaClient(sb) { client = sb; }

const keyOf = (kind, id) => kind + ":" + id;
const emit = () => listeners.forEach(f => f());

export function isPrivateMediaUrl(u) {
  if (typeof u !== "string" || !u.startsWith("http")) return false;
  try {
    const p = new URL(u).pathname;
    return p.startsWith("/messages/") || p.startsWith("/group_messages/");
  } catch (e) { return false; }
}

function flush() {
  timer = null;
  const sb = client;
  if (!sb) return;
  for (const kind of ["dm", "group"]) {
    const ids = [...queue[kind]];
    queue[kind] = new Set();
    for (let i = 0; i < ids.length; i += 50) {
      const part = ids.slice(i, i + 50);
      const done = ok => {
        part.forEach(id => { pending.delete(keyOf(kind, id)); if (!ok) failed.add(keyOf(kind, id)); });
        emit();
      };
      sb.functions.invoke("sign-media", { body: { kind, ids: part } })
        .then(({ data, error }) => {
          if (error || !data || !data.urls) return done(false);
          const ttl = (data.expires_in || 21600) * 1000;
          part.forEach(id => {
            const url = data.urls[id];
            if (url) { cache.set(keyOf(kind, id), { url, exp: Date.now() + ttl }); failed.delete(keyOf(kind, id)); }
            else failed.add(keyOf(kind, id));
          });
          done(true);
        })
        .catch(() => done(false));
    }
  }
}

export function requestSign(kind, id) {
  if (!client) return;
  if (!UUID.test(String(id))) return;
  const k = keyOf(kind, id);
  const c = cache.get(k);
  if ((c && c.exp - Date.now() > MARGIN_MS) || pending.has(k)) return;
  pending.add(k);
  queue[kind].add(id);
  if (!timer) timer = setTimeout(flush, 40);
}

// Adresse à afficher : signée si dispo ; sinon "" le temps de la signature.
// Si la signature échoue (ou message pas encore enregistré), on garde l'adresse d'origine.
function resolve(kind, id, url) {
  if (!isPrivateMediaUrl(url)) return url || "";
  if (!UUID.test(String(id))) return url;
  const c = cache.get(keyOf(kind, id));
  if (c) return c.url;
  return failed.has(keyOf(kind, id)) ? url : "";
}

function useTick() {
  const [t, set] = useState(0);
  useEffect(() => {
    const f = () => set(x => x + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return t;
}

setInterval(emit, 10 * 60 * 1000);

// Un seul message (composant par bulle)
export function useSignedMedia(kind, id, url) {
  const t = useTick();
  const priv = isPrivateMediaUrl(url);
  useEffect(() => { if (priv) requestSign(kind, id); }, [priv, kind, id, t]);
  return resolve(kind, id, url);
}

// Une liste de messages ; renvoie une fonction src(item)
export function useSignedMediaList(kind, items, getUrl) {
  const t = useTick();
  useEffect(() => {
    const arr = items || [];
    for (let i = arr.length - 1; i >= 0; i--) {
      if (isPrivateMediaUrl(getUrl(arr[i]))) requestSign(kind, arr[i].id);
    }
  }, [items, kind, t]);
  return useCallback(it => resolve(kind, it.id, getUrl(it)), [kind, t]);
}