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
function seededRandom(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
}
const WEIGHTS = {
  follows: 0.20,     // compte que le viewer suit directement — priorité forte, demandée explicitement
  quality: 0.20,
  affinity: 0.16,
  community: 0.12,
  visited: 0.08,
  proximity: 0.12,
  freshness: 0.08,
  exploration: 0.04,
};

const FRESHNESS_HALF_LIFE_HOURS = 36;
const PROXIMITY_DECAY_KM = 100; // au-delà d'~100km, le bonus de proximité devient négligeable

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function proximityScore(viewerLat, viewerLon, postLat, postLon) {
  if (viewerLat == null || viewerLon == null || postLat == null || postLon == null) return 0.5; // pas de position connue → neutre, ni pénalisé ni favorisé
  const distKm = haversineKm(viewerLat, viewerLon, postLat, postLon);
  return Math.exp(-distKm / PROXIMITY_DECAY_KM);
}

// Un like d'administrateur double le score (x2). Deux admins ou plus
// = x3 (plafonné, sinon un post pourrait devenir mathématiquement
// impossible à dépasser même par un autre contenu massivement engageant).
const MAX_ADMIN_MULTIPLIER_BONUS = 2; // multiplicateur final = 1 + min(2, admin_like_count)
const RARE_TYPE_BOOST = 1.4; // sondages/événements : peu nombreux et sans signal qualité propre → boost modéré


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
 * Renvoie l'ensemble des comptes suivis par les personnes que le viewer
 * suit (2e degré), sans compter le viewer lui-même ni ceux qu'il suit déjà
 * (ceux-là sont déjà prioritaires via "comptes suivis" ailleurs dans le feed).
 */
export async function fetchCommunityIds(sb, viewerId) {
  if (!viewerId) return new Set();
  const { data: mine } = await sb.from("connections").select("to_id").eq("from_id", viewerId);
  const followedIds = (mine || []).map((r) => r.to_id);
  if (followedIds.length === 0) return new Set();

  const { data: secondDegree } = await sb.from("connections").select("to_id").in("from_id", followedIds);
  const ids = new Set((secondDegree || []).map((r) => r.to_id));
  ids.delete(viewerId);
  followedIds.forEach((id) => ids.delete(id));
  return ids;
}

/**
 * Comptes que le viewer visite souvent directement sur leur profil
 * (au moins `minVisits` fois sur les `sinceDays` derniers jours).
 */
export async function fetchFrequentlyVisitedIds(sb, viewerId, { minVisits = 3, sinceDays = 30 } = {}) {
  if (!viewerId) return new Set();
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const { data } = await sb.from("profile_views").select("viewed_id").eq("viewer_id", viewerId).gte("created_at", since);
  const counts = new Map();
  (data || []).forEach((r) => counts.set(r.viewed_id, (counts.get(r.viewed_id) || 0) + 1));
  const ids = new Set();
  counts.forEach((c, id) => { if (c >= minVisits) ids.add(id); });
  return ids;
}

/**
 * Réordonne un tableau de posts déjà filtrés (bloqués/masqués retirés
 * en amont). Ne touche pas aux posts épinglés — à appeler sur le
 * sous-ensemble "non épinglé" du feed, comme le fait déjà loadPosts
 * avec `viral` / `withBadge` / `noBadge`.
 */
export function rankPosts(posts, { scores, categories, affinity }, viewerLocation = null, communityIds = null, frequentIds = null, followedIds = null) {
  const scored = posts
    .filter((p) => !scores[p.id]?.quarantined) // filet de sécurité : au cas où visibility="hidden" n'aurait pas encore été appliqué par le cron
    .map((p) => {
    const qualityScore = scores[p.id]?.quality_score ?? 0.5; // neutre si pas encore assez de données
    const postCats = categories[p.id] || [];
    const affinityScore = postCats.length
      ? Math.max(...postCats.map((c) => (affinity[c.category] || 0) * c.weight))
      : 0;
    const fresh = freshnessScore(p.ts || Date.now());
    const exploration = seededRandom(p.id);
    const prox = proximityScore(viewerLocation?.lat, viewerLocation?.lon, p.author?.latitude, p.author?.longitude);
    // ── Duo = "super post" : la communauté ET les abonnés de CHAQUE
    // participant comptent, pas seulement ceux de l'auteur principal ──
    const collabIds = p.collaboratorIds || [];
    const community = (communityIds?.has(p.by) || collabIds.some((id) => communityIds?.has(id))) ? 1 : 0;
    const visited = frequentIds?.has(p.by) ? 1 : 0;
    const follows = (followedIds?.has(p.by) || collabIds.some((id) => followedIds?.has(id))) ? 1 : 0;

    const baseScore =
      WEIGHTS.follows * follows +
      WEIGHTS.quality * qualityScore +
      WEIGHTS.affinity * Math.min(1, affinityScore) +
      WEIGHTS.community * community +
      WEIGHTS.visited * visited +
      WEIGHTS.proximity * prox +
      WEIGHTS.freshness * fresh +
      WEIGHTS.exploration * exploration;

    // ── Boost éditorial admin : x2 pour 1 like admin, x3 pour 2+ ──
    const adminLikeCount = scores[p.id]?.admin_like_count || 0;
    const adminMultiplier = 1 + Math.min(MAX_ADMIN_MULTIPLIER_BONUS, adminLikeCount);

    // ── Sondages/événements sont rares : sans ce coup de pouce, ils finissent
    // noyés sous le contenu vidéo qui accumule un quality_score au fil du temps ──
    const rareTypeMultiplier = (p.type === "poll" || p.type === "event") ? RARE_TYPE_BOOST : 1;

    return { post: p, score: baseScore * adminMultiplier * rareTypeMultiplier };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.post);
}
/**
 * Construit la file du Reel en "mode session" : à partir de la vidéo tapée,
 * fait remonter en priorité les autres vidéos qui partagent des catégories
 * avec elle — sans écraser toute diversité (interleave 2 vidéos liées pour
 * 1 vidéo "autre", même esprit que le mix pinned/viral/badge du feed principal).
 * Purement synchrone, aucun accès réseau : les posts portent déjà `categories`
 * (attaché dans loadPosts via fetchRankingData, voir App.jsx).
 */
export function buildReelSessionQueue(tappedPost, allVideoPosts) {
  const tappedCats = tappedPost.categories || [];
  if (!tappedCats.length) {
    // Pas de catégorie connue → pas de réordonnancement thématique,
    // mais le post tapé doit quand même s'ouvrir en premier.
    const rest = allVideoPosts.filter((p) => p.id !== tappedPost.id);
    return [tappedPost, ...rest];
  }

  const relatedness = (p) => {
    const postCats = p.categories || [];
    if (!postCats.length) return 0;
    let score = 0;
    tappedCats.forEach((tc) => {
      const match = postCats.find((pc) => pc.category === tc.category);
      if (match) score += (tc.weight || 1) * (match.weight || 1);
    });
    return score;
  };

  const rest = allVideoPosts.filter((p) => p.id !== tappedPost.id);
  const related = rest.filter((p) => relatedness(p) > 0).sort((a, b) => relatedness(b) - relatedness(a));
  const other = rest.filter((p) => relatedness(p) === 0);

  const queue = [tappedPost];
  let ri = 0, oi = 0;
  while (ri < related.length || oi < other.length) {
    if (ri < related.length) queue.push(related[ri++]);
    if (ri < related.length) queue.push(related[ri++]);
    if (oi < other.length) queue.push(other[oi++]);
  }
  return queue;
}
export const SOUND_MATCH_BONUS = 3; // partager le même son est un signal fort et explicite — pas juste thématique

function categoryRelatedness(catsA, catsB) {
  if (!catsA.length || !catsB.length) return 0;
  let score = 0;
  catsA.forEach((ca) => {
    const match = catsB.find((cb) => cb.category === ca.category);
    if (match) score += (ca.weight || 1) * (match.weight || 1);
  });
  return score;
}

/**
 * Équivalent de buildReelSessionQueue pour les photos : en plus des
 * catégories, une photo qui partage le MÊME son que la photo tapée est
 * fortement mise en avant.
 */
export function buildPhotoSessionQueue(tappedPost, allPhotoPosts) {
  const tappedCats = tappedPost.categories || [];
  const tappedSoundId = tappedPost.sound?.id || null;
  if (!tappedCats.length && !tappedSoundId) {
    const rest = allPhotoPosts.filter((p) => p.id !== tappedPost.id);
    return [tappedPost, ...rest];
  }

  const relatedness = (p) => {
    let score = categoryRelatedness(tappedCats, p.categories || []);
    if (tappedSoundId && p.sound?.id === tappedSoundId) score += SOUND_MATCH_BONUS;
    return score;
  };

  const rest = allPhotoPosts.filter((p) => p.id !== tappedPost.id);
  const related = rest.filter((p) => relatedness(p) > 0).sort((a, b) => relatedness(b) - relatedness(a));
  const other = rest.filter((p) => relatedness(p) === 0);

  const queue = [tappedPost];
  let ri = 0, oi = 0;
  while (ri < related.length || oi < other.length) {
    if (ri < related.length) queue.push(related[ri++]);
    if (ri < related.length) queue.push(related[ri++]);
    if (oi < other.length) queue.push(other[oi++]);
  }
  return queue;
}