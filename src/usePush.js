export async function subscribePush(supabaseClient, userId) {
  try {
    await new Promise(r => {
  if (window.OneSignal) { r(); return; }
  const t = setInterval(() => {
    if (window.OneSignal) { clearInterval(t); r(); }
  }, 200);
  setTimeout(() => { clearInterval(t); r(); }, 5000);
});
const OneSignal = window.OneSignal;
if (!OneSignal) {
  console.error("OneSignal non chargé");
  return null;
}

    await OneSignal.Notifications.requestPermission();

// Attendre que l'ID soit disponible
await new Promise(r => setTimeout(r, 3000));
    
    const onesignalId = OneSignal.User.PushSubscription.id;
    if (!onesignalId) {
      console.error("Pas d'ID OneSignal après permission");
      return null;
    }

    await supabaseClient.from('push_subscriptions').upsert({
      user_id: userId,
      subscription: JSON.stringify({ onesignal_id: onesignalId }),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    console.log("✦ OneSignal ID enregistré:", onesignalId);
    return true;
  } catch(err) {
    console.error('Erreur OneSignal:', err);
    return null;
  }
}