import React, { useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { Lock, Mail, User, AlertCircle, ArrowRight } from 'lucide-react';

export function AuthForm() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (step === 'signUp') {
        await signIn('password', { email, password, name, flow: 'signUp' });
      } else {
        await signIn('password', { email, password, flow: 'signIn' });
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: 'var(--bg-main)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--bg-surface)',
        border: '2px solid var(--border-dark)',
        padding: '40px',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px'
      }}>
        {/* Studio Branding Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px' }}>
          <img
            src="/img.jpg"
            alt="T3Find Logo"
            style={{
              width: '64px',
              height: '64px',
              border: '2px solid var(--border-dark)',
              boxShadow: 'var(--shadow-sm)',
              objectFit: 'cover'
            }}
          />
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.8px' }}>
            T3Find
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            {step === 'signIn' ? 'Sign in to access your family live telemetry network' : 'Create an account to join your family safety mesh'}
          </p>
        </div>

        {/* Error Notice */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid var(--color-emergency)',
            color: 'var(--color-emergency)',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {step === 'signUp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Full Name</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={18} style={{ position: 'absolute', left: '16px', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  required
                  placeholder="Advit Singh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 44px',
                    border: '2px solid var(--border-dark)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email Address</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={18} style={{ position: 'absolute', left: '16px', color: 'var(--text-dim)' }} />
              <input
                type="email"
                required
                placeholder="advit@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 44px',
                  border: '2px solid var(--border-dark)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={18} style={{ position: 'absolute', left: '16px', color: 'var(--text-dim)' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 44px',
                  border: '2px solid var(--border-dark)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '8px',
              width: '100%',
              padding: '16px',
              border: '2px solid var(--border-dark)',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 800,
              cursor: submitting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: 'var(--shadow-md)',
              transition: 'all 0.15s ease'
            }}
          >
            {submitting ? 'Authenticating...' : step === 'signIn' ? 'Sign In' : 'Create Account'}
            {!submitting && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Account Mode Toggle */}
        <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)' }}>
          {step === 'signIn' ? "Don't have an account?" : 'Already registered?'}{' '}
          <button
            onClick={() => {
              setStep(step === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-primary)',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {step === 'signIn' ? 'Create one now' : 'Sign in here'}
          </button>
        </div>
      </div>
    </div>
  );
}
