import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

interface UserLocation {
  userId: string;
  name: string;
  avatar: string;
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  batteryLevel: number | null;
  isCharging: boolean;
  networkStatus: string;
  isEmergency: boolean;
  lastUpdated: number;
  guardiansCount: number;
}

interface GuardianSession {
  sessionId: string;
  hostUserId: string;
  hostName: string;
  isActive: boolean;
  guardians: string[]; // socket IDs or guardian phone/names
  emergencyAlert: boolean;
}

// In-memory state store for live prototype
const users: Map<string, UserLocation> = new Map();
const activeSessions: Map<string, GuardianSession> = new Map();

io.on('connection', (socket: Socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // User registers or updates profile
  socket.on('register-user', (userData: { userId: string; name: string; avatar: string }) => {
    socket.data.userId = userData.userId;
    socket.data.name = userData.name;

    const existing = users.get(userData.userId) || {
      userId: userData.userId,
      name: userData.name,
      avatar: userData.avatar,
      lat: 28.6139, // Default New Delhi coordinates for demo
      lng: 77.2090,
      accuracy: 10,
      speed: 0,
      heading: 0,
      batteryLevel: 85,
      isCharging: false,
      networkStatus: '5G - Strong',
      isEmergency: false,
      lastUpdated: Date.now(),
      guardiansCount: 2
    };

    existing.name = userData.name;
    existing.avatar = userData.avatar;
    users.set(userData.userId, existing);

    socket.join(`user:${userData.userId}`);
    io.emit('all-users-update', Array.from(users.values()));
  });

  // Location & Telemetry Ping from broad-casting phone
  socket.on('update-telemetry', (data: Partial<UserLocation> & { userId: string }) => {
    const user = users.get(data.userId);
    if (user) {
      Object.assign(user, data, { lastUpdated: Date.now() });
      users.set(data.userId, user);

      // Broadcast to all clients watching this user's stream
      io.emit('telemetry-changed', user);
      io.emit('all-users-update', Array.from(users.values()));
    }
  });

  // Trigger Emergency SOS
  socket.on('trigger-sos', (data: { userId: string; isEmergency: boolean }) => {
    const user = users.get(data.userId);
    if (user) {
      user.isEmergency = data.isEmergency;
      user.lastUpdated = Date.now();
      users.set(data.userId, user);

      io.emit('sos-alert', {
        user,
        message: data.isEmergency 
          ? `EMERGENCY ALERT: ${user.name} triggered an SOS button!` 
          : `${user.name} has resolved the emergency.`
      });
      io.emit('all-users-update', Array.from(users.values()));
    }
  });

  // Get initial state
  socket.on('get-initial-state', () => {
    socket.emit('all-users-update', Array.from(users.values()));
  });

  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Guardians Safety Server running on http://localhost:${PORT}`);
});
