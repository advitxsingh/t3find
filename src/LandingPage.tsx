import { useState, useEffect } from 'react';
import './landing.css';

const features = [
  {
    icon: '📍',
    title: 'Live Location Mesh',
    desc: 'Real-time GPS tracking of every circle member on a shared interactive map. Sub-meter accuracy, always on.',
  },
  {
    icon: '🔋',
    title: 'Battery & Device Intel',
    desc: 'See exact battery %, charging state, and network signal for every family member at a glance.',
  },
  {
    icon: '🔕',
    title: 'Ringer Mode Detection',
    desc: 'Know instantly if a family member is on Silent, Vibrate, or Normal — without calling them.',
  },
  {
    icon: '🚨',
    title: 'One-Tap SOS Alert',
    desc: 'Send an emergency distress signal to your entire circle in one tap. Triggers siren on all devices.',
  },
  {
    icon: '📡',
    title: 'Remote Circle Sync',
    desc: 'Instantly request fresh telemetry from all family devices with a single sync push.',
  },
  {
    icon: '🛡️',
    title: 'Safe Zone Geofencing',
    desc: 'Define safe zones by address or map pin. Get alerts when someone enters or leaves a zone.',
  },
  {
    icon: '💥',
    title: 'Crash Detection',
    desc: 'Accelerometer-based impact detection. Auto-alerts your circle if a sudden crash event is detected.',
  },
  {
    icon: '📦',
    title: 'OTA Updates',
    desc: 'App updates push live to your phone the moment they ship — no app store, no APK downloads.',
  },
];

const stats = [
  { value: '<1s', label: 'Sync Latency' },
  { value: '24/7', label: 'Cloud Uptime' },
  { value: '100m', label: 'GPS Accuracy' },
  { value: '∞', label: 'Family Size' },
];

export default function LandingPage() {
  const [tick, setTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Unlock body scroll for landing page (global CSS locks it for the app)
    document.body.classList.add('landing-active');
    return () => document.body.classList.remove('landing-active');
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const blinkDots = '.'.repeat((tick % 3) + 1).padEnd(3, '\u00A0');

  return (
    <div className="land-root">
      {/* ── NAV ── */}
      <nav className="land-nav">
        <a href="/" className="land-logo">
          <span className="land-logo-icon">⬡</span>
          T3Find
        </a>
        <div className={`land-nav-links ${menuOpen ? 'open' : ''}`}>
          <a href="#features">Features</a>
          <a href="#how">How It Works</a>
          <a href="#stats">By the Numbers</a>
          <a href="/app" className="land-nav-cta">Open App →</a>
        </div>
        <button className="land-hamburger" onClick={() => setMenuOpen(o => !o)}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* ── HERO ── */}
      <section className="land-hero">
        <div className="land-hero-badge">
          <span className="land-pulse-dot" /> LIVE &nbsp;{blinkDots}&nbsp; Family Safety Platform
        </div>
        <h1 className="land-hero-title">
          Your Family.<br />
          Always <span className="land-hero-highlight">Visible.</span><br />
          Always Safe.
        </h1>
        <p className="land-hero-sub">
          T3Find is a real-time family safety mesh. Track location, battery, ringer mode, and emergencies — 
          all in one brutalist, no-nonsense dashboard built for people who actually care about each other.
        </p>
        <div className="land-hero-actions">
          <a href="/app" className="land-btn-primary">
            Launch App <span>→</span>
          </a>
          <a href="#features" className="land-btn-secondary">
            See Features
          </a>
        </div>

        {/* Live Telemetry Preview Card */}
        <div className="land-preview-card">
          <div className="land-preview-header">
            <div className="land-preview-dot green" />
            <span>Live Circle — 3 members active</span>
            <span className="land-preview-time">Synced {blinkDots}</span>
          </div>
          <div className="land-preview-members">
            {[
              { name: 'Dad', emoji: '👨', bat: 82, loc: 'Sector 18, Noida', ringer: 'Normal', charging: false },
              { name: 'Mom', emoji: '👩', bat: 41, loc: 'Connaught Place, Delhi', ringer: 'Silent', charging: true },
              { name: 'You', emoji: '🧑', bat: 67, loc: 'Green Park, Delhi', ringer: 'Vibrate', charging: false },
            ].map((m) => (
              <div className="land-preview-member" key={m.name}>
                <div className="land-preview-avatar">{m.emoji}</div>
                <div className="land-preview-info">
                  <strong>{m.name}</strong>
                  <span className="land-preview-loc">📍 {m.loc}</span>
                </div>
                <div className="land-preview-stats">
                  <span className={`land-bat ${m.bat < 20 ? 'low' : ''}`}>
                    {m.charging ? '⚡' : '🔋'} {m.bat}%
                  </span>
                  <span className={`land-ringer land-ringer-${m.ringer.toLowerCase()}`}>
                    {m.ringer === 'Silent' ? '🔇' : m.ringer === 'Vibrate' ? '📳' : '🔊'} {m.ringer}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="land-stats" id="stats">
        {stats.map(s => (
          <div className="land-stat" key={s.label}>
            <span className="land-stat-value">{s.value}</span>
            <span className="land-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── FEATURES ── */}
      <section className="land-features" id="features">
        <div className="land-section-header">
          <span className="land-section-tag">CAPABILITIES</span>
          <h2>Everything your circle needs</h2>
          <p>No fluff. No subscriptions. Just raw, reliable family telemetry.</p>
        </div>
        <div className="land-features-grid">
          {features.map((f) => (
            <div className="land-feature-card" key={f.title}>
              <span className="land-feature-icon">{f.icon}</span>
              <div className="land-feature-card-text">
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="land-how" id="how">
        <div className="land-section-header">
          <span className="land-section-tag">HOW IT WORKS</span>
          <h2>Up and running in 60 seconds</h2>
        </div>
        <div className="land-steps">
          {[
            { n: '01', title: 'Create your account', desc: 'Sign up with email. Your identity is secured with Convex Auth — no passwords stored.' },
            { n: '02', title: 'Create or join a circle', desc: 'Generate a 6-character invite code. Share with family. Everyone joins in one tap.' },
            { n: '03', title: 'Grant permissions', desc: 'Allow location & notifications. T3Find reads your GPS, battery, and ringer from native Android hardware.' },
            { n: '04', title: "You're live", desc: 'Your family circle is now live. Everyone sees everyone — real-time, always.' },
          ].map(s => (
            <div className="land-step" key={s.n}>
              <div className="land-step-num">{s.n}</div>
              <div className="land-step-body">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="land-cta">
        <h2>Your family is one tap away.</h2>
        <p>No app store. No install. Open T3Find in your browser or install the Android APK.</p>
        <div className="land-hero-actions">
          <a href="/app" className="land-btn-primary">Open T3Find →</a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="land-footer">
        <div className="land-footer-left">
          <span className="land-logo">⬡ T3Find</span>
          <span className="land-footer-sub">Real-time family safety mesh</span>
        </div>
        <div className="land-footer-right">
          <span>Built on Convex · Hosted on Vercel · v0.0.1</span>
        </div>
      </footer>
    </div>
  );
}
