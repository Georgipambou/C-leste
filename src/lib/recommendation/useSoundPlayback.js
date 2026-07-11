/**
 * useSoundPlayback.js — Céleste
 * Joue le son attaché au post actif (photo ou reel), en boucle, et le
 * coupe proprement au changement de post. Séparé du son natif d'une
 * vidéo Reel (celui-là reste géré par la balise <video> elle-même) —
 * ce hook sert pour PhotoViewer, où il n'y a pas de piste audio native.
 *
 * Usage dans PhotoViewer :
 *   const soundPlayback = useSoundPlayback(muted);
 *   useEffect(() => {
 *     const post = displayPosts[activeIdx];
 *     soundPlayback.play(post?.sound?.url);
 *   }, [activeIdx, displayPosts]);
 */
import { useRef, useEffect, useCallback } from "react";

export function useSoundPlayback(muted) {
  const audioRef = useRef(null);
  if (!audioRef.current && typeof Audio !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.loop = true;
  }

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = !!muted;
  }, [muted]);

  const play = useCallback((url) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!url) { audio.pause(); audio.removeAttribute("src"); return; }
    if (audio.src !== url) {
      audio.src = url;
      audio.currentTime = 0;
    }
    audio.muted = !!muted;
    audio.play().catch(() => {}); // autoplay peut être bloqué tant que l'utilisateur n'a pas interagi — silencieux
  }, [muted]);

  const stop = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
  }, []);

  useEffect(() => () => { if (audioRef.current) audioRef.current.pause(); }, []);

  return { play, stop };
}
