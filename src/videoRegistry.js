// videoRegistry.js — registre global pour garantir qu'une seule vidéo
// joue à la fois dans toute l'app (posts, reels, etc.)
//
// Version increvable : en plus de couper les autres vidéos quand
// pauseOtherVideos() est appelé explicitement, on écoute l'événement natif
// "play" de chaque vidéo enregistrée. Ainsi, même si un bout de code (ancien
// ou futur, n'importe où dans l'app) appelle el.play() directement sans
// passer par pauseOtherVideos(), la coupe des autres vidéos se fait quand
// même — plus jamais deux sons en même temps.

const registeredVideos = new Set();
let activeVideoEl = null;

const onNativePlay = (e) => {
  const el = e.target;
  if (activeVideoEl && activeVideoEl !== el) {
    try { activeVideoEl.pause(); } catch (err) {}
  }
  activeVideoEl = el;
};

const registerVideo = (el) => {
  if (!el || registeredVideos.has(el)) return;
  registeredVideos.add(el);
  el.addEventListener("play", onNativePlay);
};

const unregisterVideo = (el) => {
  if (!el) return;
  el.removeEventListener("play", onNativePlay);
  registeredVideos.delete(el);
  if (activeVideoEl === el) activeVideoEl = null;
};

export const pauseOtherVideos = (el) => {
  registerVideo(el);
  if (activeVideoEl && activeVideoEl !== el) {
    try { activeVideoEl.pause(); } catch (e) {}
  }
  activeVideoEl = el;
};

export const releaseActiveVideo = (el) => {
  unregisterVideo(el);
};