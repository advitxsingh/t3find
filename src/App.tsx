import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../convex/_generated/api';
import { Battery, Signal, Navigation, Users, UserPlus, Eye, Bell, BellOff, Zap, LogOut, Edit3, KeyRound, RefreshCw, Radio, MapPin } from 'lucide-react';
import { MapView } from './components/MapView';
import { AuthForm } from './components/AuthForm';
import { FamilySetupModal } from './components/FamilySetupModal';
import { ProfileEditModal } from './components/ProfileEditModal';
import type { UserLocation } from './types';
import './App.css';

// Reverse Geocoding helper function using Nominatim OpenStreetMap API
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
  const updateTelemetryMutation = useMutation(api.telemetry.updateTelemetry);

  const [focusedUser, setFocusedUser] = useState<UserLocation | null>(null);
  const [showFamilyModal, setShowFamilyModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Just now');

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
  }>({
    lat: 28.6139,
    lng: 77.2090,
    locationName: 'Connaught Place, New Delhi, Delhi - 110001',
    accuracy: 8,
    speed: 0.8,
    batteryLevel: 92,
    isCharging: false,
    ringerMode: 'Normal',
    isEmergency: false,
  });

  // Manual Force Refresh Handler
  const handleForceRefresh = useCallback(async () => {
    setIsRefreshing(true);
    
    let currentBattery = localTelemetry.batteryLevel;
    let currentCharging = localTelemetry.isCharging;

    if ('getBattery' in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery();
        currentBattery = Math.round(battery.level * 100);
        currentCharging = battery.charging;
      } catch (e) {
        console.log('Battery API fallback');
      }
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          // Reverse geocode to get Area, City, State, Pincode
          const addressName = await reverseGeocode(lat, lng);

          const freshTelemetry = {
            lat,
            lng,
            locationName: addressName,
            accuracy: Math.round(pos.coords.accuracy),
            speed: pos.coords.speed,
            batteryLevel: currentBattery,
            isCharging: currentCharging,
          };

          setLocalTelemetry((prev) => ({ ...prev, ...freshTelemetry }));

          if (user) {
            await updateTelemetryMutation({
              ...localTelemetry,
              ...freshTelemetry,
              heading: 0,
              networkStatus: '5G Active (Synced)',
            }).catch(console.error);
          }

          setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
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

  // Heartbeat background sync interval (runs every 15 seconds)
  useEffect(() => {
    if (!user) return;

    const backgroundSyncInterval = setInterval(() => {
      handleForceRefresh();
    }, 15000);

    return () => clearInterval(backgroundSyncInterval);
  }, [user?._id, handleForceRefresh]);

  // Watch GPS location continuously
  useEffect(() => {
    if (user && 'geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const addressName = await reverseGeocode(lat, lng);

          const newTelemetry = {
            lat,
            lng,
            locationName: addressName,
            accuracy: Math.round(pos.coords.accuracy),
            speed: pos.coords.speed,
          };
          setLocalTelemetry((prev) => ({ ...prev, ...newTelemetry }));
          updateTelemetryMutation({
            ...localTelemetry,
            ...newTelemetry,
            heading: 0,
            networkStatus: '5G Active',
          }).catch(console.error);
          setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        },
        (err) => console.log('GPS watch fallback', err),
        { enableHighAccuracy: true }
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
    networkStatus: '5G Active',
    isEmergency: localTelemetry.isEmergency,
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
      networkStatus: '5G Active',
    }).catch(console.error);
  };

  const handleToggleRingerMode = () => {
    const modes: ('Normal' | 'Silent' | 'Vibrate')[] = ['Normal', 'Silent', 'Vibrate'];
    const nextIdx = (modes.indexOf(currentUser.ringerMode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setLocalTelemetry((prev) => ({ ...prev, ringerMode: nextMode }));
    updateTelemetryMutation({
      ...localTelemetry,
      ringerMode: nextMode,
      heading: 0,
      networkStatus: '5G Active',
    }).catch(console.error);
  };

  const activeTargetUser = focusedUser || currentUser;

  return (
    <div className="app-container">
      {/* Top Application Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/img.jpg"
            alt="T3Find Logo"
            style={{
              width: '36px',
              height: '36px',
              border: '2px solid var(--border-dark)',
              boxShadow: 'var(--shadow-sm)',
              objectFit: 'cover'
            }}
          />
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.6px' }}>
              T3Find
            </h1>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Radio size={11} style={{ color: 'var(--color-safe)' }} />
              {myFamily ? `Circle: ${myFamily.name}` : 'Private Mesh'}
            </span>
          </div>
        </div>

        {/* User Controls & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Manual Refresh Button */}
          <button
            onClick={handleForceRefresh}
            disabled={isRefreshing}
            style={{
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-main)',
              border: '2px solid var(--border-dark)',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isRefreshing ? 'wait' : 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <RefreshCw size={14} style={{ transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} />
            {isRefreshing ? 'Syncing...' : 'Sync'}
          </button>

          {myFamily ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-subtle)',
              border: '2px solid var(--border-dark)',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 800,
              boxShadow: 'var(--shadow-sm)'
            }}>
              <KeyRound size={13} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ color: 'var(--accent-primary)', letterSpacing: '0.5px' }}>{myFamily.inviteCode}</span>
            </div>
          ) : (
            <button
              onClick={() => setShowFamilyModal(true)}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: '2px solid var(--border-dark)',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <UserPlus size={14} /> Circle Code
            </button>
          )}

          <div 
            onClick={() => setShowProfileModal(true)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              backgroundColor: 'var(--bg-subtle)', 
              border: '2px solid var(--border-dark)',
              padding: '4px 10px', 
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <img src={currentUser.avatar} alt={currentUser.name} style={{ width: '26px', height: '26px', objectFit: 'cover' }} />
            <Edit3 size={13} style={{ color: 'var(--text-muted)' }} />
          </div>

          <button
            onClick={() => signOut()}
            style={{
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-muted)',
              border: '2px solid var(--border-dark)',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="workspace-grid">
        {/* Left Map View Area (62% screen height on mobile) */}
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
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Synced: {lastSyncedTime}
              </span>
            </div>

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
                <span style={{ fontSize: '16px', fontWeight: 900, color: activeTargetUser.batteryLevel && activeTargetUser.batteryLevel <= 20 ? 'var(--color-emergency)' : 'var(--text-main)' }}>
                  {activeTargetUser.batteryLevel}%
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

            {/* Sound Profile / Ringer Telemetry */}
            <div 
              onClick={activeTargetUser.userId === currentUser.userId ? handleToggleRingerMode : undefined}
              style={{ display: 'flex', flexDirection: 'column', gap: '4px', cursor: activeTargetUser.userId === currentUser.userId ? 'pointer' : 'default' }}
            >
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

            {/* Network Signal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Signal size={14} /> CELLULAR
              </span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                {activeTargetUser.networkStatus}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <span>
                            {member.batteryLevel}% {member.isCharging ? '⚡ Charging' : '🔋 Discharging'}
                          </span>
                          <span>•</span>
                          <span style={{ color: member.ringerMode === 'Silent' ? 'var(--color-emergency)' : 'inherit', fontWeight: member.ringerMode === 'Silent' ? 700 : 500 }}>
                            {member.ringerMode === 'Silent' ? '🔇 Silent' : member.ringerMode === 'Vibrate' ? '📳 Vibrate' : '🔔 Ring'}
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
    </div>
  );
}

export default App;
