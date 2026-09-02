package social.celesteapp;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
public void onCreate(Bundle savedInstanceState) {
    setTheme(R.style.AppTheme_NoActionBar);
    registerPlugin(NativeBackgroundPlugin.class);
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
}

  @Override
  public void onStart() {
    super.onStart();
    this.bridge.getWebView().setBackgroundColor(android.graphics.Color.BLACK);
    WebSettings settings = this.bridge.getWebView().getSettings();
    settings.setTextZoom(100);
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    String action = intent.getAction();
    String type = intent.getType();
    if (Intent.ACTION_SEND.equals(action) && type != null) {
      setIntent(intent);
      bridge.eval("window.dispatchEvent(new Event('sendIntentReceived'))", new ValueCallback<String>() {
        @Override
        public void onReceiveValue(String s) { }
      });
    }
  }
}