import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { App } from './App.tsx';
import LandingPage from './LandingPage.tsx';
import './index.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL || 'https://veracious-sheep-105.convex.cloud';
const convex = new ConvexReactClient(convexUrl);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Landing homepage */}
        <Route path="/" element={<LandingPage />} />

        {/* Full App (wrapped in Convex Auth) */}
        <Route
          path="/app"
          element={
            <ConvexAuthProvider client={convex}>
              <App />
            </ConvexAuthProvider>
          }
        />

        {/* Catch-all: redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
