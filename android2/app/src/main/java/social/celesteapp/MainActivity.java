package social.celesteapp;

import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
public void onCreate(Bundle savedInstanceState) {
    registerPlugin(NativeBackgroundPlugin.class);
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
}

  @Override
  public void onStart() {
    super.onStart();
    WebSettings settings = this.bridge.getWebView().getSettings();
    settings.setTextZoom(100);
  }
}