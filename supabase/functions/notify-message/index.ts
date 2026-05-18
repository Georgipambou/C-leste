import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record;
    if (!record) return new Response("Pas de record", { status: 400 });

    const senderId = record.sender_id;
    const convId = record.conv_id;
    const msgText = record.text || "";
    const msgType = record.type || "text";

    const { data: conv } = await supabase
      .from("conversations")
      .select("user1_id, user2_id")
      .eq("id", convId)
      .single();

    if (!conv) return new Response("Conversation introuvable", { status: 200 });

    const recipientId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;

    const { data: subData } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", recipientId)
      .single();

    if (!subData?.subscription) return new Response("Pas de subscription", { status: 200 });

    const sub = JSON.parse(subData.subscription);
    const onesignalId = sub.onesignal_id;
    if (!onesignalId) return new Response("Pas d'ID OneSignal", { status: 200 });

    const { data: sender } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("id", senderId)
      .single();

    const senderName = sender
      ? `${sender.prenom || ""} ${(sender.nom || "")[0] || ""}.`.trim()
      : "Quelqu'un";

    const notifBody =
      msgType === "photo" ? "📷 Photo"
      : msgType === "video" ? "🎥 Vidéo"
      : msgType === "file" ? "📎 Fichier"
      : msgText || "…";

    const osRes = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: [onesignalId],
        headings: { en: `✦ ${senderName}` },
        contents: { en: notifBody },
        url: "/",
      }),
    });

    const osBody = await osRes.json();
    console.log("OneSignal status:", osRes.status, JSON.stringify(osBody));

    return new Response(JSON.stringify(osBody), { status: 200 });
  } catch (err) {
    console.error("Erreur:", err);
    return new Response("Erreur interne", { status: 500 });
  }
});
