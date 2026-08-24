/**
 * useFeedIntersection.js — Céleste
 *
 * Remplace le pattern actuel (disconnect() + ré-observe() de TOUT à
 * chaque changement de displayPosts) par :
 *
 *  1. Un IntersectionObserver créé UNE SEULE FOIS pour toute la durée
 *     de vie du viewer — jamais recréé quand la liste grandit.
 *  2. Une attache/détache PAR ÉLÉMENT, au moment exact où son <div>
 *     se monte/démonte (via un ref callback React) — pas de boucle
 *     sur toute la liste à chaque render.
 *  3. Une résolution de l'index par l'ID du post (pas par une valeur
 *     figée dans data-idx) — reste correct même si la liste est
 *     réordonnée (ex: nouveau post ajouté en tête), cas que le code
 *     actuel ne gère pas non plus mais qu'on ne veut pas reproduire.
 *
 * Fonction pure côté logique (pas d'accès réseau, pas de dépendance
 * à Supabase) — testable en isolation avec un DOM simulé (jsdom).
 */
import { useRef, useCallback, useEffect, useMemo } from "react";

const DEFAULT_THRESHOLDS = [0, 0.25, 0.5, 0.6, 0.75, 1];
const ACTIVE_RATIO_THRESHOLD = 0.6;
const DEBOUNCE_MS = 80;

// Fenêtre de montage complet (DOM + handlers), en nombre de posts de
// chaque côté de l'actif. Plus large que le "nearActive" existant
// (±1, qui ne gate que le média) pour laisser une marge de pré-montage
// avant que la vidéo/l'image ne s'active — évite un pop-in visible.
const DEFAULT_RENDER_RADIUS = 6;
const LOW_MEMORY_RENDER_RADIUS = 3; // téléphones bas de gamme (deviceMemory ≤ 2 Go déclaré)

export function getRenderWindowRadius() {
  const mem = typeof navigator !== "undefined" ? navigator.deviceMemory : undefined;
  return mem && mem <= 2 ? LOW_MEMORY_RENDER_RADIUS : DEFAULT_RENDER_RADIUS;
}

export function shouldMountFull(idx, activeIdx, radius = getRenderWindowRadius()) {
  return Math.abs(idx - activeIdx) <= radius;
}

/**
 * @param displayPosts  liste actuellement affichée (déjà filtrée hiddenPostIds)
 * @param setActiveIdx  setter d'état existant dans FeedViewer
 * @param onSettle      callback optionnel appelé après le debounce (ex: setExpandedCaption(false))
 */
export function useFeedIntersection(displayPosts, setActiveIdx, onSettle) {
  const observerRef = useRef(null);
  const nodesRef = useRef(new Map());     // postId -> HTMLElement actuellement monté
  const idToIdxRef = useRef(new Map());   // recalculé à chaque render, lu au moment de l'intersection
  const debounceRef = useRef(null);
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;

  idToIdxRef.current = useMemo(() => {
    const m = new Map();
    displayPosts.forEach((p, idx) => m.set(p.id, idx));
    return m;
  }, [displayPosts]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const best = entries.reduce(
          (acc, e) => (e.intersectionRatio > (acc?.intersectionRatio || 0) ? e : acc),
          null
        );
        if (!best || best.intersectionRatio < ACTIVE_RATIO_THRESHOLD) return;
        const postId = best.target.dataset.postId;
        const idx = idToIdxRef.current.get(postId);
        if (idx == null) return; // post masqué/retiré entre-temps
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          setActiveIdx((prev) => (idx !== prev ? idx : prev));
          onSettleRef.current?.();
        }, DEBOUNCE_MS);
      },
      { threshold: DEFAULT_THRESHOLDS }
    );
    return () => {
      clearTimeout(debounceRef.current);
      observerRef.current?.disconnect();
      observerRef.current = null;
      nodesRef.current.clear();
    };
    // Volontairement []: cet effet ne doit tourner qu'au mount/unmount du viewer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActiveIdx]);

  // Ref callback à poser sur CHAQUE <div data-post-id={post.id}>, montage
  // complet ou placeholder — les deux doivent être observés pour que le
  // scroll-snap continue de fonctionner sur les posts hors fenêtre.
  const registerItem = useCallback((postId) => (el) => {
    const prevEl = nodesRef.current.get(postId);
    if (prevEl && prevEl !== el && observerRef.current) {
      observerRef.current.unobserve(prevEl);
    }
    if (el) {
      nodesRef.current.set(postId, el);
      observerRef.current?.observe(el);
    } else {
      nodesRef.current.delete(postId);
    }
  }, []);

  return { registerItem };
}