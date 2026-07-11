/**
 * soundLibrary.js — Céleste
 * Couche d'accès aux sons (table `sounds`, déjà créée dans la migration
 * initiale). `sb` toujours passé en paramètre, jamais importé.
 */

/**
 * Sons tendance, triés par usage_count. À afficher dans un sélecteur
 * de son lors de la publication (CameraStudioModal / NewPostModal).
 */
export async function fetchTrendingSounds(sb, { limit = 20 } = {}) {
  const { data, error } = await sb
    .from("sounds")
    .select("id,title,url,usage_count")
    .order("usage_count", { ascending: false })
    .limit(limit);
  if (error) { console.warn("fetchTrendingSounds:", error.message); return []; }
  return data || [];
}

/**
 * Crée un nouveau son à partir d'un post (cas "son original" — la
 * personne a filmé/enregistré son propre son, comme sur TikTok il
 * devient réutilisable par d'autres). À appeler après l'upload du
 * fichier audio vers R2 (réutilise `uploadToR2`, pas dupliqué ici).
 */
export async function createSoundFromPost(sb, { postId, title, url }) {
  const { data, error } = await sb
    .from("sounds")
    .insert({ title: title?.slice(0, 80) || "Son original", url, source_post_id: postId, usage_count: 1 })
    .select("id")
    .single();
  if (error) { console.warn("createSoundFromPost:", error.message); return null; }
  return data?.id || null;
}

/**
 * Attache un son existant (choisi dans la liste tendance) à un post,
 * et incrémente son usage_count. À appeler au moment de la publication
 * si l'utilisateur a choisi un son déjà existant plutôt que d'en créer un.
 */
export async function attachExistingSound(sb, { postId, soundId }) {
  const [{ error: postErr }, { error: rpcErr }] = await Promise.all([
    sb.from("posts").update({ sound_id: soundId }).eq("id", postId),
    sb.rpc("increment_sound_usage", { target_sound_id: soundId }),
  ]);
  if (postErr) console.warn("attachExistingSound (post):", postErr.message);
  if (rpcErr) console.warn("attachExistingSound (usage):", rpcErr.message);
}
