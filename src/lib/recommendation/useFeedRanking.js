/**
 * useFeedRanking.js — Céleste
 * Branché dans loadPosts (App.jsx) juste avant le tri actuel. Ne fait
 * AUCUN calcul lourd : lit des tables déjà pré-agrégées par l'Edge
 * Function `aggregate-engagement` (cron), donc reste rapide même à
 * l'ouverture de l'app.
 *
 * La quarantaine automatique (posts toxiques/nuls) n'a rien à faire
 * ici : elle passe déjà par `visibility="hidden"`, filtré en amont
 * dans la requête `.not("visibility","eq","hidden")` qui existe déjà
 * dans loadPosts. Ce module ne fait que RÉORDONNER les posts visibles.
 */

// Poids de la formule de scoring. Ajustables sans toucher au reste.
const WEIGHTS = {
  quality: 0.45,     // quality_score du post (completion/like/share, pénalisé par negative_rate)
  affinity: 0.35,    // affinité catégorie du viewer pour ce post
  freshness: 0.15,   // fraîcheur (decay exponentiel)
  exploration: 0.05, // bruit aléatoire pour éviter la bulle de filtre
};

const FRESHNESS_HALF_LIFE_HOURS = 36;

// Un like d'administrateur double le score (x2). Deux admins ou plus
// = x3 (plafonné, sinon un post pourrait devenir mathématiquement
// impossible à dépasser même par un autre contenu massivement engageant).
const MAX_ADMIN_MULTIPLIER_BONUS = 2; // multiplicateur final = 1 + min(2, admin_like_count)

function freshnessScore(createdAtMs) {
  const ageHours = (Date.now() - createdAtMs) / 3_600_000;
  return Math.pow(0.5, ageHours / FRESHNESS_HALF_LIFE_HOURS);
}

/**
 * Récupère scores + catégories + affinités pour un lot de posts.
 * `sb` est le client Supabase (passé en paramètre, jamais importé).
 */
export async function fetchRankingData(sb, { postIds, viewerId }) {
  if (!postIds?.length) return { scores: {}, categories: {}, affinity: {} };

  const [{ data: scoresData }, { data: catsData }, { data: affinityData }] = await Promise.all([
    sb.from("video_scores").select("post_id,quality_score,quarantined,admin_like_count").in("post_id", postIds),
    sb.from("post_categories").select("post_id,category,weight").in("post_id", postIds),
    viewerId
      ? sb.from("user_category_affinity").select("category,affinity").eq("user_id", viewerId)
      : Promise.resolve({ data: [] }),
  ]);

  const scores = {};
  (scoresData || []).forEach((s) => { scores[s.post_id] = s; });

  const categories = {};
  (catsData || []).forEach((c) => {
    if (!categories[c.post_id]) categories[c.post_id] = [];
    categories[c.post_id].push({ category: c.category, weight: c.weight || 1 });
  });

  const affinity = {};
  (affinityData || []).forEach((a) => { affinity[a.category] = a.affinity; });

  return { scores, categories, affinity };
}

/**
 * Réordonne un tableau de posts déjà filtrés (bloqués/masqués retirés
 * en amont). Ne touche pas aux posts épinglés — à appeler sur le
 * sous-ensemble "non épinglé" du feed, comme le fait déjà loadPosts
 * avec `viral` / `withBadge` / `noBadge`.
 */
export function rankPosts(posts, { scores, categories, affinity }) {
  const scored = posts.map((p) => {
    const qualityScore = scores[p.id]?.quality_score ?? 0.5; // neutre si pas encore assez de données
    const postCats = categories[p.id] || [];
    const affinityScore = postCats.length
      ? Math.max(...postCats.map((c) => (affinity[c.category] || 0) * c.weight))
      : 0;
    const fresh = freshnessScore(p.ts || Date.now());
    const exploration = Math.random();

    const baseScore =
      WEIGHTS.quality * qualityScore +
      WEIGHTS.affinity * Math.min(1, affinityScore) +
      WEIGHTS.freshness * fresh +
      WEIGHTS.exploration * exploration;

    // ── Boost éditorial admin : x2 pour 1 like admin, x3 pour 2+ ──
    const adminLikeCount = scores[p.id]?.admin_like_count || 0;
    const adminMultiplier = 1 + Math.min(MAX_ADMIN_MULTIPLIER_BONUS, adminLikeCount);

    return { post: p, score: baseScore * adminMultiplier };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.post);
}
