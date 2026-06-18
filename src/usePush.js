import OneSignal from '@onesignal/capacitor-plugin';
import { Capacitor } from '@capacitor/core';

export async function subscribePush(supabaseClient, userId) {
  if (!Capacitor.isNativePlatform()) {
    console.log("Push ignoré — plateforme non native (web)");
    return null;
  }
  try {
    await OneSignal.initialize('641fff4e-e02d-4fb5-b0d4-c1a479996b20');
    const permission = await OneSignal.Notifications.requestPermission(true);
    console.log("Permission notif:", permission);
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