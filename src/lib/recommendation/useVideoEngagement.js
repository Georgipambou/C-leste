/**
 * useVideoEngagement.js — Céleste
 * Hook utilisé par ReelsViewer ET PhotoViewer (même logique pour les
 * deux, comme demandé). Suit une "session de visionnage" par post :
 * démarre quand le post devient actif, accumule le temps regardé,
 * et commit (= enregistre l'event) quand on passe au post suivant.
 *
 * Usage dans ReelsViewer/PhotoViewer :
 *   const engagement = useVideoEngagement(sb, uid);
 *   // quand activeIdx change vers un nouveau post :
 *   engagement.start(post.id, mediaDurationMs);
 *   // sur onTimeUpdate (vidéo) ou un setInterval (photo) :
 *   engagement.tick(currentTimeMs);
 *   // sur like / commentaire / signalement :
 *   engagement.markLiked(); engagement.markCommented(); engagement.markReported();
 *   // au unmount du composant, commit() est appelé automatiquement.
 */
import { useRef, useEffect, useCallback } from "react";
import { createEngagementTracker } from "./engagementTracker";

const COMPLETION_THRESHOLD = 0.9;   // regardé à 90%+ = "complété"
const SKIP_FAST_MS = 2000;          // vu moins de 2s = skip rapide (signal négatif)

export function useVideoEngagement(sb, uid) {
  const trackerRef = useRef(null);
  if (!trackerRef.current) {
    trackerRef.current = createEngagementTracker(sb, {
      sessionId: uid ? `${uid}-${Date.now()}` : null,
    });
  }

  const activeRef = useRef(null);
  // { postId, mediaDurationMs, watchedMs, liked, shared, commented, reported }

  const commit = useCallback(() => {
    const a = activeRef.current;
    activeRef.current = null;
    if (!a || !uid || !a.postId) return;

    const durationMs = a.mediaDurationMs || 0;
    const watchedMs = a.watchedMs || 0;
    const ratio = durationMs > 0 ? watchedMs / durationMs : 0;

    trackerRef.current.record({
      post_id: a.postId,
      viewer_id: uid,
      watch_ms: Math.round(watchedMs),
      media_duration_ms: Math.round(durationMs),
      completed: ratio >= COMPLETION_THRESHOLD,
      liked: !!a.liked,
      shared: !!a.shared,
      commented: !!a.commented,
      reported: !!a.reported,
      skipped_fast: watchedMs < SKIP_FAST_MS && !a.liked && !a.commented,
    });
  }, [uid]);

  const start = useCallback((postId, mediaDurationMs) => {
    if (activeRef.current?.postId === postId) return; // déjà en cours
    commit(); // ferme la session précédente avant d'en ouvrir une nouvelle
    activeRef.current = {
      postId,
      mediaDurationMs: mediaDurationMs || 0,
      watchedMs: 0,
      liked: false,
      shared: false,
      commented: false,
      reported: false,
    };
  }, [commit]);

  const tick = useCallback((currentTimeMs) => {
    if (activeRef.current) activeRef.current.watchedMs = Math.max(activeRef.current.watchedMs, currentTimeMs);
  }, []);

  const markLiked = useCallback((isAdmin = false) => {
    if (activeRef.current) activeRef.current.liked = true;
    if (isAdmin && activeRef.current?.postId) {
      // Boost instantané, sécurisé côté serveur (voir set_admin_boost dans la migration).
      // Fire-and-forget : ne bloque jamais l'UI, un échec silencieux n'est pas grave.
      sb.rpc("set_admin_boost", { target_post_id: activeRef.current.postId, add_boost: true }).then(
        ({ error }) => { if (error) console.warn("set_admin_boost:", error.message); }
      );
    }
  }, [sb]);
  const markShared    = useCallback(() => { if (activeRef.current) activeRef.current.shared = true; }, []);
  const markCommented = useCallback(() => { if (activeRef.current) activeRef.current.commented = true; }, []);
  const markReported  = useCallback(() => { if (activeRef.current) activeRef.current.reported = true; }, []);

  useEffect(() => () => {
    commit();
    trackerRef.current.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start, tick, markLiked, markShared, markCommented, markReported, commit };
}
