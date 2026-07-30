import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ShieldCheck, MapPin, Plus, X } from 'lucide-react';

interface SafeZoneModalProps {
  onClose: () => void;
  currentLat: number;
  currentLng: number;
}

export function SafeZoneModal({ onClose, currentLat, currentLng }: SafeZoneModalProps) {
  const safeZones = useQuery(api.telemetry.getSafeZones);
  const addSafeZoneMutation = useMutation(api.telemetry.addSafeZone);

  const [name, setName] = useState('');
  const [radius, setRadius] = useState(200);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await addSafeZoneMutation({
        name: name.trim(),
        lat: currentLat,
        lng: currentLng,
        radiusMeters: radius,
      });
      setName('');
    } catch (err: any) {
      alert(err.message || 'Failed to add safe zone');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '3px solid var(--border-dark)',
          boxShadow: '0px 10px 0px var(--border-dark)',
          width: '100%',
          maxWidth: '440px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={24} style={{ color: 'var(--color-safe)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>Circle Safe Zones</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '2px solid var(--border-dark)',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--text-main)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Add Safe Zone Form */}
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Zone Name (e.g. Home, Office)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Home, School, Gym"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid var(--border-dark)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-main)',
                fontWeight: 800,
                fontSize: '13px',
                marginTop: '4px',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Radius ({radius} Meters)
            </label>
            <input
              type="range"
              min="100"
              max="1000"
              step="50"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{ width: '100%', marginTop: '6px' }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: '2px solid var(--border-dark)',
              padding: '10px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Plus size={16} /> {isSubmitting ? 'Creating Zone...' : 'Add Current Location as Safe Zone'}
          </button>
        </form>

        {/* List of Active Safe Zones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active Circle Zones ({safeZones?.length || 0})
          </span>
          {(safeZones || []).map((zone) => (
            <div
              key={zone._id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px',
                backgroundColor: 'var(--bg-subtle)',
                border: '2px solid var(--border-dark)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} style={{ color: 'var(--color-safe)' }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>{zone.name}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Radius: {zone.radiusMeters}m</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
