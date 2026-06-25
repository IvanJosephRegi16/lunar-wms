'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function RejectedPOs() {
  const [user, setUser] = useState<any>(null);
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      try {
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();
        if (meData.error) { setError('Unauthorized'); setLoading(false); return; }

        const role = meData.user.role;

        // Accountant has NO access to rejected POs
        if (role === 'accountant') {
          setError('Access Denied: Accountants do not have access to the Rejected PO archive.');
          setLoading(false);
          return;
        }
        setUser(meData.user);

        const res = await fetch('/api/po');
        const data = await res.json();
        // PM sees POs they created AND POs that were rejected (which implies they rejected them)
        const all = (data.pos || []).filter((p: any) => p.status === 'rejected');
        const filtered = role === 'pm' ? all : all;
        setPos(filtered);
      } catch (e: any) {
        setError(e.message || 'Error loading rejected orders');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Loading rejected orders...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-clean" style={{ borderLeft: '4px solid var(--danger)', padding: '24px', maxWidth: '600px', margin: '40px auto' }}>
        <h3 style={{ color: 'var(--danger)', fontWeight: 800, fontSize: '16px' }}>🚫 Access Restricted</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>{error}</p>
        <Link href="/po" className="btn-corp" style={{ display: 'inline-block', marginTop: '16px', textDecoration: 'none' }}>← Back to PO Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 800 }}>❌ Rejected PO Archive</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Purchase orders that were rejected during Admin review.
          {user?.role === 'pm' && ' You may edit and resubmit returned orders from the PO Dashboard.'}
        </p>
      </div>

      {pos.length === 0 ? (
        <div className="card-clean" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
          <h3 style={{ fontWeight: 700, fontSize: '16px' }}>No Rejected POs</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>All purchase orders have cleared the review stage.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {pos.map(po => (
            <div key={po.id} className="card-clean" style={{ borderLeft: '4px solid var(--danger)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>PO Number</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--danger)', marginTop: '2px' }}>{po.po_number}</div>
                  {po.po_date && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Date: {po.po_date}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Vendor</span>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>{po.vendor}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Net Total</span>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'monospace', marginTop: '2px' }}>
                      ₹{(po.net_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rejection reason */}
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  ❌ Rejection Reason
                </div>
                <div style={{ fontSize: '13px', color: '#7f1d1d', fontWeight: 600 }}>
                  {po.rejection_reason || 'No reason specified by Admin.'}
                </div>
              </div>

              {/* Material items */}
              {Array.isArray(po.items) && po.items.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-ghost)', fontWeight: 800 }}>Code</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-ghost)', fontWeight: 800 }}>Material</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-ghost)', fontWeight: 800 }}>Size</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-ghost)', fontWeight: 800 }}>Required Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-ghost)', fontWeight: 800 }}>Unit</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-ghost)', fontWeight: 800 }}>Rate (₹)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-ghost)', fontWeight: 800 }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.items.map((item: any, i: number) => (
                        <tr key={i} style={{ borderBottom: i !== po.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 700 }}>{item.material_code}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.material_name}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{item.size_thickness}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{item.required_qty?.toLocaleString()}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-ghost)', fontSize: '11px' }}>{item.unit || 'Pair'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>₹{item.order_rate?.toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>₹{item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link href="/po/history" className="btn-corp" style={{ textDecoration: 'none', fontSize: '12px' }}>
                  🕒 View Audit History
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
