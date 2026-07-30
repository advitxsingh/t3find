# ⬡ T3Find — Open-Source Real-Time Family Safety Mesh

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](https://github.com/advitxsingh/t3find/actions)
[![Version](https://img.shields.io/badge/Version-v0.0.1-slate.svg)](https://t3find.vercel.app)

> **T3Find** is a real-time family safety and device mesh platform. Track family members' location, battery levels, ringer modes, crash sensors, and safe zones in a brutalist, privacy-first dashboard built with React, Convex, and Capacitor Android Native Plugins.

---

## ✨ Features

- 📍 **Real-Time GPS Location Mesh**: Live sub-meter tracking of family circle members rendered on an interactive Leaflet canvas.
- 🔋 **Native Battery & Charging Intel**: Reads 100% accurate device battery % and charging status directly via native Android `BatteryManager`.
- 🔕 **Hardware Ringer State Detection**: Queries Android `AudioManager` to determine if a family member's phone is on Silent, Vibrate, or Normal mode.
- 🚨 **Remote Emergency Beacon & Siren**: One-tap SOS signal that sounds a high-decibel alert on target devices.
- 🛡️ **Interactive Safe Zone Geofencing**: Set circle safe zones with custom perimeter radiuses using interactive Leaflet map pin placement or multi-engine search (Nominatim + Photon API).
- 💥 **Accelerometer Crash Detection**: Detects high-impact G-force events (> 4.5G) and broadcasts distress signals automatically.
- ⚡ **True In-App OTA Updates**: Live web updates push seamlessly over-the-air to installed Android devices without requiring APK reinstallations.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + TypeScript + Vite |
| **Styling & Theme** | Custom Neo-Brutalist CSS Design System |
| **Backend & Realtime DB** | [Convex](https://convex.dev) (Real-Time Reactive Queries, WebSockets, Auth) |
| **Native Mobile Shell** | Capacitor 7 + Native Java Android Plugins |
| **Mapping & Geocoding** | Leaflet + OpenStreetMap + Nominatim & Photon Geocoders |
| **Deployment** | Vercel (Web CDN) + GitHub Actions (Android APK CI) |

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js**: v20 or v22+
- **npm**: v10+
- **Convex Account**: Free tier at [convex.dev](https://convex.dev)

### Step 1: Clone Repository

```bash
git clone https://github.com/advitxsingh/t3find.git
cd t3find
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Convex Backend

Initialize your Convex cloud development environment:

```bash
npx convex dev
```

This creates `.env.local` containing your `VITE_CONVEX_URL`.

### Step 4: Run Development Server

```bash
npm run dev
```

Open your browser at `http://localhost:5173` to see the live app!

---

## 📱 Android Native Build (Capacitor)

To compile the native Android APK package:

```bash
# 1. Build web production bundle
npm run build

# 2. Sync web assets into Android project
npx cap sync android

# 3. Build APK via Gradle
cd android
./gradlew assembleDebug
```

The output APK will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔒 Security & Secrets

- **No Hardcoded Secrets**: All backend environment variables are stored securely in Convex Cloud Dashboard.
- **Authentication**: Powered by `@convex-dev/auth` with secure token handling.
- **Location Privacy**: Telemetry data is scoped strictly to authenticated family circle members using Convex query indexes (`by_family`).

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for full details.
