'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [view, setView] = useState<'login' | 'forgot_phone' | 'forgot_otp' | 'forgot_reset'>('login');
  
  // Login states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Recovery states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devOtp, setDevOtp] = useState('');

  // General form status states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        // Force a hard reload to ensure cookies are read correctly
        window.location.href = '/';
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Identity Verification Failed');
      }
    } catch (err: any) {
      setError(`Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (res.ok) {
        const data = await res.json();
        setDevOtp(data.dev_otp || '');
        setSuccess('OTP verification code has been transmitted.');
        setTimeout(() => {
          setView('forgot_otp');
          setSuccess('');
        }, 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to initialize password recovery.');
      }
    } catch (err: any) {
      setError(`Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });

      if (res.ok) {
        setSuccess('OTP verification check complete!');
        setTimeout(() => {
          setView('forgot_reset');
          setSuccess('');
        }, 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      setError(`Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, newPassword }),
      });

      if (res.ok) {
        setSuccess('New Access Protocol established successfully!');
        setTimeout(() => {
          setView('login');
          setPhone('');
          setOtp('');
          setNewPassword('');
          setConfirmPassword('');
          setDevOtp('');
          setSuccess('');
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to update credentials.');
      }
    } catch (err: any) {
      setError(`Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-vortex">
      <div className="login-card-6d" style={{ transition: 'all 0.3s ease-in-out' }}>
        
        {/* ── VIEW: SIGN IN ────────────────────────────────────────────────── */}
        {view === 'login' && (
          <>
            <div className="silk-header">
               <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
               <h1>System Access</h1>
               <p style={{ color: '#64748b', fontWeight: 600 }}>Secure Stock Management Portal</p>
            </div>

            {error && (
              <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', fontWeight: 700 }}>
                 ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
              <div className="silk-field">
                <label>OPERATOR IDENTITY</label>
                <input 
                  type="text" 
                  placeholder="Username..." 
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  required 
                  autoFocus
                />
              </div>
              
              <div className="silk-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>ACCESS PROTOCOL</label>
                  <button 
                    type="button" 
                    onClick={() => { setView('forgot_phone'); setError(''); setSuccess(''); }}
                    style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', outline: 'none', padding: 0 }}
                  >
                    Forgot Access Protocol?
                  </button>
                </div>
                <input 
                  type="password" 
                  placeholder="Password..." 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  required 
                />
              </div>

              <button 
                type="submit" 
                className="btn-sentinel" 
                disabled={loading}
                style={{ backgroundColor: loading ? '#64748b' : '#0f172a' }}
              >
                {loading ? 'VERIFYING...' : 'SIGN IN NOW'}
              </button>
            </form>
          </>
        )}

        {/* ── VIEW: FORGOT PASSWORD - ENTER PHONE ──────────────────────────── */}
        {view === 'forgot_phone' && (
          <>
            <div className="silk-header">
               <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔑</div>
               <h1>Recover Access</h1>
               <p style={{ color: '#64748b', fontWeight: 600 }}>Enter your linked phone number</p>
            </div>

            {error && (
              <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', fontWeight: 700 }}>
                 ⚠️ {error}
              </div>
            )}
            {success && (
              <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', fontWeight: 700 }}>
                 ✅ {success}
              </div>
            )}

            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
              <div className="silk-field">
                <label>LINKED PHONE NUMBER</label>
                <input 
                  type="tel" 
                  placeholder="e.g. +919876543210" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)}
                  required 
                  autoFocus
                />
              </div>

              <button 
                type="submit" 
                className="btn-sentinel" 
                disabled={loading}
                style={{ backgroundColor: loading ? '#64748b' : '#0f172a' }}
              >
                {loading ? 'TRANSMITTING...' : 'SEND OTP CODE'}
              </button>

              <button 
                type="button"
                onClick={() => { setView('login'); setError(''); setSuccess(''); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', marginTop: '8px' }}
              >
                ← Back to Sign In
              </button>
            </form>
          </>
        )}

        {/* ── VIEW: FORGOT PASSWORD - ENTER OTP ───────────────────────────── */}
        {view === 'forgot_otp' && (
          <>
            <div className="silk-header">
               <div style={{ fontSize: '40px', marginBottom: '16px' }}>💬</div>
               <h1>Verification</h1>
               <p style={{ color: '#64748b', fontWeight: 600 }}>Enter the 6-digit verification code</p>
            </div>

            {error && (
              <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', fontWeight: 700 }}>
                 ⚠️ {error}
              </div>
            )}
            {success && (
              <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', fontWeight: 700 }}>
                 ✅ {success}
              </div>
            )}

            {/* Development Mock OTP Helper Banner */}
            {devOtp && (
              <div style={{ backgroundColor: '#eff6ff', border: '1.5px dashed #3b82f6', color: '#1e40af', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '12px', textAlign: 'center', lineHeight: '1.5' }}>
                <strong>[DEV HELPER MOCK NOTIFICATION]</strong><br />
                Simulated SMS sent code: <strong style={{ fontSize: '16px', color: '#2563eb' }}>{devOtp}</strong><br />
                <span style={{ fontSize: '10px', color: '#60a5fa' }}>(Logged to terminal and data/sent_otps.txt)</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
              <div className="silk-field">
                <label>6-DIGIT OTP CODE</label>
                <input 
                  type="text" 
                  placeholder="Enter code..." 
                  maxLength={6}
                  value={otp} 
                  onChange={e => setOtp(e.target.value)}
                  required 
                  autoFocus
                />
              </div>

              <button 
                type="submit" 
                className="btn-sentinel" 
                disabled={loading}
                style={{ backgroundColor: loading ? '#64748b' : '#0f172a' }}
              >
                {loading ? 'VERIFYING...' : 'VERIFY CODE'}
              </button>

              <button 
                type="button"
                onClick={() => { setView('forgot_phone'); setError(''); setSuccess(''); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', marginTop: '8px' }}
              >
                ← Back to Resend
              </button>
            </form>
          </>
        )}

        {/* ── VIEW: FORGOT PASSWORD - RESET PASSWORD ──────────────────────── */}
        {view === 'forgot_reset' && (
          <>
            <div className="silk-header">
               <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔐</div>
               <h1>Reset Protocol</h1>
               <p style={{ color: '#64748b', fontWeight: 600 }}>Establish your new access credentials</p>
            </div>

            {error && (
              <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', fontWeight: 700 }}>
                 ⚠️ {error}
              </div>
            )}
            {success && (
              <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', fontWeight: 700 }}>
                 ✅ {success}
              </div>
            )}

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
              <div className="silk-field">
                <label>NEW ACCESS PROTOCOL</label>
                <input 
                  type="password" 
                  placeholder="Enter new password..." 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)}
                  required 
                  autoFocus
                />
              </div>

              <div className="silk-field">
                <label>CONFIRM PROTOCOL</label>
                <input 
                  type="password" 
                  placeholder="Confirm new password..." 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)}
                  required 
                />
              </div>

              <button 
                type="submit" 
                className="btn-sentinel" 
                disabled={loading}
                style={{ backgroundColor: loading ? '#64748b' : '#0f172a' }}
              >
                {loading ? 'RESETTING...' : 'RESET ACCESS KEY'}
              </button>
            </form>
          </>
        )}

        <div style={{ marginTop: '32px', color: '#94a3b8', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
           Protected by Enterprise Encryption
        </div>
      </div>
    </div>
  );
}
