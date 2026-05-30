import OneSignal from '@onesignal/capacitor-plugin';

export async function subscribePush(supabaseClient, userId) {
  try {
    await OneSignal.initialize({ appId: '641fff4e-e02d-4fb5-b0d4-c1a479996b20' });
    await OneSignal.Notifications.requestPermission(true);
    await OneSignal.login(userId);
    console.log("✦ OneSignal initialisé pour", userId);
    return true;
  } catch(err) {
    console.error('Erreur OneSignal:', err);
    return null;
  }
}

export async function sendPushToUser(supabaseClient, targetUserId, title, body) {
  try {
    await supabaseClient.functions.invoke('send-push', {
      body: { targetUserId, title, body }
    });
  } catch(err) {
    console.error('Erreur envoi push:', err);
  }
}