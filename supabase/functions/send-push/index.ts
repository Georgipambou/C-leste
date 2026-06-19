import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ONESIGNAL_APP_ID = "641fff4e-e02d-4fb5-b0d4-c1a479996b20";
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY") ?? "";

Deno.serve(async (req) => {
  try {
    const { targetUserId, title, body } = await req.json();

    if (!targetUserId || !title || !body) {
      return new Response(JSON.stringify({ error: "Parametres manquants" }), { status: 400 });
    }

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [targetUserId] },
        target_channel: "push",
        headings: { fr: title, en: title },
        contents: { fr: body, en: body },
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
