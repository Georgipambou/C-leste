const SITE = "https://celesteapp.social";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default async function handler(req, res) {
  const slug = String(req.query.slug || "");
  const valid = /^[a-f0-9]{10}$/.test(slug);

  let name = "";
  if (valid) {
    try {
      const anon = process.env.VITE_SUPABASE_ANON;
      const r = await fetch(process.env.VITE_SUPABASE_URL + "/rest/v1/rpc/anon_get_link_public", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anon, Authorization: "Bearer " + anon },
        body: JSON.stringify({ p_slug: slug }),
      });
      const d = await r.json();
      if (d && d.ok) name = d.name || "";
    } catch (e) {}
  }

  const title = name ? "Envoie un message anonyme à " + name : "Envoie un message anonyme";
  const desc = "Écris ce que tu penses, sans créer de compte. Ton nom ne sera pas affiché.";
  const url = SITE + "/a/" + slug;
  const image = SITE + "/anon-og.png";

  const tags = [
    "<title>" + esc(title) + "</title>",
    '<meta name="robots" content="noindex">',
    '<meta name="description" content="' + esc(desc) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Céleste">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:url" content="' + esc(url) + '">',
    '<meta property="og:image" content="' + image + '">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(title) + '">',
    '<meta name="twitter:description" content="' + esc(desc) + '">',
    '<meta name="twitter:image" content="' + image + '">',
  ].join("\n    ");

  let html;
  try {
    const page = await fetch(SITE + "/index.html");
    html = await page.text();
  } catch (e) {
    res.status(502).send("Erreur de chargement");
    return;
  }

  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+(?:property|name)=["'](?:og:[^"']*|twitter:[^"']*|description)["'][^>]*>/gi, "")
    .replace("</head>", "    " + tags + "\n  </head>");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(html);
}