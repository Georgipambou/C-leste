/**
 * sessionAffinity.js — Céleste
 *
 * Signal d'affinité "chaud" : calculé côté client à partir des
 * engagements de LA session en cours (les dernières minutes), en
 * complément de `user_category_affinity` — qui elle vient du cron
 * `aggregate-engagement` et a donc plusieurs heures de retard sur
 * ce que la personne vient de faire.
 *
 * Principes :
 *  - Ne remplace JAMAIS le signal serveur, s'additionne dessus.
 *  - Plafonné (MAX_SESSION_BOOST) pour ne jamais dominer la formule
 *    de rankPosts ni créer une bulle de filtre en quelques minutes.
 *  - Décroissance exponentielle : un engagement de il y a 20 min pèse
 *    presque rien, un engagement d'il y a 10 secondes pèse plein pot.
 *  - Borné en mémoire (MAX_TRACKED_EVENTS) — une session de plusieurs
 *    heures ne fait pas grossir la structure indéfiniment.
 *  - Aucun accès réseau, aucune dépendance à React ou Supabase :
 *    fonction pure, testable unitairement sans mock.
 */

const HALF_LIFE_MINUTES = 6;      // un engagement perd la moitié de son poids toutes les 6 min
const MAX_SESSION_BOOST = 0.35;   // plafond absolu de contribution à l'affinité finale (sur une échelle 0-1)
const MAX_TRACKED_EVENTS = 200;   // borne mémoire dure, quelle que soit la durée de la session

function engagementWeight({ completed, liked, shared, commented, skippedFast }) {
  if (skippedFast) return -0.3; // swipe quasi immédiat = signal négatif léger, pas juste "neutre"
  let w = completed ? 0.6 : 0.2;
  if (liked) w += 0.5;
  if (commented) w += 0.4;
  if (shared) w += 0.4;
  return w;
}

/**
 * Fabrique une instance d'affinité de session. À instancier UNE FOIS
 * par session de feed (ex: useRef côté HomeTab), pas à chaque render.
 */
export function createSessionAffinity() {
  // events: [{ categories: [{category, weight}], w: number, ts: number }]
  let events = [];

  /**
   * @param postCategories  post.categories (déjà attaché par loadPosts via fetchRankingData)
   * @param engagementResult  { completed, liked, shared, commented, skippedFast } — même forme que le payload envoyé à engagementTracker
   */
  function record(postCategories, engagementResult) {
    if (!postCategories?.length) return;
    const w = engagementWeight(engagementResult || {});
    if (w === 0) return;
    events.push({ categories: postCategories, w, ts: Date.now() });
    if (events.length > MAX_TRACKED_EVENTS) events.shift();
  }

  function snapshot() {
    const now = Date.now();
    const scores = {};
    events.forEach(({ categories, w, ts }) => {
      const ageMin = (now - ts) / 60000;
      const decay = Math.pow(0.5, ageMin / HALF_LIFE_MINUTES);
      categories.forEach(({ category, weight }) => {
        scores[category] = (scores[category] || 0) + w * decay * (weight || 1);
      });
    });
    return scores;
  }

  /**
   * À appeler juste avant rankPosts, sur l'objet `affinity` renvoyé
   * par fetchRankingData. Ne mute pas l'entrée — renvoie une copie
   * fusionnée et bornée.
   */
  function applyTo(serverAffinity) {
    const delta = snapshot();
    const merged = { ...(serverAffinity || {}) };
    Object.entries(delta).forEach(([cat, raw]) => {
      const bounded = Math.max(-MAX_SESSION_BOOST, Math.min(MAX_SESSION_BOOST, raw));
      merged[cat] = Math.max(0, Math.min(1, (merged[cat] || 0) + bounded));
    });
    return merged;
  }

  function reset() {
    events = [];
  }

  return { record, applyTo, reset };
}