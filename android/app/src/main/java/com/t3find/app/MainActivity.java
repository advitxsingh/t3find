package com.t3find.app;

import android.content.Context;
import android.media.AudioManager;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(RingerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

@CapacitorPlugin(name = "RingerPlugin")
class RingerPlugin extends Plugin {

    @PluginMethod
    public void getRingerMode(PluginCall call) {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            int mode = audioManager.getRingerMode();
            String ringerStatus = "Normal";

            if (mode == AudioManager.RINGER_MODE_SILENT) {
                ringerStatus = "Silent";
            } else if (mode == AudioManager.RINGER_MODE_VIBRATE) {
                ringerStatus = "Vibrate";
            } else if (mode == AudioManager.RINGER_MODE_NORMAL) {
                ringerStatus = "Normal";
            }

            JSObject ret = new JSObject();
            ret.put("ringerMode", ringerStatus);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read ringer mode", e);
        }
    }
}
