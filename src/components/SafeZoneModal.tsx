import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ShieldCheck, MapPin, Plus, X, Search, Trash2, Navigation, CheckCircle2 } from 'lucide-react';
import type { Id } from '../../convex/_generated/dataModel';

interface SafeZoneModalProps {
  onClose: () => void;
  currentLat: number;
  currentLng: number;
}

interface GeocodeResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
}

export function SafeZoneModal({ onClose, currentLat, currentLng }: SafeZoneModalProps) {
  const safeZones = useQuery(api.telemetry.getSafeZones);
  const addSafeZoneMutation = useMutation(api.telemetry.addSafeZone);
  const deleteSafeZoneMutation = useMutation(api.telemetry.deleteSafeZone);

  const [name, setName] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [radius, setRadius] = useState(200);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetCoords, setTargetCoords] = useState<{ lat: number; lng: number }>({
    lat: currentLat,
    lng: currentLng,
  });
  const [resolvedAddress, setResolvedAddress] = useState<string>('Using Current Live Location');

  // Search any location, college, university, hostel, landmark, or address via OpenStreetMap
  const handleSearchAddress = async () => {
    if (!addressInput.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const query = encodeURIComponent(addressInput.trim());
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5&addressdetails=1`);
      const data: GeocodeResult[] = await res.json();
      if (data && data.length > 0) {
        setSearchResults(data);
        // Automatically select first result by default
        const first = data[0];
        setTargetCoords({ lat: parseFloat(first.lat), lng: parseFloat(first.lon) });
        setResolvedAddress(first.display_name);
      } else {
        alert('No matching location found. Try searching with city name or university name (e.g. "SRM University KTR", "IIT Delhi", "Connaught Place Delhi").');
      }
    } catch (e) {
      alert('Geocoding search failed. Please check network connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (result: GeocodeResult) => {
    setTargetCoords({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setResolvedAddress(result.display_name);
    if (!name.trim()) {
      // Auto-suggest zone name from place
      const firstPart = result.display_name.split(',')[0];
      setName(firstPart);
    }
  };

  const handleUseCurrentLocation = () => {
    setTargetCoords({ lat: currentLat, lng: currentLng });
    setResolvedAddress('Using Current Live Location');
    setSearchResults([]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a name/label for the zone (e.g. SRM College, Home, Gym)');
      return;
    }

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
      setSearchResults([]);
      setTargetCoords({ lat: currentLat, lng: currentLng });
      setResolvedAddress('Using Current Live Location');
    } catch (err: any) {
      alert(err.message || 'Failed to add safe zone');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteZone = async (zoneId: Id<"safeZones">) => {
    try {
      await deleteSafeZoneMutation({ zoneId });
    } catch (err: any) {
      alert(err.message || 'Failed to delete zone');
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
          maxWidth: '480px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={24} style={{ color: 'var(--color-safe)' }} />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>Circle Safe Zones</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Geofence alerts when family enters/leaves</p>
            </div>
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
          {/* Zone Label Input */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              1. Zone Label (e.g. College, Home, Office, Gym)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. My College, SRM Campus, Home"
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

          {/* Search College / Address */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              2. Search Location (College, Landmark, Address)
            </label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="Search college, hostel, campus, city..."
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchAddress();
                  }
                }}
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
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <Search size={14} /> {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Quick Action: Use Current GPS Location */}
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              style={{
                marginTop: '6px',
                backgroundColor: 'transparent',
                color: 'var(--accent-primary)',
                border: 'none',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 0',
              }}
            >
              <Navigation size={12} /> Use My Current GPS Coordinates Instead
            </button>
          </div>

          {/* Search Result Suggestions List */}
          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '2px solid var(--border-dark)', padding: '8px', backgroundColor: 'var(--bg-subtle)', maxHeight: '150px', overflowY: 'auto' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Select matching place ({searchResults.length} found):</span>
              {searchResults.map((item) => {
                const isSelected = resolvedAddress === item.display_name;
                return (
                  <div
                    key={item.place_id}
                    onClick={() => handleSelectResult(item)}
                    style={{
                      padding: '6px 8px',
                      backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      color: isSelected ? '#ffffff' : 'var(--text-main)',
                      border: '1px solid var(--border-dark)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <MapPin size={13} style={{ flexShrink: 0, color: isSelected ? '#ffffff' : 'var(--color-safe)' }} />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.display_name}</span>
                    {isSelected && <CheckCircle2 size={13} style={{ flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected Location Summary Box */}
          <div style={{ padding: '8px 10px', backgroundColor: 'var(--bg-card)', border: '2px solid var(--border-dark)', fontSize: '11px', fontWeight: 700 }}>
            <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>Target Location Pin:</span>
            <span style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px', wordBreak: 'break-word' }}>📍 {resolvedAddress}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>({targetCoords.lat.toFixed(5)}, {targetCoords.lng.toFixed(5)})</span>
          </div>

          {/* Radius Selector */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                3. Zone Perimeter Radius
              </label>
              <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--accent-primary)' }}>{radius} Meters</span>
            </div>
            <input
              type="range"
              min="50"
              max="2000"
              step="50"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{ width: '100%', marginTop: '6px', accentColor: 'var(--accent-primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
              <span>50m (Tight)</span>
              <span>500m (Campus)</span>
              <span>2000m (City)</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: '2px solid var(--border-dark)',
              padding: '12px',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow-sm)',
              fontSize: '13px',
              marginTop: '4px',
            }}
          >
            <Plus size={16} /> {isSubmitting ? 'Creating Safe Zone...' : 'Save Circle Safe Zone'}
          </button>
        </form>

        {/* List of Active Safe Zones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active Circle Zones ({safeZones?.length || 0})
          </span>
          {(safeZones || []).length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, fontStyle: 'italic' }}>No safe zones created yet. Add your college, home, or office above!</p>
          ) : (
            (safeZones || []).map((zone) => (
              <div
                key={zone._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '2px solid var(--border-dark)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  <MapPin size={18} style={{ color: 'var(--color-safe)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{zone.name}</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Radius: {zone.radiusMeters}m ({zone.lat.toFixed(4)}, {zone.lng.toFixed(4)})</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteZone(zone._id)}
                  title="Delete safe zone"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--color-emergency)',
                    cursor: 'pointer',
                    padding: '4px',
                    marginLeft: '8px',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
