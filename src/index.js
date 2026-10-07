const MAX_SIZE = 100 * 1024 * 1024; // limite Cloudflare (plan gratuit/Pro) pour le corps d'une requête

const cors = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});

const json = (data, status, h) =>
  new Response(JSON.stringify(data), { status, headers: { ...h, "Content-Type": "application/json" } });

export default {
  async fetch(req, env) {
    const allowed = env.ALLOWED_ORIGINS.split(",");
    const origin = req.headers.get("Origin") || "";
    // Capacitor envoie capacitor://localhost ou https://localhost
    const h = cors(allowed.includes(origin) ? origin : allowed[0]);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    if (req.method !== "PUT" || url.pathname !== "/upload") return json({ error: "Not found" }, 404, h);

    // 1) Auth : vérifie le jeton de session auprès de Supabase
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Non authentifié" }, 401, h);
    const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON, Authorization: `Bearer ${token}` },
    });
    if (!u.ok) return json({ error: "Session invalide" }, 401, h);

    // 2) Validations
    const folder = url.searchParams.get("folder") || "media";
    const ext = (url.searchParams.get("ext") || "bin").toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/i.test(folder) || !/^[a-z0-9]{1,8}$/.test(ext)) return json({ error: "Paramètres invalides" }, 400, h);
    const size = Number(req.headers.get("Content-Length") || 0);
    if (!size) return json({ error: "Taille manquante" }, 411, h);
    if (size > MAX_SIZE) return json({ error: "Fichier trop volumineux" }, 413, h);
    const type = req.headers.get("Content-Type") || "application/octet-stream";
    if (!/^(image|video|audio)\//.test(type) && type !== "application/octet-stream") return json({ error: "Type non autorisé" }, 415, h);

    // 3) Écriture directe dans R2 (binding, aucun DNS *.r2.cloudflarestorage.com)
    const key = `${folder}/${crypto.randomUUID()}.${ext}`;
    await env.BUCKET.put(key, req.body, { httpMetadata: { contentType: type } });

    return json({ publicUrl: `${env.PUBLIC_BASE}/${key}`, key }, 200, h);
  },
};