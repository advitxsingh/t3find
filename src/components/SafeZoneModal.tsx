import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ShieldCheck, MapPin, Plus, X, Search } from 'lucide-react';

interface SafeZoneModalProps {
  onClose: () => void;
  currentLat: number;
  currentLng: number;
}

export function SafeZoneModal({ onClose, currentLat, currentLng }: SafeZoneModalProps) {
  const safeZones = useQuery(api.telemetry.getSafeZones);
  const addSafeZoneMutation = useMutation(api.telemetry.addSafeZone);

  const [name, setName] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [radius, setRadius] = useState(200);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetCoords, setTargetCoords] = useState<{ lat: number; lng: number }>({
    lat: currentLat,
    lng: currentLng,
  });
  const [resolvedAddress, setResolvedAddress] = useState<string>('Using Current Location');

  // Search Custom Address Coordinates via OpenStreetMap Nominatim Geocoding API
  const handleSearchAddress = async () => {
    if (!addressInput.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressInput.trim())}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const foundLat = parseFloat(data[0].lat);
        const foundLng = parseFloat(data[0].lon);
        setTargetCoords({ lat: foundLat, lng: foundLng });
        setResolvedAddress(data[0].display_name);
      } else {
        alert('Could not find location address. Try entering a city or landmark name.');
      }
    } catch (e) {
      alert('Geocoding search failed. Check network connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await addSafeZoneMutation({
        name: name.trim(),
        lat: targetCoords.lat,
        lng: targetCoords.lng,
        radiusMeters: radius,
      });
      setName('');
      setAddressInput('');
      setTargetCoords({ lat: currentLat, lng: currentLng });
      setResolvedAddress('Using Current Location');
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
          maxWidth: '460px',
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

        {/* Add Safe Zone Form with Address Search */}
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Zone Label (e.g. Home, Office, Gym)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Home, School, Office"
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
              Custom Address Search (Optional)
            </label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="Search any city or address..."
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '2px solid var(--border-dark)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-main)',
                  fontWeight: 800,
                  fontSize: '12px',
                }}
              />
              <button
                type="button"
                onClick={handleSearchAddress}
                disabled={isSearching}
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-main)',
                  border: '2px solid var(--border-dark)',
                  padding: '8px 12px',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Search size={14} /> {isSearching ? '...' : 'Find'}
              </button>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 700, marginTop: '4px', display: 'block' }}>
              Selected Location: {resolvedAddress}
            </span>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Radius ({radius} Meters)
            </label>
            <input
              type="range"
              min="100"
              max="2000"
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
            <Plus size={16} /> {isSubmitting ? 'Creating Zone...' : 'Save Circle Safe Zone'}
          </button>
        </form>

        {/* List of Active Safe Zones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
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
