import { ShieldAlert, Battery, Zap, Signal, Compass, Navigation, Phone, Users } from 'lucide-react';
import type { UserLocation, GuardianContact } from '../types';

interface TelemetryPanelProps {
  user: UserLocation;
  isSelf: boolean;
  guardians: GuardianContact[];
  onToggleSOS: () => void;
  onSimulateMovement: () => void;
  onAddGuardian: () => void;
}

export function TelemetryPanel({
  user,
  isSelf,
  guardians,
  onToggleSOS,
  onSimulateMovement,
  onAddGuardian
}: TelemetryPanelProps) {
  const getBatteryColor = (level: number | null) => {
    if (!level) return '#9ca3af';
    if (level <= 20) return '#ef4444';
    if (level <= 50) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '16px',
          borderLeft: user.isEmergency ? '4px solid #ef4444' : '4px solid #10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={user.avatar}
            alt={user.name}
            style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #1f293d' }}
          />
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6' }}>{user.name}</h3>
            <span style={{ fontSize: '12px', color: user.isEmergency ? '#ef4444' : '#10b981', fontWeight: 600 }}>
              {user.isEmergency ? '🚨 EMERGENCY ACTIVE' : '🛡️ SAFE & MONITORING'}
            </span>
          </div>
        </div>

        {isSelf && (
          <button
            onClick={onToggleSOS}
            className={user.isEmergency ? 'sos-pulsing' : ''}
            style={{
              backgroundColor: user.isEmergency ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
              color: user.isEmergency ? '#ffffff' : '#ef4444',
              border: '1px solid #ef4444',
              padding: '10px 18px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <ShieldAlert size={18} />
            {user.isEmergency ? 'CANCEL SOS' : 'TRIGGER SOS'}
          </button>
        )}
      </div>

      {/* Telemetry Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {/* Battery Telemetry */}
        <div className="glass-panel" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Battery size={16} /> Battery Level
            </span>
            {user.isCharging && <Zap size={14} style={{ color: '#f59e0b' }} />}
          </div>
          <p style={{ fontSize: '20px', fontWeight: 700, color: getBatteryColor(user.batteryLevel) }}>
            {user.batteryLevel ?? '--'}%
          </p>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>
            {user.isCharging ? 'Charging on AC power' : 'Discharging'}
          </span>
        </div>

        {/* Network Telemetry */}
        <div className="glass-panel" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', color: '#9ca3af' }}>
            <Signal size={16} /> Cellular Network
          </div>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#3b82f6' }}>{user.networkStatus}</p>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Encrypted Channel</span>
        </div>

        {/* Speed Telemetry */}
        <div className="glass-panel" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', color: '#9ca3af' }}>
            <Navigation size={16} /> Movement Speed
          </div>
          <p style={{ fontSize: '20px', fontWeight: 700, color: '#f3f4f6' }}>
            {user.speed ? `${(user.speed * 3.6).toFixed(1)} km/h` : 'Stationary'}
          </p>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>GPS Motion Engine</span>
        </div>

        {/* Accuracy Telemetry */}
        <div className="glass-panel" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', color: '#9ca3af' }}>
            <Compass size={16} /> Precision
          </div>
          <p style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>±{user.accuracy} m</p>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>High Accuracy GPS</span>
        </div>
      </div>

      {/* Guardians Contact List Section */}
      <div className="glass-panel" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} style={{ color: '#3b82f6' }} /> Active Guardians ({guardians.length})
          </h4>
          <button
            onClick={onAddGuardian}
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + Add Guardian
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
          {guardians.map((g) => (
            <div
              key={g.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '10px',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={g.avatar} alt={g.name} style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#f3f4f6' }}>{g.name}</p>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{g.relation} • {g.phone}</span>
                </div>
              </div>

              <a
                href={`tel:${g.phone}`}
                style={{
                  backgroundColor: '#1f293d',
                  color: '#3b82f6',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none'
                }}
              >
                <Phone size={16} />
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Control Simulation Toolbar */}
      {isSelf && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onSimulateMovement}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#1f293d',
              color: '#f3f4f6',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Navigation size={16} style={{ color: '#3b82f6' }} /> Simulate Walking GPS
          </button>
        </div>
      )}
    </div>
  );
}
