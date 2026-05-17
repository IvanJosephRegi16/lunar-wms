'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PODashboard() {
  const [user, setUser] = useState<any>(null);
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch session user
      const userRes = await fetch('/api/auth/me');
      const userData = await userRes.json();
      if (userData.error) {
        setError('Failed to authenticate');
        return;
      }
      setUser(userData.user);

      // Fetch all POs
      const poRes = await fetch('/api/po');
      const poData = await poRes.json();
      setPos(poData.pos || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load PO details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loading ERP Pipeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-clean" style={{ borderLeft: '4px solid var(--danger)', padding: '24px', margin: '20px auto', maxWidth: '600px' }}>
        <h3 style={{ color: 'var(--danger)', fontWeight: 800 }}>System Authorization Error</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>{error}</p>
        <button className="btn-corp" style={{ marginTop: '16px' }} onClick={loadData}>Retry Connection</button>
      </div>
    );
  }

  // Calculate Pipeline Metrics
  const drafts = pos.filter(p => p.status === 'draft');
  const pending = pos.filter(p => p.status === 'pending_admin_approval');
  const returned = pos.filter(p => p.status === 'returned_for_edit');
  const rejected = pos.filter(p => p.status === 'rejected');
  const processing = pos.filter(p => p.status === 'accountant_processing');
  const completed = pos.filter(p => p.status === 'completed');

  // Multi-user pipeline visual feed
  const recentTimeline = pos
    .filter(p => p.updated_at || p.created_at)
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return { label: 'Draft', bg: '#f1f5f9', color: '#64748b' };
      case 'pending_admin_approval':
        return { label: 'Pending Approval', bg: '#fffbeb', color: '#b45309' };
      case 'returned_for_edit':
        return { label: 'Returned for Correction', bg: '#eff6ff', color: '#1d4ed8' };
      case 'rejected':
        return { label: 'Rejected', bg: '#fef2f2', color: '#b91c1c' };
      case 'accountant_processing':
        return { label: 'Accountant processing', bg: '#f0fdf4', color: '#15803d' };
      case 'completed':
        return { label: 'Completed', bg: '#faf5ff', color: '#7e22ce' };
      default:
        return { label: status, bg: '#f1f5f9', color: '#334155' };
    }
  };

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Premium Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '36px 40px',
        borderRadius: '16px',
        color: 'white',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ zIndex: 2 }}>
          <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1' }}>Enterprise Module</span>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px', letterSpacing: '-0.02em' }}>Material Procurement PO System</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '6px', maxWidth: '500px' }}>
            Multi-user transaction workflow managing material procurement, vendors, approvals, financial audits, and live ledger statuses.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', zIndex: 2 }}>
          {(user?.role === 'pm' || user?.role === 'admin') && (
            <Link href="/po/create" className="btn-corp btn-primary-corp" style={{ textDecoration: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700 }}>
              + Create New PO
            </Link>
          )}
        </div>
        <div style={{ position: 'absolute', right: '-50px', bottom: '-50px', fontSize: '180px', opacity: 0.03, pointerEvents: 'none' }}>📋</div>
      </div>

      {/* Workflow Stage Timeline Matrix */}
      <div className="grid grid-6" style={{ gap: '16px' }}>
        {[
          { label: 'Drafts', count: drafts.length, status: 'draft', icon: '📝', bg: 'var(--primary)' },
          { label: 'Pending Approval', count: pending.length, status: 'pending_admin_approval', icon: '⏳', bg: '#f59e0b' },
          { label: 'Correction Required', count: returned.length, status: 'returned_for_edit', icon: '🔄', bg: '#3b82f6' },
          { label: 'Rejected Logs', count: rejected.length, status: 'rejected', icon: '❌', bg: '#ef4444' },
          { label: 'Accountant Review', count: processing.length, status: 'accountant_processing', icon: '💸', bg: '#10b981' },
          { label: 'Completed POs', count: completed.length, status: 'completed', icon: '📁', bg: '#8b5cf6' }
        ].map((stage, idx) => (
          <div key={idx} className="card-clean" style={{
            padding: '24px',
            borderTop: `4px solid ${stage.bg}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
            transition: 'transform 0.2s',
            cursor: 'pointer'
          }} onClick={() => {
            const pathMap: Record<string, string> = {
              'draft': '/po/create',
              'pending_admin_approval': '/po/pending',
              'returned_for_edit': '/po/create',
              'rejected': '/po/rejected',
              'accountant_processing': '/po/accountant',
              'completed': '/po/completed'
            };
            window.location.href = pathMap[stage.status];
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '24px' }}>{stage.icon}</span>
              <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'monospace' }}>{stage.count}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stage {idx + 1}</span>
              <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>{stage.label}</h4>
            </div>
          </div>
        ))}
      </div>

      {/* Main Workspace split */}
      <div className="grid grid-3" style={{ gap: '32px' }}>
        
        {/* Recent PO pipeline list */}
        <div style={{ gridColumn: 'span 2' }}>
          <div className="card-clean" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>Active Procurement Stream</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>The latest operational material orders running inside the WMS PO module.</p>
              </div>
              <Link href="/po/history" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>View Full Logs →</Link>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="table-corporate">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Vendor</th>
                    <th>Items</th>
                    <th style={{ textAlign: 'right' }}>Gross Total</th>
                    <th style={{ textAlign: 'right' }}>Net Total</th>
                    <th>Workflow Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-ghost)', fontWeight: 600 }}>No Purchase Orders Registered</td>
                    </tr>
                  ) : (
                    pos.slice(0, 8).map(po => {
                      const b = getStatusBadge(po.status);
                      const itemCount = Array.isArray(po.items) ? po.items.length : 0;
                      return (
                        <tr key={po.id} className="tr-hover" style={{ cursor: 'pointer' }} onClick={() => {
                          const routeMap: Record<string, string> = {
                            'draft': `/po/create?id=${po.id}`,
                            'returned_for_edit': `/po/create?id=${po.id}`,
                            'pending_admin_approval': '/po/pending',
                            'rejected': '/po/rejected',
                            'accountant_processing': '/po/accountant',
                            'completed': '/po/completed'
                          };
                          window.location.href = routeMap[po.status] || `/po/history`;
                        }}>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{po.po_number}</td>
                          <td>{po.vendor}</td>
                          <td style={{ fontWeight: 600 }}>{itemCount} material line{itemCount !== 1 ? 's' : ''}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>₹{po.gross_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace' }}>₹{po.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: b.bg,
                              color: b.color
                            }}>{b.label}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Chronological updates feeds */}
        <div>
          <div className="card-clean" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Audit Feed</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Realtime pipeline events tracking.</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {recentTimeline.length === 0 ? (
                <div style={{ color: 'var(--text-ghost)', textAlign: 'center', padding: '24px', fontSize: '13px', fontWeight: 600 }}>No operations recorded</div>
              ) : (
                recentTimeline.map((p, idx) => {
                  const b = getStatusBadge(p.status);
                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      gap: '12px',
                      borderLeft: '2px dashed var(--border)',
                      paddingLeft: '16px',
                      position: 'relative'
                    }}>
                      <div style={{
                        position: 'absolute',
                        left: '-6px',
                        top: '2px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: b.color
                      }} />
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{p.po_number}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontFamily: 'monospace' }}>
                            {new Date(p.updated_at || p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Vendor <strong style={{ color: 'var(--text-main)' }}>{p.vendor}</strong> entered state <strong style={{ color: b.color }}>{b.label}</strong>.
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
