import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ShieldCheck, MapPin, Plus, X, Search, Trash2, Navigation, CheckCircle2 } from 'lucide-react';
import type { Id } from '../../convex/_generated/dataModel';
import L from 'leaflet';

interface SafeZoneModalProps {
  onClose: () => void;
  currentLat: number;
  currentLng: number;
}

interface GeocodeResult {
  place_id: string | number;
  display_name: string;
  lat: string;
  lon: string;
}

// Reverse Geocoding helper
async function getAddressFromCoords(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (e) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
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
    lat: currentLat || 12.793,
    lng: currentLng || 77.702,
  });
  const [resolvedAddress, setResolvedAddress] = useState<string>('Using Live Location');

  // Leaflet Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Initialize interactive Leaflet Picker Map inside Modal
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialLat = targetCoords.lat || 12.793;
    const initialLng = targetCoords.lng || 77.702;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // Custom Icon for Selected Safe Zone Pin
    const icon = L.divIcon({
      className: 'custom-safezone-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background-color: #10b981;
          border: 3px solid #0f172a;
          box-shadow: 2px 2px 0px #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 900;
          font-size: 16px;
        ">
          📍
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([initialLat, initialLng], { icon, draggable: true }).addTo(map);
    const circle = L.circle([initialLat, initialLng], {
      radius: radius,
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.25,
      weight: 2,
    }).addTo(map);

    markerRef.current = marker;
    circleRef.current = circle;
    mapRef.current = map;

    // Click anywhere on map to move pin
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setTargetCoords({ lat, lng });
      const addr = await getAddressFromCoords(lat, lng);
      setResolvedAddress(addr);
    });

    // Drag marker to adjust spot
    marker.on('dragend', async () => {
      const pos = marker.getLatLng();
      setTargetCoords({ lat: pos.lat, lng: pos.lng });
      const addr = await getAddressFromCoords(pos.lat, pos.lng);
      setResolvedAddress(addr);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync Map view when targetCoords or radius changes
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;
    const lat = targetCoords.lat;
    const lng = targetCoords.lng;

    markerRef.current.setLatLng([lat, lng]);
    circleRef.current.setLatLng([lat, lng]);
    circleRef.current.setRadius(radius);
    mapRef.current.panTo([lat, lng]);
  }, [targetCoords, radius]);

  // Smart Multi-Source Search (Nominatim + Photon API + Query Fallbacks)
  const handleSearchAddress = async () => {
    if (!addressInput.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    const cleanInput = addressInput.trim();
    const resultsList: GeocodeResult[] = [];

    // Stage 1: Nominatim Exact Search
    try {
      const query = encodeURIComponent(cleanInput);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5&addressdetails=1`);
      if (res.ok) {
        const data: GeocodeResult[] = await res.json();
        if (data && data.length > 0) {
          resultsList.push(...data);
        }
      }
    } catch (e) {}

    // Stage 2: Photon Komoot Fuzzy Search API
    try {
      const resP = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(cleanInput)}&limit=5`);
      if (resP.ok) {
        const dataP = await resP.json();
        if (dataP && dataP.features) {
          for (const feat of dataP.features) {
            const props = feat.properties;
            const nameStr = [props.name, props.street, props.district, props.city || props.county, props.state].filter(Boolean).join(', ');
            if (feat.geometry && feat.geometry.coordinates) {
              const [lon, lat] = feat.geometry.coordinates;
              // Avoid duplicates
              if (!resultsList.some(r => Math.abs(parseFloat(r.lat) - lat) < 0.001 && Math.abs(parseFloat(r.lon) - lon) < 0.001)) {
                resultsList.push({
                  place_id: `photon_${props.osm_id || Math.random()}`,
                  display_name: nameStr || cleanInput,
                  lat: String(lat),
                  lon: String(lon),
                });
              }
            }
          }
        }
      }
    } catch (e) {}

    // Stage 3: Query Relaxation Fallback if 0 results (e.g., search "Chandapura Bangalore" if full college phrase fails)
    if (resultsList.length === 0 && cleanInput.includes(',')) {
      const parts = cleanInput.split(',').map(s => s.trim()).filter(Boolean);
      // Take last 2 terms e.g. "Chandapura, Suryanagar" or "Chandapura, Bangalore"
      const relaxedQuery = parts.slice(-2).join(' ');
      try {
        const resR = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(relaxedQuery)}&limit=3`);
        if (resR.ok) {
          const dataR: GeocodeResult[] = await resR.json();
          if (dataR && dataR.length > 0) {
            resultsList.push(...dataR);
          }
        }
      } catch (e) {}
    }

    if (resultsList.length > 0) {
      setSearchResults(resultsList);
      const first = resultsList[0];
      const lat = parseFloat(first.lat);
      const lng = parseFloat(first.lon);
      setTargetCoords({ lat, lng });
      setResolvedAddress(first.display_name);
    } else {
      alert(`Could not automatically match "${cleanInput}". You can search your city/area name (e.g. "Chandapura Bangalore"), and then click directly on the interactive map below to place your pin on your college building!`);
    }

    setIsSearching(false);
  };

  const handleSelectResult = (result: GeocodeResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setTargetCoords({ lat, lng });
    setResolvedAddress(result.display_name);
    if (!name.trim()) {
      const firstPart = result.display_name.split(',')[0];
      setName(firstPart);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (currentLat && currentLng) {
      setTargetCoords({ lat: currentLat, lng: currentLng });
      const addr = await getAddressFromCoords(currentLat, currentLng);
      setResolvedAddress(addr);
      setSearchResults([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a zone label (e.g. Narayana PU College, Home, Gym)');
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
          maxWidth: '520px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={24} style={{ color: 'var(--color-safe)' }} />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>Circle Safe Zones</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Set safe zones anywhere by search or map click</p>
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
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Zone Name Input */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              1. Zone Label
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Narayana PU College, Home, Gym"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '2px solid var(--border-dark)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-main)',
                fontWeight: 800,
                fontSize: '13px',
                marginTop: '4px',
              }}
            />
          </div>

          {/* Location Search Input */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              2. Search College / Place / Landmark
            </label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="Search college, campus, Chandapura, Suryanagar..."
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
                  padding: '8px 10px',
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
                  padding: '6px 12px',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <Search size={14} /> {isSearching ? '...' : 'Search'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              style={{
                marginTop: '4px',
                backgroundColor: 'transparent',
                color: 'var(--accent-primary)',
                border: 'none',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Navigation size={11} /> Use My Current GPS Location
            </button>
          </div>

          {/* Search Result Matches List */}
          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', border: '2px solid var(--border-dark)', padding: '6px', backgroundColor: 'var(--bg-subtle)', maxHeight: '130px', overflowY: 'auto' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Matching locations:</span>
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

          {/* Interactive Leaflet Pin Picker Map */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>3. Interactive Map (Tap anywhere to set exact pin)</span>
            </label>
            <div
              ref={mapContainerRef}
              style={{
                width: '100%',
                height: '180px',
                border: '2px solid var(--border-dark)',
                marginTop: '4px',
                position: 'relative',
              }}
            />
            <div style={{ padding: '6px 8px', backgroundColor: 'var(--bg-card)', border: '2px solid var(--border-dark)', borderTop: 'none', fontSize: '10px', fontWeight: 700 }}>
              <span style={{ color: 'var(--text-main)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📍 {resolvedAddress}</span>
            </div>
          </div>

          {/* Radius Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                4. Perimeter Radius
              </label>
              <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--accent-primary)' }}>{radius} Meters</span>
            </div>
            <input
              type="range"
              min="50"
              max="2000"
              step="50"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{ width: '100%', marginTop: '4px', accentColor: 'var(--accent-primary)' }}
            />
          </div>

          {/* Save Button */}
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
              fontSize: '13px',
              marginTop: '4px',
            }}
          >
            <Plus size={16} /> {isSubmitting ? 'Saving Zone...' : 'Save Circle Safe Zone'}
          </button>
        </form>

        {/* List of Active Safe Zones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active Circle Zones ({safeZones?.length || 0})
          </span>
          {(safeZones || []).length === 0 ? (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, fontStyle: 'italic' }}>No safe zones created yet.</p>
          ) : (
            (safeZones || []).map((zone) => (
              <div
                key={zone._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '2px solid var(--border-dark)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  <MapPin size={16} style={{ color: 'var(--color-safe)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{zone.name}</p>
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
                    marginLeft: '6px',
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
