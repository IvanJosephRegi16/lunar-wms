'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import ParticleBackground from '@/components/ParticleBackground';

const EyeTracker = () => {
  const [pupilPosition, setPupilPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      
      const maxOffset = 12; 
      const xOffset = ((x - 50) / 50) * maxOffset;
      const yOffset = ((y - 50) / 50) * maxOffset;

      setPupilPosition({ x: xOffset, y: yOffset });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="avatar-eye-unit" style={{ marginBottom: '24px' }}>
      <div className="eye-socket">
        <div 
          className="pupil" 
          style={{ transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)` }}
        />
      </div>
      <div className="eye-socket">
        <div 
          className="pupil" 
          style={{ transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)` }}
        />
      </div>
    </div>
  );
};

export default function LoginPage() {
  const [view, setView] = useState<'login' | 'forgot_phone' | 'forgot_otp' | 'forgot_reset'>('login');
  const searchParams = useSearchParams();
  
  // Login states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Recovery states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);

  useEffect(() => {
    setOtp(otpDigits.join(''));
  }, [otpDigits]);

  const handleOtpChange = (index: number, value: string) => {
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devOtp, setDevOtp] = useState('');

  // General form status states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'expired') {
      setError('Your session has expired. Please log in again.');
    } else if (reason === 'logged_out_elsewhere') {
      setError('You were logged out from another tab.');
    }
  }, [searchParams]);

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
          setOtpDigits(['', '', '', '', '', '']);
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
    <div className="login-vortex" style={{ position: 'relative', overflow: 'hidden' }}>
      <ParticleBackground />
      
      <div className="login-card-6d" style={{ transition: 'all 0.3s ease-in-out', position: 'relative', zIndex: 10 }}>
        
        {/* ── VIEW: SIGN IN ────────────────────────────────────────────────── */}
        {view === 'login' && (
          <>
            <div className="silk-header">
               <img src="/lunars-logo.png" alt="Lunar's" style={{ height: '48px', marginBottom: '16px' }} />
               <EyeTracker />
               <h1>LUNAR'S System Access</h1>
               <p style={{ color: 'rgba(148, 163, 184, 0.9)', fontWeight: 600 }}>Secure Stock Management Portal</p>
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 1 }}>
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
                    style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', outline: 'none', padding: 0 }}
                  >
                    Forgot Access Protocol?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Password..." 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    required 
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(148, 163, 184, 0.8)', cursor: 'pointer', padding: 0 }}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-sentinel" 
                disabled={loading}
                style={{ backgroundColor: loading ? 'rgba(100, 116, 139, 0.6)' : undefined }}
              >
                {loading ? 'VERIFYING...' : 'SIGN IN NOW'}
              </button>
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'rgba(148, 163, 184, 0.7)', fontWeight: 600, position: 'relative', zIndex: 1 }}>
              New user? <a href="/signup" style={{ color: '#a78bfa', textDecoration: 'none', fontWeight: 800 }}>Apply for Access</a>
            </div>
          </>
        )}

        {/* ── VIEW: FORGOT PASSWORD - ENTER PHONE ──────────────────────────── */}
        {view === 'forgot_phone' && (
          <>
            <div className="silk-header">
               <img src="/lunars-logo.png" alt="Lunar's" style={{ height: '48px', marginBottom: '16px' }} />
               <EyeTracker />
               <h1>LUNAR'S Recover Access</h1>
               <p style={{ color: 'rgba(148, 163, 184, 0.9)', fontWeight: 600 }}>Enter your linked phone number</p>
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 1 }}>
                 ⚠️ {error}
              </div>
            )}
            {success && (
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#6ee7b7', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 1 }}>
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
                style={{ backgroundColor: loading ? 'rgba(100, 116, 139, 0.6)' : undefined }}
              >
                {loading ? 'TRANSMITTING...' : 'SEND OTP CODE'}
              </button>

              <button 
                type="button"
                onClick={() => { setView('login'); setError(''); setSuccess(''); }}
                style={{ background: 'none', border: 'none', color: 'rgba(148, 163, 184, 0.6)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', marginTop: '8px', position: 'relative', zIndex: 1 }}
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
               <img src="/lunars-logo.png" alt="Lunar's" style={{ height: '48px', marginBottom: '16px' }} />
               <EyeTracker />
               <h1>LUNAR'S Verification</h1>
               <p style={{ color: 'rgba(148, 163, 184, 0.9)', fontWeight: 600 }}>Enter the 6-digit verification code</p>
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 1 }}>
                 ⚠️ {error}
              </div>
            )}
            {success && (
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#6ee7b7', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 1 }}>
                 ✅ {success}
              </div>
            )}


            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
              <div className="silk-field">
                <label>6-DIGIT OTP CODE</label>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '4px' }}>
                  {otpDigits.map((digit, index) => (
                    <input 
                      key={index}
                      id={`otp-input-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      autoFocus={index === 0}
                      onChange={(e) => handleOtpChange(index, e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      style={{
                        width: '100%',
                        height: '56px',
                        fontSize: '24px',
                        textAlign: 'center' as const,
                        borderRadius: '14px',
                        border: '2px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        color: '#f1f5f9',
                        fontWeight: '800',
                        outline: 'none',
                        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        position: 'relative' as const,
                        zIndex: 1
                      }}
                      onFocus={(e) => { e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)'; e.target.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.12)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.boxShadow = 'none'; }}
                    />
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-sentinel" 
                disabled={loading}
                style={{ backgroundColor: loading ? 'rgba(100, 116, 139, 0.6)' : undefined }}
              >
                {loading ? 'VERIFYING...' : 'VERIFY CODE'}
              </button>

              <button 
                type="button"
                onClick={() => { setView('forgot_phone'); setError(''); setSuccess(''); }}
                style={{ background: 'none', border: 'none', color: 'rgba(148, 163, 184, 0.6)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', marginTop: '8px', position: 'relative', zIndex: 1 }}
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
               <img src="/lunars-logo.png" alt="Lunar's" style={{ height: '48px', marginBottom: '16px' }} />
               <EyeTracker />
               <h1>LUNAR'S Reset Protocol</h1>
               <p style={{ color: 'rgba(148, 163, 184, 0.9)', fontWeight: 600 }}>Establish your new access credentials</p>
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 1 }}>
                 ⚠️ {error}
              </div>
            )}
            {success && (
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#6ee7b7', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 1 }}>
                 ✅ {success}
              </div>
            )}

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
              <div className="silk-field">
                <label>NEW ACCESS PROTOCOL</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Enter new password..." 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                    required 
                    autoFocus
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(148, 163, 184, 0.8)', cursor: 'pointer', padding: 0 }}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className="silk-field">
                <label>CONFIRM PROTOCOL</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Confirm new password..." 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)}
                    required 
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(148, 163, 184, 0.8)', cursor: 'pointer', padding: 0 }}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-sentinel" 
                disabled={loading}
                style={{ backgroundColor: loading ? 'rgba(100, 116, 139, 0.6)' : undefined }}
              >
                {loading ? 'RESETTING...' : 'RESET ACCESS KEY'}
              </button>
            </form>
          </>
        )}

        <div style={{ marginTop: '32px', color: 'rgba(148, 163, 184, 0.4)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', position: 'relative', zIndex: 1 }}>
           🛡️ Protected by Enterprise Encryption
        </div>
      </div>
    </div>
  );
}
