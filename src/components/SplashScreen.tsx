'use client';

import { useEffect, useState } from 'react';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade out at 2.5s, fully hidden at 3s
    const fadeTimer = setTimeout(() => setFadeOut(true), 2500);
    const hideTimer = setTimeout(() => setVisible(false), 3100);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;

  const balls = [
    { size: 60, top: '8%', left: '5%', delay: '0s', duration: '3.2s' },
    { size: 44, top: '15%', left: '78%', delay: '0.4s', duration: '2.8s' },
    { size: 72, top: '70%', left: '82%', delay: '0.8s', duration: '3.6s' },
    { size: 38, top: '60%', left: '3%', delay: '0.2s', duration: '2.5s' },
    { size: 52, top: '35%', left: '88%', delay: '1.1s', duration: '3.0s' },
    { size: 30, top: '85%', left: '20%', delay: '0.6s', duration: '2.7s' },
    { size: 48, top: '80%', left: '55%', delay: '1.3s', duration: '3.4s' },
    { size: 36, top: '5%', left: '48%', delay: '0.9s', duration: '2.9s' },
    { size: 26, top: '45%', left: '12%', delay: '1.5s', duration: '2.6s' },
    { size: 42, top: '22%', left: '60%', delay: '0.3s', duration: '3.1s' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'radial-gradient(ellipse at 30% 40%, #1a0a2e 0%, #0d0d1a 50%, #0a0a12 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <style>{`
        @keyframes floatBall {
          0%   { transform: translateY(0px) scale(1) rotate(0deg); }
          25%  { transform: translateY(-28px) scale(1.06) rotate(8deg); }
          50%  { transform: translateY(-14px) scale(0.96) rotate(-4deg); }
          75%  { transform: translateY(-34px) scale(1.03) rotate(12deg); }
          100% { transform: translateY(0px) scale(1) rotate(0deg); }
        }
        @keyframes pulseBall {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
          50%       { box-shadow: 0 0 24px 8px rgba(220,38,38,0.35); }
        }
        @keyframes splashLogoIn {
          0%   { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          60%  { opacity: 1; transform: scale(1.08) rotate(2deg); }
          80%  { transform: scale(0.97) rotate(-1deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes splashTextIn {
          0%   { opacity: 0; transform: translateY(30px) letterSpacing(0.5em); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes particleFloat {
          0%   { transform: translateY(0) translateX(0); opacity: 0.6; }
          100% { transform: translateY(-120vh) translateX(20px); opacity: 0; }
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(220,38,38,0.5)) drop-shadow(0 0 60px rgba(220,38,38,0.2)); }
          50%       { filter: drop-shadow(0 0 40px rgba(220,38,38,0.8)) drop-shadow(0 0 100px rgba(220,38,38,0.4)); }
        }
        @keyframes ringExpand {
          0%   { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* Floating particle dots */}
      {[...Array(12)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 3 + (i % 3), height: 3 + (i % 3),
          borderRadius: '50%',
          background: `rgba(220,38,38,${0.3 + (i % 4) * 0.1})`,
          left: `${(i * 7 + 10) % 90}%`,
          bottom: '-10px',
          animation: `particleFloat ${4 + (i % 3)}s ${i * 0.4}s linear infinite`,
        }} />
      ))}

      {/* Floating Lunar logo balls around the screen */}
      {balls.map((ball, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: ball.top, left: ball.left,
          width: ball.size, height: ball.size,
          borderRadius: '50%',
          overflow: 'hidden',
          animation: `floatBall ${ball.duration} ${ball.delay} ease-in-out infinite, pulseBall ${ball.duration} ${ball.delay} ease-in-out infinite`,
          border: '2px solid rgba(220,38,38,0.4)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          opacity: 0.75,
        }}>
          <img src="/lunars-logo.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ))}

      {/* Expanding ring behind main logo */}
      <div style={{
        position: 'absolute',
        width: 180, height: 180,
        borderRadius: '50%',
        border: '2px solid rgba(220,38,38,0.5)',
        animation: 'ringExpand 2s 0.5s ease-out infinite',
      }} />
      <div style={{
        position: 'absolute',
        width: 180, height: 180,
        borderRadius: '50%',
        border: '2px solid rgba(220,38,38,0.3)',
        animation: 'ringExpand 2s 1.0s ease-out infinite',
      }} />

      {/* Main central logo */}
      <div style={{
        animation: 'splashLogoIn 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) both, glowPulse 2s 1s ease-in-out infinite',
        zIndex: 2,
        marginBottom: 32,
      }}>
        <div style={{
          width: 160, height: 160,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '3px solid rgba(220,38,38,0.8)',
          boxShadow: '0 0 0 6px rgba(220,38,38,0.15), 0 24px 80px rgba(0,0,0,0.8)',
        }}>
          <img src="/lunars-logo.png" alt="Lunar's Viking" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>

      {/* Brand text */}
      <div style={{
        animation: 'splashTextIn 0.7s 0.8s cubic-bezier(0.4, 0, 0.2, 1) both',
        textAlign: 'center', zIndex: 2,
      }}>
        <div style={{
          fontSize: 28, fontWeight: 900, letterSpacing: '0.18em',
          background: 'linear-gradient(90deg, #fff 0%, #f87171 50%, #fff 100%)',
          backgroundSize: '800px 100%',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          animation: 'shimmer 2.5s 1s linear infinite',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          textTransform: 'uppercase',
        }}>
          Lunar's Viking
        </div>
        <div style={{
          fontSize: 12, letterSpacing: '0.35em', color: 'rgba(255,255,255,0.4)',
          marginTop: 8, textTransform: 'uppercase', fontFamily: 'inherit',
          animation: 'splashTextIn 0.7s 1.1s cubic-bezier(0.4, 0, 0.2, 1) both',
        }}>
          Warehouse Management System
        </div>
      </div>

      {/* Loading dots */}
      <div style={{
        display: 'flex', gap: 8, marginTop: 48, zIndex: 2,
        animation: 'splashTextIn 0.5s 1.4s ease both',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: '#dc2626',
            animation: `floatBall 1s ${i * 0.2}s ease-in-out infinite`,
            boxShadow: '0 0 10px rgba(220,38,38,0.6)',
          }} />
        ))}
      </div>
    </div>
  );
}
