package social.celesteapp;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.Keep;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.onesignal.notifications.IDisplayableMutableNotification;
import com.onesignal.notifications.INotificationReceivedEvent;
import com.onesignal.notifications.INotificationServiceExtension;
import org.json.JSONObject;

@Keep
public class NotificationServiceExtension implements INotificationServiceExtension {

  public static final String CALL_CHANNEL_ID = "celeste_calls";

  @Override
  public void onNotificationReceived(INotificationReceivedEvent event) {
    IDisplayableMutableNotification notification = event.getNotification();
    JSONObject data = notification.getAdditionalData();
    String type = data != null ? data.optString("type", "") : "";
    Context context = event.getContext();

    if ("cancel_call".equals(type)) {
      event.preventDefault(); // signal technique : jamais de notification visible pour celui-ci
      dismissCall(context, data.optString("callId", ""));
      return;
    }

    if (!"incoming_call".equals(type)) return; // notification normale : comportement par défaut d'OneSignal

    if (MainActivity.isForeground) {
      // L'app est déjà ouverte : la sonnerie React (IncomingCallGate) s'en charge déjà.
      event.preventDefault();
      return;
    }

    event.preventDefault(); // on affiche nous-mêmes, pour maîtriser l'ID et pouvoir l'annuler plus tard
    showCallNotification(context,
        data.optString("callId", ""),
        data.optString("callerName", "Quelqu'un"),
        data.optBoolean("video", true));
  }

  private void showCallNotification(Context context, String callId, String callerName, boolean isVideo) {
    ensureCallChannel(context);
    int notifId = callId.hashCode();

    Intent fullScreenIntent = new Intent(context, IncomingCallActivity.class);
    fullScreenIntent.putExtra("callId", callId);
    fullScreenIntent.putExtra("callerName", callerName);
    fullScreenIntent.putExtra("video", isVideo);
    fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
        context, notifId, fullScreenIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CALL_CHANNEL_ID)
        .setSmallIcon(context.getApplicationInfo().icon)
        .setContentTitle(isVideo ? "Appel vidéo entrant" : "Appel entrant")
        .setContentText(callerName)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setOngoing(true)
        .setAutoCancel(false)
        .setFullScreenIntent(fullScreenPendingIntent, true)
        .setContentIntent(fullScreenPendingIntent);

    NotificationManagerCompat.from(context).notify(notifId, builder.build());
  }

  private void dismissCall(Context context, String callId) {
    if (callId == null || callId.isEmpty()) return;
    NotificationManagerCompat.from(context).cancel(callId.hashCode());
    IncomingCallActivity.cancelIfShowing(callId);
  }

  private void ensureCallChannel(Context context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm != null && nm.getNotificationChannel(CALL_CHANNEL_ID) == null) {
        NotificationChannel channel = new NotificationChannel(
            CALL_CHANNEL_ID, "Appels entrants", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Sonnerie des appels audio et vidéo Céleste");
        channel.enableVibration(true);
        channel.setSound(null, null); // la sonnerie est jouée par IncomingCallActivity, pas par le canal
        nm.createNotificationChannel(channel);
      }
    }
  }
}