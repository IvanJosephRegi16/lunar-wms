'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LiveExternalLedger() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        
        if (res.status === 401 || data.error) {
          router.push('/login');
          return;
        }
        
        if (data.user?.role !== 'admin' && data.user?.role !== 'pm') {
          router.push('/');
          return;
        }

        setUser(data.user);
      } catch (err) {
        console.error('Auth error', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Loading Secure Workspace...</span>
      </div>
    );
  }

  if (!user) return null;

  // Uses rm=minimal to hide the bulky Google Sheets header/toolbars and give a native feel
  const sheetUrl = "https://docs.google.com/spreadsheets/d/1ErWGgNjV-aBSj25nVMRO-dVuRiMIFd5OgvrwCN5Xegg/edit?rm=minimal&gid=769433327#gid=769433327";

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 120px)' }}>
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>📈</span> External Live Ledger Workspace
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '800px', lineHeight: '1.5' }}>
          Real-time collaborative Google Sheet integration. Any changes made here are instantly saved and synchronized live. This workspace is restricted exclusively to Admin and Project Manager roles.
        </p>
      </div>

      <div className="card-clean" style={{ padding: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: '0 20px 40px -12px rgba(0,0,0,0.1)' }}>
        <div style={{ background: '#f8fafc', padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-ghost)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Live Connection Active</span>
          </div>
          <a href={sheetUrl.replace('?rm=minimal&', '?')} target="_blank" rel="noreferrer" className="btn-corp" style={{ textDecoration: 'none', padding: '6px 14px', fontSize: '12px' }}>
            Open in New Tab ↗
          </a>
        </div>
        
        <div style={{ flex: 1, position: 'relative' }}>
          <iframe 
            src={sheetUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="External Live Ledger"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
