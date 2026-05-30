import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json();
    console.log("NotchPay webhook received:", JSON.stringify(body));

    const status = body?.event;
    const reference = body?.payment?.reference || body?.reference;
    const paymentStatus = body?.payment?.status || body?.status;

    if (!reference) {
      return new Response(JSON.stringify({ error: "No reference" }), { status: 400 });
    }

    if (paymentStatus !== "complete" && paymentStatus !== "successful" && status !== "payment.complete") {
      return new Response(JSON.stringify({ message: "Payment not complete yet" }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Trouver le profil avec cette référence de paiement
    const { data: profile, error: findError } = await supabase
      .from("profiles")
      .select("id")
      .eq("badge_payment_ref", reference)
      .maybeSingle();

    if (findError || !profile) {
      console.error("Profile not found for reference:", reference);
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404 });
    }

    // Activer le badge pour 40 jours
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 40);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        badge: "confirmed",
        badge_expires_at: expiresAt.toISOString(),
        badge_payment_ref: null
      })
      .eq("id", profile.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: "Update failed" }), { status: 500 });
    }

    console.log("Badge activated for profile:", profile.id);
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});