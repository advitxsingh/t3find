package com.t3find.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.net.Uri;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;

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
        registerPlugin(BackgroundServicePlugin.class);
        super.onCreate(savedInstanceState);

        // Auto request Battery Saver Exemption prompt on launch
        requestIgnoreBatteryOptimizations();

        // Start Persistent Foreground Location Service
        Intent serviceIntent = new Intent(this, PersistentLocationService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void requestIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }
}

class PersistentLocationService extends Service {
    private static final String CHANNEL_ID = "t3find_persistent_mesh";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("T3Find Circle Guardian")
                .setContentText("Active background mesh protection running.")
                .setSmallIcon(android.R.drawable.ic_menu_compass)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setOngoing(true)
                .build();
        startForeground(1001, notification);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY; // Prevents Android OS from killing process when swiped away
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "T3Find Persistent Protection",
                    NotificationManager.IMPORTANCE_MIN
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}

@CapacitorPlugin(name = "BackgroundServicePlugin")
class BackgroundServicePlugin extends Plugin {
    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(context.getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + context.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to request battery saver exemption", e);
        }
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
