import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../convex/_generated/api';
import { Battery, Wifi, Navigation, Users, UserPlus, Eye, Bell, BellOff, Zap, LogOut, Edit3, KeyRound, RefreshCw, Radio, MapPin, Volume2, ShieldCheck, Download, Sparkles, Mic, BatteryCharging } from 'lucide-react';
import { MapView } from './components/MapView';
import { AuthForm } from './components/AuthForm';
import { FamilySetupModal } from './components/FamilySetupModal';
import { ProfileEditModal } from './components/ProfileEditModal';
import { SafeZoneModal } from './components/SafeZoneModal';
import { Device } from '@capacitor/device';
import { registerPlugin } from '@capacitor/core';
import type { UserLocation } from './types';
import './App.css';

const RingerPlugin = registerPlugin<{ getRingerMode: () => Promise<{ ringerMode: 'Normal' | 'Silent' | 'Vibrate' }> }>('RingerPlugin');
const NativeBatteryPlugin = registerPlugin<{ getNativeBatteryInfo: () => Promise<{ batteryLevel: number; isCharging: boolean }> }>('NativeBatteryPlugin');
// CURRENT_APP_VERSION must be bumped manually each time a new APK/build is released
const CURRENT_APP_VERSION = "0.0.1";

// Helper to format dynamic relative time (e.g., "Just now", "12s ago", "3m ago")
function formatRelativeTime(timestamp: number | undefined, nowMs: number): string {
  if (!timestamp) return 'Just now';
  const diffSec = Math.max(0, Math.floor((nowMs - timestamp) / 1000));
  if (diffSec < 8) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json();
    const addr = data.address || {};

    const area = addr.suburb || addr.neighbourhood || addr.residential || addr.road || '';
    const city = addr.city || addr.town || addr.village || addr.county || '';
    const state = addr.state || '';
    const postcode = addr.postcode ? ` - ${addr.postcode}` : '';

    const parts = [area, city, state].filter(Boolean);
    return parts.length > 0 ? `${parts.join(', ')}${postcode}` : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (err) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export function App() {
  const { signOut } = useAuthActions();
  
  // Real Convex auth user & reactive database queries
  const user = useQuery(api.telemetry.me);
  const myFamily = useQuery(api.telemetry.getMyFamily);
  const dbFamilyMesh = useQuery(api.telemetry.getFamilyMesh);
  const latestRelease = useQuery(api.telemetry.getLatestRelease);
  const updateTelemetryMutation = useMutation(api.telemetry.updateTelemetry);
  const triggerRemoteSirenMutation = useMutation(api.telemetry.triggerRemoteSiren);
  const triggerCrashAlertMutation = useMutation(api.telemetry.triggerCrashAlert);
  const requestCircleSyncMutation = useMutation(api.telemetry.requestCircleSync);

  const [focusedUser, setFocusedUser] = useState<UserLocation | null>(null);
  const [showFamilyModal, setShowFamilyModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showSafeZoneModal, setShowSafeZoneModal] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const isRecordingAudioRef = useRef<boolean>(false);
  const isLowBatteryWarningSentRef = useRef<boolean>(false);

  // Record 5-second voice audio snippet on SOS trigger
  const handleRecordAndUploadSOSAudio = async () => {
    if (isRecordingAudioRef.current) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    try {
      isRecordingAudioRef.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          updateTelemetryMutation({
            ...localTelemetry,
            isEmergency: true,
            sosAudioUrl: base64Audio,
            heading: 0,
          }).catch(console.error);
        };
        reader.readAsDataURL(audioBlob);
        isRecordingAudioRef.current = false;
      };

      mediaRecorder.start();

      // Stop recording automatically after 5 seconds
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }, 5000);
    } catch (err) {
      console.log('Audio recording error/permission:', err);
      isRecordingAudioRef.current = false;
    }
  };

  // Live ticker to update relative sync time labels ("Just now", "12s ago", "2m ago") in real time
  useEffect(() => {
    const ticker = setInterval(() => setNowMs(Date.now()), 3000);
    return () => clearInterval(ticker);
  }, []);


  // Local device telemetry state
  const [localTelemetry, setLocalTelemetry] = useState<{
    lat: number;
    lng: number;
    locationName: string;
    accuracy: number;
    speed: number | null;
    batteryLevel: number | null;
    isCharging: boolean;
    ringerMode: 'Normal' | 'Silent' | 'Vibrate';
    isEmergency: boolean;
    networkStatus: string;
  }>({
    lat: 37.7749,
    lng: -122.4194,
    locationName: 'Union Square, San Francisco, CA 94108',
    accuracy: 5,
    speed: 0.0,
    batteryLevel: null,
    isCharging: false,
    ringerMode: 'Normal',
    isEmergency: false,
    networkStatus: 'Connecting...',
  });

  // Hardware Accelerometer Crash & Hard Impact Detection Listener
  useEffect(() => {
    let lastAccel = { x: 0, y: 0, z: 0 };
    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      const deltaX = Math.abs(acc.x - lastAccel.x);
      const deltaY = Math.abs(acc.y - lastAccel.y);
      const deltaZ = Math.abs(acc.z - lastAccel.z);
      const totalImpactG = (deltaX + deltaY + deltaZ) / 9.8;

      // High Impact Threshold (> 4.5G force impact)
      if (totalImpactG > 4.5) {
        console.warn('CRASH DETECTED! G-Force Impact:', totalImpactG);
        triggerCrashAlertMutation({ isCrash: true }).catch(console.error);
      }

      lastAccel = { x: acc.x, y: acc.y, z: acc.z };
    };

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleMotion);
    }
    return () => {
      if (window.DeviceMotionEvent) {
        window.removeEventListener('devicemotion', handleMotion);
      }
    };
  }, [triggerCrashAlertMutation]);

  // Query Network API (detect Wi-Fi vs Cellular Network Connection)
  const getNetworkState = (): string => {
    const conn: any = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      if (conn.type === 'wifi') {
        return '📶 Connected to Wi-Fi';
      } else if (conn.type === 'cellular') {
        return '📡 Cellular Data';
      } else if (navigator.onLine) {
        return conn.effectiveType ? `📡 ${conn.effectiveType.toUpperCase()} Signal` : '📶 Wi-Fi / Cellular';
      }
    }
    return navigator.onLine ? '📶 Network Connected' : '⚠️ Offline';
  };

  // Manual Force Refresh Handler
  const handleForceRefresh = useCallback(async () => {
    setIsRefreshing(true);
    
    let currentBattery = localTelemetry.batteryLevel;
    let currentCharging = localTelemetry.isCharging;

    // 1. Try Native Java Android BatteryManager Plugin (100% accurate inside APK)
    try {
      const nativeBat = await NativeBatteryPlugin.getNativeBatteryInfo();
      if (nativeBat && nativeBat.batteryLevel !== undefined) {
        currentBattery = nativeBat.batteryLevel;
        currentCharging = nativeBat.isCharging;
        setLocalTelemetry((prev) => ({
          ...prev,
          batteryLevel: currentBattery,
          isCharging: currentCharging,
        }));
      }
    } catch (eNative) {
      // Fallback to Capacitor Device API
      try {
        const info = await Device.getBatteryInfo();
        if (info.batteryLevel !== undefined && info.batteryLevel !== null) {
          currentBattery = Math.round(info.batteryLevel * 100);
          currentCharging = !!info.isCharging;
          setLocalTelemetry((prev) => ({
            ...prev,
            batteryLevel: currentBattery,
            isCharging: currentCharging,
          }));
        }
      } catch (e) {
        if ('getBattery' in navigator) {
          try {
            const battery: any = await (navigator as any).getBattery();
            currentBattery = Math.round(battery.level * 100);
            currentCharging = battery.charging;
            setLocalTelemetry((prev) => ({
              ...prev,
              batteryLevel: currentBattery,
              isCharging: currentCharging,
            }));
          } catch (e2) {
            console.log('Battery API fallback');
          }
        }
      }
    }

    // 2. Query Native Android Hardware Ringer Mode (Normal / Silent / Vibrate)
    let currentRinger = localTelemetry.ringerMode;
    try {
      const res = await RingerPlugin.getRingerMode();
      if (res && res.ringerMode) {
        currentRinger = res.ringerMode;
      }
    } catch (e) {
      console.log('Ringer native query fallback');
    }

    const currentNetwork = getNetworkState();

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const addressName = await reverseGeocode(lat, lng);

          setLocalTelemetry((prev) => {
            const freshTelemetry = {
              ...prev,
              lat,
              lng,
              locationName: addressName,
              accuracy: Math.round(pos.coords.accuracy),
              speed: pos.coords.speed,
              batteryLevel: currentBattery,
              isCharging: currentCharging,
              ringerMode: currentRinger,
              networkStatus: currentNetwork,
            };

            if (user) {
              updateTelemetryMutation({
                ...freshTelemetry,
                heading: 0,
              }).catch(console.error);
            }

            return freshTelemetry;
          });

          setIsRefreshing(false);
        },
        (err) => {
          console.error('GPS Refresh Error:', err);
          setIsRefreshing(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setIsRefreshing(false);
    }
  }, [user?._id, localTelemetry, updateTelemetryMutation]);

  // Query Native Battery and Ringer immediately on initial app load
  useEffect(() => {
    async function loadInitialDeviceState() {
      try {
        const nativeBat = await NativeBatteryPlugin.getNativeBatteryInfo();
        if (nativeBat && nativeBat.batteryLevel !== undefined) {
          setLocalTelemetry((prev) => ({
            ...prev,
            batteryLevel: nativeBat.batteryLevel,
            isCharging: nativeBat.isCharging,
          }));
        }
      } catch (e) {
        // Fallback to Capacitor Device API
        try {
          const info = await Device.getBatteryInfo();
          if (info.batteryLevel !== undefined && info.batteryLevel !== null) {
            setLocalTelemetry((prev) => ({
              ...prev,
              batteryLevel: Math.round((info.batteryLevel || 0) * 100),
              isCharging: !!info.isCharging,
            }));
          }
        } catch (e2) {}
      }

      try {
        const ringer = await RingerPlugin.getRingerMode();
        if (ringer && ringer.ringerMode) {
          setLocalTelemetry((prev) => ({
            ...prev,
            ringerMode: ringer.ringerMode,
          }));
        }
      } catch (eRinger) {}
    }

    loadInitialDeviceState();
  }, []);

  // Listen to remote circle refresh pings from family members tapping "Sync"
  const myDbRecord = (dbFamilyMesh || []).find((t) => t.userId === user?._id);
  const remotePingTimestamp = myDbRecord?.requestRefreshPing;
  const lastHandledPingRef = useRef<number>(0);

  useEffect(() => {
    if (remotePingTimestamp && remotePingTimestamp > lastHandledPingRef.current) {
      lastHandledPingRef.current = remotePingTimestamp;
      handleForceRefresh();
    }
  }, [remotePingTimestamp]);


  // NOTE: No background heartbeat interval — watchPosition handles continuous updates
  // and handleForceRefresh is only called on manual Sync button tap or remote ping.

  // Watch GPS location efficiently (triggers DB updates at most once every 15 seconds)
  useEffect(() => {
    if (user && 'geolocation' in navigator) {
      let lastAddressLat = 0;
      let lastAddressLng = 0;
      let lastDbUpdate = 0;

      const watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const now = Date.now();

          // Only do heavy address reverse-geocoding if moved significantly (> 0.0002 deg (~20m))
          let addressName = localTelemetry.locationName;
          if (Math.abs(lat - lastAddressLat) > 0.0002 || Math.abs(lng - lastAddressLng) > 0.0002) {
            addressName = await reverseGeocode(lat, lng);
            lastAddressLat = lat;
            lastAddressLng = lng;
          }

          const currentNetwork = getNetworkState();

          setLocalTelemetry((prev) => {
            const updated = {
              ...prev,
              lat,
              lng,
              locationName: addressName,
              accuracy: Math.round(pos.coords.accuracy),
              speed: pos.coords.speed,
              networkStatus: currentNetwork,
            };

            // Throttle database writes to once every 30 seconds to prevent continuous syncing
            if (now - lastDbUpdate > 30000) {
              lastDbUpdate = now;
              const isLowBat = updated.batteryLevel !== null && updated.batteryLevel <= 15 && !updated.isCharging;
              if (isLowBat) {
                isLowBatteryWarningSentRef.current = true;
              }

              updateTelemetryMutation({
                ...updated,
                isLowBatteryWarning: isLowBat || isLowBatteryWarningSentRef.current,
                heading: 0,
              }).catch(console.error);
            }

            return updated;
          });
        },
        (err) => console.log('GPS watch fallback', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user?._id]);

  // Render AuthForm if unauthenticated
  if (user === null) {
    return <AuthForm />;
  }

  // Loading state while checking authentication token
  if (user === undefined) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--bg-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-main)',
        fontWeight: 800,
        fontSize: '16px'
      }}>
        Loading T3Find Network...
      </div>
    );
  }

  // Map Convex DB telemetry array to UserLocation interface
  const dbUsersList: UserLocation[] = (dbFamilyMesh || []).map((t) => ({
    userId: t.userId,
    name: t.name,
    avatar: t.avatar,
    lat: t.lat,
    lng: t.lng,
    locationName: t.locationName || `${t.lat.toFixed(4)}, ${t.lng.toFixed(4)}`,
    accuracy: t.accuracy,
    speed: t.speed,
    heading: t.heading,
    batteryLevel: t.batteryLevel,
    isCharging: t.isCharging,
    ringerMode: t.ringerMode,
    networkStatus: t.networkStatus,
    isEmergency: t.isEmergency,
    isSirenActive: t.isSirenActive,
    isCrashDetected: t.isCrashDetected,
    lastUpdated: t.lastUpdated,
    guardiansCount: (dbFamilyMesh || []).length,
  }));

  // Current logged in user object fallback
  const currentUser: UserLocation = dbUsersList.find((u) => u.userId === user._id) || {
    userId: user._id,
    name: user.name || user.email || 'You',
    avatar: user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=0f172a&color=ffffff`,
    lat: localTelemetry.lat,
    lng: localTelemetry.lng,
    locationName: localTelemetry.locationName,
    accuracy: localTelemetry.accuracy,
    speed: localTelemetry.speed,
    heading: 0,
    batteryLevel: localTelemetry.batteryLevel,
    isCharging: localTelemetry.isCharging,
    ringerMode: localTelemetry.ringerMode,
    networkStatus: localTelemetry.networkStatus,
    isEmergency: localTelemetry.isEmergency,
    isSirenActive: false,
    isCrashDetected: false,
    lastUpdated: Date.now(),
    guardiansCount: dbUsersList.length || 1,
  };

  const allUsers: UserLocation[] = dbUsersList.length > 0 ? dbUsersList : [currentUser];

  const handleToggleSOS = () => {
    const nextEmergencyState = !currentUser.isEmergency;
    setLocalTelemetry((prev) => ({ ...prev, isEmergency: nextEmergencyState }));
    updateTelemetryMutation({
      ...localTelemetry,
      isEmergency: nextEmergencyState,
      heading: 0,
    }).catch(console.error);

    if (nextEmergencyState) {
      handleRecordAndUploadSOSAudio();
    }
  };

  const handleTriggerSiren = async (targetUserId: string) => {
    try {
      await triggerRemoteSirenMutation({ targetUserId: targetUserId as any, active: true });
      alert('🔊 Remote Siren signal transmitted! Target phone will sound beacon at maximum volume.');
    } catch (e: any) {
      alert(e.message || 'Siren trigger failed');
    }
  };

  const activeTargetUser = focusedUser || currentUser;

  const hasNewUpdate = !!(latestRelease && latestRelease.version && latestRelease.version !== CURRENT_APP_VERSION);

  return (
    <div className="app-container">
      {/* Live OTA In-App Update Notification Banner */}
      {hasNewUpdate && (
        <div
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid var(--border-dark)',
            fontSize: '12px',
            fontWeight: 800,
            zIndex: 999,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} />
            <span>
              <strong>Update v{latestRelease?.version} Available!</strong> {latestRelease?.releaseNotes || "New features ready!"}
            </span>
          </div>
          <button
            onClick={() => {
              window.location.reload();
            }}
            style={{
              backgroundColor: '#ffffff',
              color: 'var(--accent-primary)',
              border: '2px solid var(--border-dark)',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Download size={13} /> Update & Relaunch
          </button>
        </div>
      )}

      {/* Top Application Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: '0 0 auto' }}>
          <img
            src="/img.jpg"
            alt="T3Find Logo"
            style={{
              width: '32px',
              height: '32px',
              border: '2px solid var(--border-dark)',
              boxShadow: 'var(--shadow-sm)',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
              T3Find
            </h1>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <Radio size={10} style={{ color: 'var(--color-safe)', flexShrink: 0 }} />
              {myFamily ? `${myFamily.name}` : 'Private Mesh'}
            </span>
          </div>
        </div>

        {/* User Controls & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Safe Zones Button */}
          <button
            onClick={() => setShowSafeZoneModal(true)}
            title="Safe Zones"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--color-safe)',
              border: '2px solid var(--border-dark)',
              padding: '6px 8px',
              fontSize: '11px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              whiteSpace: 'nowrap',
            }}
          >
            <ShieldCheck size={14} />
            <span className="header-btn-label">Zones</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => {
              requestCircleSyncMutation().catch(console.error);
              handleForceRefresh();
            }}
            disabled={isRefreshing}
            title="Sync"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-main)',
              border: '2px solid var(--border-dark)',
              padding: '6px 8px',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: isRefreshing ? 'wait' : 'pointer',
              boxShadow: 'var(--shadow-sm)',
              whiteSpace: 'nowrap',
            }}
          >
            <RefreshCw size={14} style={{ transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} />
            <span className="header-btn-label">{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {myFamily ? (
            <div
              className="header-code"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'var(--bg-subtle)',
                border: '2px solid var(--border-dark)',
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: 800,
                boxShadow: 'var(--shadow-sm)',
                whiteSpace: 'nowrap',
              }}>
              <KeyRound size={12} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ color: 'var(--accent-primary)', letterSpacing: '0.5px' }}>{myFamily.inviteCode}</span>
            </div>
          ) : (
            <button
              onClick={() => setShowFamilyModal(true)}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: '2px solid var(--border-dark)',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: 'var(--shadow-sm)',
                whiteSpace: 'nowrap',
              }}
            >
              <UserPlus size={14} />
              <span className="header-btn-label">Circle</span>
            </button>
          )}

          <div
            onClick={() => setShowProfileModal(true)}
            title="Edit Profile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--bg-subtle)',
              border: '2px solid var(--border-dark)',
              padding: '4px 8px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              flexShrink: 0,
            }}
          >
            <img src={currentUser.avatar} alt={currentUser.name} style={{ width: '24px', height: '24px', objectFit: 'cover', flexShrink: 0 }} />
            <Edit3 size={12} style={{ color: 'var(--text-muted)' }} className="header-btn-label" />
          </div>

          <button
            onClick={() => signOut()}
            title="Sign out"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-muted)',
              border: '2px solid var(--border-dark)',
              padding: '6px 8px',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="workspace-grid">
        {/* Left Map View Area */}
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            border: '2px solid var(--border-dark)',
            boxShadow: 'var(--shadow-md)'
          }}
        >
          <MapView
            currentUser={currentUser}
            allUsers={allUsers}
            selectedUser={activeTargetUser}
            onSelectUser={(u) => setFocusedUser(u)}
          />
        </section>

        {/* Right Telemetry & Family Mesh Sidebar */}
        <aside
          className="sidebar-container"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '2px solid var(--border-dark)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-md)',
            overflowY: 'auto'
          }}
        >
          {/* Hero SOS Button & Focus Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '16px',
              borderBottom: '2px solid var(--border-dark)'
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                FOCUS MEMBER
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                {activeTargetUser.name}
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                Synced: {formatRelativeTime(activeTargetUser.lastUpdated, nowMs)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Trigger Siren Action Button */}
              {activeTargetUser.userId !== currentUser.userId && (
                <button
                  onClick={() => handleTriggerSiren(activeTargetUser.userId)}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: '2px solid var(--border-dark)',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <Volume2 size={15} /> Siren
                </button>
              )}

              <button
                onClick={handleToggleSOS}
                className={`sos-hero-ring ${currentUser.isEmergency ? 'active' : ''}`}
                style={{
                  backgroundColor: currentUser.isEmergency ? 'var(--color-emergency)' : 'var(--accent-primary)',
                  fontSize: '15px',
                  fontWeight: 900
                }}
              >
                {currentUser.isEmergency ? 'STOP' : 'SOS'}
              </button>
            </div>
          </div>

          {/* 🎙️ Emergency SOS 5-Second Voice Recording Player */}
          {activeTargetUser.sosAudioUrl && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '2px solid var(--color-emergency)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-emergency)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Mic size={14} /> 🎙️ SOS EMERGENCY AUDIO SNIPPET (5s)
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Recorded on SOS</span>
              </div>
              <audio controls src={activeTargetUser.sosAudioUrl} style={{ width: '100%', height: '36px', marginTop: '2px' }} />
            </div>
          )}

          {/* 🪫 Critical Low Battery Pre-Shutdown Warning Banner */}
          {(activeTargetUser.isLowBatteryWarning || (activeTargetUser.batteryLevel !== null && activeTargetUser.batteryLevel <= 15 && !activeTargetUser.isCharging)) && (
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '2px solid #f59e0b',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <BatteryCharging size={22} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '12px', fontWeight: 900, color: '#b45309', display: 'block' }}>
                  🪫 CRITICAL LOW BATTERY PRE-SHUTDOWN ({activeTargetUser.batteryLevel !== null ? `${activeTargetUser.batteryLevel}%` : '<15%'})
                </span>
                <span style={{ fontSize: '10px', color: '#92400e', fontWeight: 600 }}>
                  Last known high-accuracy GPS location pinned before device powers off.
                </span>
              </div>
            </div>
          )}

          {/* Reverse Geocoded Full Location Address Bar */}
          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '2px solid var(--border-dark)',
              padding: '12px 14px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <MapPin size={18} style={{ color: 'var(--color-emergency)', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                CURRENT LOCATION ADDRESS
              </span>
              <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px', lineHeight: '1.4' }}>
                {activeTargetUser.locationName || 'Fetching address...'}
              </p>
            </div>
          </div>

          {/* Focused Member Diagnostic Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              backgroundColor: 'var(--bg-subtle)',
              padding: '14px',
              border: '2px solid var(--border-dark)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {/* Battery & Power State */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Battery size={14} /> BATTERY
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '15px', fontWeight: 900, color: activeTargetUser.batteryLevel !== null && activeTargetUser.batteryLevel <= 20 ? 'var(--color-emergency)' : 'var(--text-main)' }}>
                  {activeTargetUser.batteryLevel !== null && activeTargetUser.batteryLevel !== undefined ? `${activeTargetUser.batteryLevel}%` : 'Unavailable'}
                </span>
                {activeTargetUser.isCharging ? (
                  <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Zap size={12} /> Charging
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Discharging</span>
                )}
              </div>
            </div>

            {/* Sound Profile / Ringer Telemetry (Automated Hardware Read) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                {activeTargetUser.ringerMode === 'Silent' ? <BellOff size={14} style={{ color: 'var(--color-emergency)' }} /> : <Bell size={14} />} SOUND PROFILE
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: 900, 
                  color: activeTargetUser.ringerMode === 'Silent' ? 'var(--color-emergency)' : 'var(--text-main)' 
                }}>
                  {activeTargetUser.ringerMode === 'Silent' ? '🔇 Silent' : activeTargetUser.ringerMode === 'Vibrate' ? '📳 Vibrate' : '🔔 Normal'}
                </span>
              </div>
            </div>

            {/* Network Connection / Wi-Fi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Wifi size={14} /> NETWORK CONNECTION
              </span>
              <span style={{ fontSize: '13px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                {activeTargetUser.networkStatus || 'Connected'}
              </span>
            </div>

            {/* Speed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Navigation size={14} /> MOTION
              </span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--color-safe)', marginTop: '2px' }}>
                {activeTargetUser.speed ? `${(activeTargetUser.speed * 3.6).toFixed(1)} km/h` : 'Stationary'}
              </span>
            </div>
          </div>

          {/* Family Member Mesh List */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} style={{ color: 'var(--accent-primary)' }} /> CIRCLE MEMBERS ({allUsers.length})
              </span>
              <button
                onClick={() => setShowFamilyModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <UserPlus size={14} /> Code
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
              {allUsers.map((member) => {
                const isSelected = activeTargetUser.userId === member.userId;
                return (
                  <div
                    key={member.userId}
                    onClick={() => setFocusedUser(member)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      backgroundColor: isSelected ? 'var(--bg-subtle)' : 'var(--bg-card)',
                      border: isSelected ? '2px solid var(--accent-primary)' : '2px solid var(--border-light)',
                      cursor: 'pointer',
                      boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={member.avatar} alt={member.name} style={{ width: '40px', height: '40px', objectFit: 'cover', border: '1px solid var(--border-dark)' }} />
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>{member.name}</p>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '1px' }}>
                          {member.locationName ? member.locationName.split(',').slice(0, 2).join(',') : 'Locating...'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', flexWrap: 'wrap' }}>
                          <span>
                            {member.batteryLevel !== null && member.batteryLevel !== undefined ? `${member.batteryLevel}%` : 'N/A'} {member.isCharging ? '⚡' : '🔋'}
                          </span>
                          <span>•</span>
                          <span style={{ color: member.ringerMode === 'Silent' ? 'var(--color-emergency)' : 'inherit', fontWeight: member.ringerMode === 'Silent' ? 700 : 500 }}>
                            {member.ringerMode === 'Silent' ? '🔇 Silent' : member.ringerMode === 'Vibrate' ? '📳 Vibrate' : '🔔 Ring'}
                          </span>
                          <span>•</span>
                          <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                            {formatRelativeTime(member.lastUpdated, nowMs)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)',
                        border: '2px solid var(--border-dark)',
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Eye size={13} /> {isSelected ? 'Focused' : 'Locate'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </main>

      {/* Modals */}
      {showFamilyModal && <FamilySetupModal onClose={() => setShowFamilyModal(false)} />}
      {showProfileModal && <ProfileEditModal currentName={currentUser.name} currentAvatar={currentUser.avatar} onClose={() => setShowProfileModal(false)} />}
      {showSafeZoneModal && <SafeZoneModal onClose={() => setShowSafeZoneModal(false)} currentLat={currentUser.lat} currentLng={currentUser.lng} />}
    </div>
  );
}

export default App;
