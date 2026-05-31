'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

export default function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          password, 
          full_name: fullName, 
          phone 
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || 'Account created successfully. Pending admin approval.');
      } else {
        setError(data.error || 'Signup failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-vortex" style={{ position: 'relative', overflow: 'hidden', padding: '20px' }}>
      <ParticleBackground />

      <div className="login-card-6d glass-signup-card" style={{ position: 'relative', zIndex: 10, maxWidth: '440px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px', position: 'relative', zIndex: 1 }}>
          <img src="/lunars-logo.png" alt="Lunar's" style={{ height: '48px', marginBottom: '16px' }} />
          <EyeTracker />
          <h1 style={{
            margin: '0 0 8px 0',
            fontSize: '30px',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            background: 'linear-gradient(135deg, #ffffff 0%, #a78bfa 50%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>LUNAR'S Create Account</h1>
          <p style={{ margin: 0, color: 'rgba(148, 163, 184, 0.9)', fontSize: '14px', fontWeight: 600 }}>Join the Enterprise Resource Planning system</p>
        </div>
        
        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: '#6ee7b7', fontSize: '18px', marginBottom: '12px', fontWeight: 800 }}>Registration Successful!</h2>
            <p style={{ color: 'rgba(148, 163, 184, 0.8)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
              {success}
            </p>
            <Link href="/login" style={{ 
              display: 'inline-block',
              width: '100%', 
              padding: '14px', 
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)', 
              color: 'white', 
              textDecoration: 'none',
              borderRadius: '14px', 
              fontSize: '15px', 
              fontWeight: 800,
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
              transition: 'all 0.3s'
            }}>
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative', zIndex: 1 }}>
            {error && <div style={{ color: '#fca5a5', background: 'rgba(239, 68, 68, 0.12)', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(10px)' }}>⚠️ {error}</div>}
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: 800, color: 'rgba(203, 213, 225, 0.8)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Full Name *</label>
              <input 
                type="text" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)', outline: 'none', fontSize: '14px', background: 'rgba(255, 255, 255, 0.04)', color: '#f1f5f9', fontWeight: 500, transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
                placeholder="e.g. John Doe"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: 800, color: 'rgba(203, 213, 225, 0.8)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Username *</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)', outline: 'none', fontSize: '14px', background: 'rgba(255, 255, 255, 0.04)', color: '#f1f5f9', fontWeight: 500, transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
                placeholder="johndoe"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: 800, color: 'rgba(203, 213, 225, 0.8)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Phone Number (Optional)</label>
              <input 
                type="tel" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{ width: '100%', padding: '16px 20px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)', outline: 'none', fontSize: '14px', background: 'rgba(255, 255, 255, 0.04)', color: '#f1f5f9', fontWeight: 500, transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
                placeholder="1234567890"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: 800, color: 'rgba(203, 213, 225, 0.8)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Password *</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '16px 40px 16px 20px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)', outline: 'none', fontSize: '14px', background: 'rgba(255, 255, 255, 0.04)', color: '#f1f5f9', fontWeight: 500, transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  placeholder="••••••••"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(148, 163, 184, 0.8)', cursor: 'pointer', padding: '4px 8px', fontSize: '14px', fontWeight: 'bold' }}
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-sentinel"
              disabled={loading}
              style={{ 
                marginTop: '8px',
                backgroundColor: loading ? 'rgba(100, 116, 139, 0.6)' : undefined,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating account...' : 'SIGN UP NOW'}
            </button>
          </form>
        )}

        {!success && (
          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'rgba(148, 163, 184, 0.7)', fontWeight: 600, position: 'relative', zIndex: 1 }}>
            Already have an account? <Link href="/login" style={{ color: '#a78bfa', fontWeight: 800, textDecoration: 'none' }}>Login here</Link>
          </div>
        )}

        <div style={{ marginTop: '32px', color: 'rgba(148, 163, 184, 0.4)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', position: 'relative', zIndex: 1 }}>
           🛡️ Protected by Enterprise Encryption
        </div>
      </div>
    </div>
  );
}
