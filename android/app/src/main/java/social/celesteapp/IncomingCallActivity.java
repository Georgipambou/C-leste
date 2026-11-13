package social.celesteapp;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.WindowManager;
import android.widget.TextView;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

public class IncomingCallActivity extends AppCompatActivity {

  private static volatile IncomingCallActivity currentInstance;
  private String callId;
  private MediaPlayer ringtonePlayer;
  private Vibrator vibrator;

  public static void cancelIfShowing(String callId) {
    IncomingCallActivity instance = currentInstance;
    if (instance != null && callId != null && callId.equals(instance.callId)) {
      instance.runOnUiThread(() -> { instance.stopRinging(); instance.finish(); });
    }
  }

  @Override
  protected void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    callId = getIntent().getStringExtra("callId");
    currentInstance = this;

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
      KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
      if (km != null) km.requestDismissKeyguard(this, null);
    } else {
      getWindow().addFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
          | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
          | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
          | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    setContentView(R.layout.activity_incoming_call);

    String callerName = getIntent().getStringExtra("callerName");
    boolean isVideo = getIntent().getBooleanExtra("video", true);
    String callId = getIntent().getStringExtra("callId");

    ((TextView) findViewById(R.id.callerNameText)).setText(callerName != null ? callerName : "Appel entrant");
    ((TextView) findViewById(R.id.callTypeText)).setText(isVideo ? "Appel vidéo entrant" : "Appel audio entrant");

    findViewById(R.id.acceptButton).setOnClickListener(v -> {
      stopRinging();
      launchApp(callId, true);
      finish();
    });

    findViewById(R.id.declineButton).setOnClickListener(v -> {
      stopRinging();
      launchApp(callId, false);
      finish();
    });

    startRinging();
  }

  private void startRinging() {
    try {
      Uri ringtoneUri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_RINGTONE);
      ringtonePlayer = new MediaPlayer();
      ringtonePlayer.setAudioAttributes(new AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build());
      ringtonePlayer.setDataSource(this, ringtoneUri);
      ringtonePlayer.setLooping(true);
      ringtonePlayer.prepare();
      ringtonePlayer.start();
    } catch (Exception e) {
      // pas bloquant : l'appel reste affichable sans son
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
      if (vibrator != null) {
        vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 800, 800}, 0));
      }
    }
  }

  private void stopRinging() {
    if (ringtonePlayer != null) {
      try { ringtonePlayer.stop(); ringtonePlayer.release(); } catch (Exception ignored) {}
      ringtonePlayer = null;
    }
    if (vibrator != null) vibrator.cancel();
  }

  private void launchApp(String callId, boolean accept) {
    Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (intent != null) {
      intent.putExtra("celeste_call_id", callId);
      intent.putExtra("celeste_call_action", accept ? "accept" : "decline");
      intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      startActivity(intent);
    }
  }

  @Override
  protected void onDestroy() {
    super.onDestroy();
    stopRinging();
    if (currentInstance == this) currentInstance = null;
  }
}