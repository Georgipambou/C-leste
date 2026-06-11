import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const month = new Date().toISOString().slice(0, 7);
  const monthStart = month + "-01T00:00:00.000Z";
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;

  const { data: pool } = await sb.from("badge_pool").select("*").eq("month", month).maybeSingle();
  if (!pool || pool.distributed) return new Response("No pool", { status: 200 });

  const dailyPool = Math.floor(pool.pool_amount / daysLeft);
  if (dailyPool <= 0) return new Response("Pool too small", { status: 200 });

  const { data: allLikes } = await sb.from("valid_likes").select("author_id").gte("created_at", monthStart);
  const { data: allPosts } = await sb.from("posts").select("author_id").gte("created_at", monthStart);

  const likeCounts: Record<string, number> = {};
  (allLikes || []).forEach(l => { likeCounts[l.author_id] = (likeCounts[l.author_id] || 0) + 1; });

  const postCounts: Record<string, number> = {};
  (allPosts || []).forEach(p => { postCounts[p.author_id] = (postCounts[p.author_id] || 0) + 1; });

  const scores: Record<string, number> = {};
  const allIds = new Set([...Object.keys(likeCounts), ...Object.keys(postCounts)]);
  allIds.forEach(uid => {
    const l = likeCounts[uid] || 0;
    const p = postCounts[uid] || 0;
    if (l > 0 && p > 0) scores[uid] = l * p;
  });

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  if (totalScore === 0) return new Response("No scores", { status: 200 });

  for (const [userId, score] of Object.entries(scores)) {
    const share = Math.floor((score / totalScore) * dailyPool);
    if (share <= 0) continue;

    const { data: w } = await sb.from("wallets").select("*").eq("user_id", userId).maybeSingle();
    if (w) {
      await sb.from("wallets").update({
        balance: w.balance + share,
        total_earned: w.total_earned + share,
        updated_at: new Date().toISOString()
      }).eq("user_id", userId);
    } else {
      await sb.from("wallets").insert({ user_id: userId, balance: share, total_earned: share });
    }

    await sb.from("wallet_transactions").insert({
      user_id: userId, type: "earning", amount: share,
      description: `Gains du jour — ${now.toLocaleDateString("fr-FR")}`,
      month, status: "completed"
    });

    await sb.from("notifications").insert({
      user_id: userId, from_id: userId, type: "earning",
      text: `✦ Tu as reçu ${share.toLocaleString("fr-FR")} F CFA aujourd'hui`,
      read: false
    });
  }

  return new Response(JSON.stringify({ distributed: Object.keys(scores).length, dailyPool }), { status: 200 });
});