package social.celesteapp;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeBackground")
public class NativeBackgroundPlugin extends Plugin {

    @PluginMethod
    public void setColor(PluginCall call) {
        String hex = call.getString("color", "#000000");
        getActivity().runOnUiThread(() -> {
            try {
                int color = Color.parseColor(hex);
                getActivity().getWindow().setBackgroundDrawable(new ColorDrawable(color));
            } catch (Exception e) {
                // couleur invalide : on ignore silencieusement, jamais de crash
            }
        });
        JSObject ret = new JSObject();
        ret.put("applied", true);
        call.resolve(ret);
    }
}