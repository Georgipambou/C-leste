export const VAPID_PUBLIC_KEY = "BJ0GSWi4im-FaE6Wck9eNwTh3Hfjsh2VvbtGYPvVlEqF-HvTSrK-VluONAIZFhFbhwkH51GZsmAQr2oau1rGvDI";

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribePush(supabaseClient, userId) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    await supabaseClient.from('push_subscriptions').upsert({
      user_id: userId,
      subscription: JSON.stringify(sub),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    console.log('✦ Push subscription enregistrée');
    return sub;
  } catch (err) {
    console.error('Erreur subscribePush:', err);
    return null;
  }
}