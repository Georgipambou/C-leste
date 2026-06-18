import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const params = new URL(req.url).searchParams;
    const badgeUserId = params.get("badge_user_id");
    const saleId = params.get("sale_id");

    if (!badgeUserId || !saleId) {
      return new Response(JSON.stringify({ error: "Missing params" }), { status: 400 });
    }

    // Vérifier le paiement auprès de Chariow
    const chariowRes = await fetch(`https://api.chariow.com/v1/sales/${saleId}`, {
      headers: { "Authorization": "Bearer sk_20hoymvf_531d0d8326423d81026fa2b4b78d6a46" }
    });
    const sale = await chariowRes.json();

    if (sale?.status !== "completed" && sale?.status !== "paid") {
      return new Response(JSON.stringify({ error: "Payment not confirmed" }), { status: 402 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Activer le badge 40 jours
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 40);

    await supabase.from("profiles").update({
      badge: "confirmed",
      badge_expires_at: expiresAt.toISOString(),
      badge_payment_ref: null
    }).eq("id", badgeUserId);

    // Mettre à jour le pool du mois
    const month = new Date().toISOString().slice(0, 7);
    const { data: existingPool } = await supabase.from("badge_pool").select("*").eq("month", month).maybeSingle();
    if (existingPool) {
      await supabase.from("badge_pool").update({
        total_collected: existingPool.total_collected + 2000,
        platform_cut: existingPool.platform_cut + 400,
        pool_amount: existingPool.pool_amount + 1600
      }).eq("month", month);
    } else {
      await supabase.from("badge_pool").insert({ month, total_collected: 2000, platform_cut: 400, pool_amount: 1600, distributed: false });
    }

    // Notification
    await supabase.from("notifications").insert({
      user_id: badgeUserId, from_id: badgeUserId,
      type: "badge", text: "🎉 Ton badge certifié est activé ! ✦", read: false
    });

    console.log("Badge Chariow activé pour:", badgeUserId);
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error("Erreur activation badge:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});