package social.celesteapp;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  public static volatile boolean isForeground = false;

  @Override
  public void onStart() {
    super.onStart();
    isForeground = true;
    WebSettings settings = this.bridge.getWebView().getSettings();
    settings.setTextZoom(100);
    deliverCallSignal(getIntent());
  }

  @Override
  public void onStop() {
    super.onStop();
    isForeground = false;
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    deliverCallSignal(intent);
  }

  private void deliverCallSignal(Intent intent) {
    if (intent == null || this.bridge == null) return;
    String callId = intent.getStringExtra("celeste_call_id");
    String action = intent.getStringExtra("celeste_call_action");
    if (callId == null || action == null) return;

    intent.removeExtra("celeste_call_id");
    intent.removeExtra("celeste_call_action");

    String js = "window.__celesteIncomingCallSignal = {callId:" + org.json.JSONObject.quote(callId)
        + ", action:" + org.json.JSONObject.quote(action) + "};"
        + "window.dispatchEvent(new CustomEvent('celeste-call-signal', {detail: window.__celesteIncomingCallSignal}));";

    this.bridge.getWebView().post(() -> this.bridge.getWebView().evaluateJavascript(js, null));
  }
}