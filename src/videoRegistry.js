// videoRegistry.js — registre global pour garantir qu'une seule vidéo
// joue à la fois dans toute l'app (posts, reels, etc.)
let activeVideoEl = null;

export const pauseOtherVideos = (el) => {
  if (activeVideoEl && activeVideoEl !== el) {
    try { activeVideoEl.pause(); } catch (e) {}
  }
  activeVideoEl = el;
};

export const releaseActiveVideo = (el) => {
  if (activeVideoEl === el) activeVideoEl = null;
};
