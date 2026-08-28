import OneSignal from '@onesignal/capacitor-plugin';
import { Capacitor } from '@capacitor/core';

let listenerRegistered = false;

export async function subscribePush(supabaseClient, userId) {
  if (!Capacitor.isNativePlatform()) {
    console.log("Push ignore - plateforme non native (web)");
    return null;
  }
  try {
    await OneSignal.initialize('641fff4e-e02d-4fb5-b0d4-c1a479996b20');
    const permission = await OneSignal.Notifications.requestPermission(true);
    console.log("Permission notif:", permission);
    await OneSignal.login(userId);
    console.log("OneSignal initialise pour", userId);

    // Le listener ne doit être enregistré qu'une seule fois par session app,
    // pas à chaque appel de subscribePush (sinon il s'empile à chaque
    // changement d'état d'auth et déclenche plusieurs fois par clic).
    if (!listenerRegistered) {
      listenerRegistered = true;
      OneSignal.Notifications.addEventListener('click', (event) => {
        const data = event?.notification?.additionalData;
        if (!data || !data.type) return;
        if (data.type === 'message' && data.convId) {
          window.dispatchEvent(new CustomEvent('celeste_open_conv', { detail: { convId: data.convId } }));
        } else if (data.type === 'post' && data.postId) {
          window.dispatchEvent(new CustomEvent('celeste_open_post', { detail: { postId: data.postId } }));
        } else if (data.type === 'status' && data.statusId) {
          window.dispatchEvent(new CustomEvent('celeste_open_status', { detail: { statusId: data.statusId } }));
        } else if ((data.type === 'group_message' || data.type === 'group_invite') && data.groupId) {
          window.dispatchEvent(new CustomEvent('celeste_open_group', { detail: { groupId: data.groupId } }));
        } else if (data.type === 'user' && data.userId) {
          window.dispatchEvent(new CustomEvent('celeste_open_user', { detail: { uid: data.userId } }));
        }
      });
    }

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