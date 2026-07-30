export interface UserLocation {
  userId: string;
  name: string;
  avatar: string;
  lat: number;
  lng: number;
  locationName?: string;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  batteryLevel: number | null;
  isCharging: boolean;
  ringerMode: 'Normal' | 'Silent' | 'Vibrate';
  networkStatus: string;
  isEmergency: boolean;
  lastUpdated: number;
  guardiansCount: number;
}

export interface GuardianContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  avatar: string;
  isNotified: boolean;
}
