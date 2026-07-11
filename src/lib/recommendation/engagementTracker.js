/**
 * engagementTracker.js — Céleste
 * Batching des événements d'engagement vidéo/photo avant envoi à
 * Supabase. Ne JAMAIS insérer un event à chaque tick — on accumule
 * en mémoire et on flush toutes les BATCH_INTERVAL_MS ou dès que
 * MAX_BATCH_SIZE est atteint. Reçoit `sb` en paramètre (même pattern
 * que ReelsViewer/PhotoViewer — pas d'import de client ici).
 */

const BATCH_INTERVAL_MS = 8000;
const MAX_BATCH_SIZE = 20;

export function createEngagementTracker(sb, { sessionId } = {}) {
  let queue = [];
  let timer = null;

  const flush = async () => {
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    try {
      const { error } = await sb.from("video_engagement_events").insert(batch);
      if (error) console.warn("engagementTracker flush error:", error.message);
    } catch (e) {
      console.warn("engagementTracker flush exception:", e);
    }
  };

  const scheduleFlush = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, BATCH_INTERVAL_MS);
  };

  const record = (event) => {
    queue.push({
      session_id: sessionId || null,
      ...event,
    });
    if (queue.length >= MAX_BATCH_SIZE) {
      if (timer) { clearTimeout(timer); timer = null; }
      flush();
    } else {
      scheduleFlush();
    }
  };

  const destroy = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    flush();
  };

  return { record, flush, destroy };
}
