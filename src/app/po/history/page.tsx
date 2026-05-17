'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function POHistory() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = () => {
    setLoading(true);
    fetch('/api/po/history')
      .then(res => res.json())
      .then(data => {
        setLogs(data.logs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return { icon: '✍️', bg: '#f1f5f9', color: '#64748b' };
      case 'edit':
        return { icon: '📝', bg: '#eff6ff', color: '#1d4ed8' };
      case 'submit':
        return { icon: '⏳', bg: '#fffbeb', color: '#b45309' };
      case 'approve':
        return { icon: '✅', bg: '#f0fdf4', color: '#15803d' };
      case 'reject':
        return { icon: '❌', bg: '#fef2f2', color: '#b91c1c' };
      case 'return_for_edit':
        return { icon: '🔄', bg: '#eff6ff', color: '#2563eb' };
      case 'accountant_update':
        return { icon: '💸', bg: '#f0fdf4', color: '#16a34a' };
      case 'completion':
        return { icon: '📁', bg: '#faf5ff', color: '#7e22ce' };
      default:
        return { icon: '⚙️', bg: '#f1f5f9', color: '#334155' };
    }
  };

  const filteredLogs = logs.filter(l => 
    l.po_number.toLowerCase().includes(search.toLowerCase()) ||
    (l.vendor && l.vendor.toLowerCase().includes(search.toLowerCase())) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.username.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Loading WMS audit log stream...</span>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Header banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>WMS PO History & Audit Ledger</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Complete chronological ledger representing all actions, state transitions, comments, and actors in the PO lifecycles.
          </p>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="card-clean" style={{ padding: '16px 24px' }}>
        <input type="text" placeholder="🔍 Search logs by PO Code, Vendor, Action, or Actor username..." value={search} onChange={e => setSearch(e.target.value)} style={{
          width: '100%',
          background: '#f8fafc',
          border: '1px solid var(--border)',
          padding: '12px 18px',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: 'inherit',
          fontWeight: 500,
          outline: 'none'
        }} />
      </div>

      {/* Audit timeline list */}
      <div className="card-clean" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {filteredLogs.length === 0 ? (
          <div style={{ color: 'var(--text-ghost)', textAlign: 'center', padding: '48px', fontWeight: 600 }}>
            No matching logs found in active history.
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const act = getActionIcon(log.action);
            return (
              <div key={log.id} style={{
                display: 'flex',
                gap: '20px',
                borderLeft: idx !== filteredLogs.length - 1 ? '2px dashed var(--border)' : 'none',
                paddingLeft: '24px',
                paddingBottom: '8px',
                position: 'relative'
              }}>
                {/* Circular Action Icon badge */}
                <div style={{
                  position: 'absolute',
                  left: '-17px',
                  top: '0',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: act.bg,
                  border: `1px solid var(--border)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                }}>
                  {act.icon}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  
                  {/* Title block */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{log.po_number}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-ghost)', marginLeft: '8px' }}>({log.vendor || 'No Vendor'})</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontFamily: 'monospace' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </span>
                  </div>

                  {/* Description of change */}
                  <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                    {log.description}
                  </p>

                  {/* Actor tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: act.color }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>
                      Actor: {log.username}
                    </span>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
