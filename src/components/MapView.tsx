import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { UserLocation } from '../types';

interface MapViewProps {
  currentUser: UserLocation;
  allUsers: UserLocation[];
  selectedUser: UserLocation | null;
  onSelectUser: (user: UserLocation) => void;
}

export function MapView({
  currentUser,
  allUsers,
  selectedUser,
  onSelectUser
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const circleRef = useRef<L.Circle | null>(null);
  const lastSelectedUserIdRef = useRef<string | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentUser.lat, currentUser.lng],
      zoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers and Center when users telemetry changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const targetUser = selectedUser || currentUser;

    // Render accuracy circle for target user
    if (circleRef.current) {
      circleRef.current.remove();
    }
    circleRef.current = L.circle([targetUser.lat, targetUser.lng], {
      radius: targetUser.accuracy * 1.5,
      color: targetUser.isEmergency ? '#ef4444' : '#0f172a',
      fillColor: targetUser.isEmergency ? '#ef4444' : '#0f172a',
      fillOpacity: 0.15,
      weight: 2,
    }).addTo(map);

    // Update individual boxy avatar markers
    allUsers.forEach((user) => {
      const isSelf = user.userId === currentUser.userId;
      const isSelected = targetUser.userId === user.userId;

      const displayName = encodeURIComponent(user.name.split(' ')[0]);
      const avatarSrc = `https://ui-avatars.com/api/?name=${displayName}&background=${isSelected ? '0f172a' : isSelf ? '475569' : '10b981'}&color=ffffff&bold=true&size=128`;

      const customIcon = L.divIcon({
        className: 'custom-avatar-marker',
        html: `
          <div style="
            position: relative;
            width: ${isSelected ? '56px' : '48px'};
            height: ${isSelected ? '56px' : '48px'};
            border: 2.5px solid ${user.isEmergency ? '#ef4444' : isSelected ? '#0f172a' : isSelf ? '#475569' : '#10b981'};
            background: #ffffff;
            box-shadow: 3px 3px 0px #0f172a;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: ${isSelected ? 999 : 100};
          ">
            <img 
              src="${user.avatar ? user.avatar.replace(/"/g, '&quot;') : avatarSrc}" 
              alt="${user.name}"
              onerror="this.onerror=null;this.src='${avatarSrc}';"
              style="
                width: 100%; 
                height: 100%; 
                object-fit: cover;
                display: block;
              " 
            />
            
            <!-- Boxy Name Tag Badge below Avatar -->
            <div style="
              position: absolute;
              bottom: -22px;
              left: 50%;
              transform: translateX(-50%);
              background: #0f172a;
              color: #ffffff;
              font-size: 11px;
              font-weight: 700;
              padding: 2px 8px;
              white-space: nowrap;
              border: 1px solid #0f172a;
              box-shadow: 2px 2px 0px rgba(0,0,0,0.2);
              pointer-events: none;
            ">
              ${user.name.split(' ')[0]}
            </div>

            ${
              user.isEmergency
                ? `<span style="
                    position: absolute;
                    top: -6px;
                    right: -6px;
                    background: #ef4444;
                    color: white;
                    font-size: 10px;
                    font-weight: 800;
                    padding: 2px 5px;
                  ">SOS</span>`
                : ''
            }
          </div>
        `,
        iconSize: [isSelected ? 56 : 48, isSelected ? 56 : 48],
        iconAnchor: [isSelected ? 28 : 24, isSelected ? 28 : 24],
      });

      let marker = markersRef.current.get(user.userId);
      if (!marker) {
        marker = L.marker([user.lat, user.lng], { icon: customIcon }).addTo(map);
        marker.on('click', () => onSelectUser(user));
        markersRef.current.set(user.userId, marker);
      } else {
        marker.setLatLng([user.lat, user.lng]);
        marker.setIcon(customIcon);
      }
    });

    // Auto-fit bounds only when target selection changes or on initial render
    const targetUserId = targetUser.userId;
    if (targetUserId !== lastSelectedUserIdRef.current) {
      lastSelectedUserIdRef.current = targetUserId;
      if (allUsers.length > 0) {
        const bounds = L.latLngBounds(allUsers.map((u) => [u.lat, u.lng]));
        map.fitBounds(bounds, { padding: [70, 70], maxZoom: 15, animate: true });
      }
    }
  }, [allUsers, currentUser, selectedUser]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: '400px', height: '100%' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
