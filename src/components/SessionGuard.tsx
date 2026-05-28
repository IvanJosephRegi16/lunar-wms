'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SessionGuard({ children, user }: { children: React.ReactNode, user: any }) {
  const router = useRouter();
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string>('');

  useEffect(() => {
    if (!user) return; // Not logged in initially, let middleware handle it

    const channel = new BroadcastChannel('lunar_session');

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'LOGOUT') {
        setIsLocked(true);
        setLockReason('Session logged out in another tab.');
        setTimeout(() => {
          router.push('/login?reason=logged_out_elsewhere');
        }, 1500);
      }
    };

    channel.addEventListener('message', handleMessage);

    // Fallback using localStorage for older browsers or if BroadcastChannel fails
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'lunar_logout_event' && event.newValue) {
        setIsLocked(true);
        setLockReason('Session logged out in another tab.');
        setTimeout(() => {
          router.push('/login?reason=logged_out_elsewhere');
        }, 1500);
      }
    };

    window.addEventListener('storage', handleStorage);

    // Session Visibility check (lightweight heartbeat)
    const checkSession = async () => {
      if (!navigator.onLine) return; // Offline-first compatibility: don't panic
      
      try {
        const res = await fetch('/api/auth/session-check');
        if (!res.ok) {
          setIsLocked(true);
          setLockReason('Session expired.');
          setTimeout(() => {
            router.push('/login?reason=expired');
          }, 1500);
        }
      } catch (err) {
        // Network error during check, ignore and let offline mode work
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, router]);

  if (isLocked) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#0a0a0a', zIndex: 99999, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontFamily: 'sans-serif'
      }}>
        <div style={{
          padding: '40px', backgroundColor: '#171717', borderRadius: '16px',
          border: '1px solid #333', textAlign: 'center', maxWidth: '400px'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '16px', fontSize: '24px' }}>🔒 Session Locked</h2>
          <p style={{ color: '#a3a3a3', marginBottom: '24px' }}>{lockReason}</p>
          <p style={{ color: '#666', fontSize: '14px' }}>Redirecting to login safely...</p>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid #333', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { to { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  return <>{children}</>;
}
