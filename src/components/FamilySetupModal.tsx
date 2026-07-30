import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { KeyRound, Plus, ArrowRight } from 'lucide-react';

interface FamilySetupModalProps {
  onClose: () => void;
}

export function FamilySetupModal({ onClose }: FamilySetupModalProps) {
  const createFamily = useMutation(api.telemetry.createFamily);
  const joinFamilyWithCode = useMutation(api.telemetry.joinFamilyWithCode);

  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createFamily({ familyName: familyName.trim() });
      setCreatedCode(res.inviteCode);
    } catch (err: any) {
      setError(err.message || 'Failed to create family group.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await joinFamilyWithCode({ inviteCode: inviteCode.trim() });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to join family circle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--bg-surface)',
        border: '2px solid var(--border-dark)',
        padding: '32px',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>
            {mode === 'choose' && 'Family Mesh Options'}
            {mode === 'create' && 'Create Family Circle'}
            {mode === 'join' && 'Enter Invite Code'}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', fontWeight: 800, color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid var(--color-emergency)',
            color: 'var(--color-emergency)',
            padding: '10px 14px',
            fontSize: '13px',
            fontWeight: 700
          }}>
            {error}
          </div>
        )}

        {/* Initial Choice Screen */}
        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => setMode('join')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px',
                border: '2px solid var(--accent-primary)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <KeyRound size={24} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 800 }}>Join an Existing Family</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enter a 6-character code (e.g. T3-X89A) shared by a family member</p>
              </div>
            </button>

            <button
              onClick={() => setMode('create')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px',
                border: '2px solid var(--border-dark)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Plus size={24} style={{ color: 'var(--text-muted)' }} />
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 800 }}>Create New Family Circle</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Start a new private circle and generate your family's invite code</p>
              </div>
            </button>
          </div>
        )}

        {/* Create Family Flow */}
        {mode === 'create' && (
          <div>
            {!createdCode ? (
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>Family Circle Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. The Singh Family"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    style={{
                      padding: '12px 14px',
                      border: '2px solid var(--border-dark)',
                      backgroundColor: 'var(--bg-subtle)',
                      fontSize: '14px',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '14px',
                    border: '2px solid var(--border-dark)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: loading ? 'wait' : 'pointer',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {loading ? 'Creating...' : 'Generate Invite Code'}
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
                <div style={{
                  padding: '20px',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '2px dashed var(--accent-primary)'
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800 }}>YOUR FAMILY INVITE CODE</span>
                  <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '2px', marginTop: '4px' }}>
                    {createdCode}
                  </h2>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Share this code with family members so they can enter it on their devices to join your live map!
                </p>
                <button
                  onClick={onClose}
                  style={{
                    padding: '14px',
                    border: '2px solid var(--border-dark)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        {/* Join Family Code Input Flow */}
        {mode === 'join' && (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>Enter 6-Character Invite Code</label>
              <input
                type="text"
                required
                placeholder="e.g. T3-X89A"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                style={{
                  padding: '14px',
                  border: '2px solid var(--accent-primary)',
                  backgroundColor: 'var(--bg-subtle)',
                  fontSize: '18px',
                  fontWeight: 900,
                  letterSpacing: '1px',
                  textAlign: 'center',
                  outline: 'none',
                  textTransform: 'uppercase'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px',
                border: '2px solid var(--border-dark)',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                fontWeight: 800,
                cursor: loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {loading ? 'Joining Circle...' : 'Join Family Circle'} <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
