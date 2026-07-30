package com.t3find.app;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.BatteryManager;
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
        registerPlugin(NativeBatteryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

@CapacitorPlugin(name = "NativeBatteryPlugin")
class NativeBatteryPlugin extends Plugin {

    @PluginMethod
    public void getNativeBatteryInfo(PluginCall call) {
        try {
            Context context = getContext();
            IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
            Intent batteryStatus = context.registerReceiver(null, ifilter);

            int level = batteryStatus != null ? batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) : -1;
            int scale = batteryStatus != null ? batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1) : -1;
            float batteryPct = (scale > 0) ? (level * 100 / (float) scale) : 0;

            int status = batteryStatus != null ? batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1) : -1;
            boolean isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL;

            JSObject ret = new JSObject();
            ret.put("batteryLevel", Math.round(batteryPct));
            ret.put("isCharging", isCharging);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to query native Android BatteryManager", e);
        }
    }
}

@CapacitorPlugin(name = "RingerPlugin")
class RingerPlugin extends Plugin {

    @PluginMethod
    public void getRingerMode(PluginCall call) {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            int mode = audioManager.getRingerMode();
            int streamVolume = audioManager.getStreamVolume(AudioManager.STREAM_RING);
            String ringerStatus = "Normal";

            // If Android Ringer Mode is Silent OR Ring stream volume is 0, classify as Silent
            if (mode == AudioManager.RINGER_MODE_SILENT || streamVolume == 0) {
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
