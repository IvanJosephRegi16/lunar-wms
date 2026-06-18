'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ReturnedPOs() {
  const [user, setUser] = useState<any>(null);
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPo, setSelectedPo] = useState<any>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (meRes.status === 401 || meData.error) {
        setError('Unauthorized Access. Please login.');
        setLoading(false);
        return;
      }
      setUser(meData.user);

      const poRes = await fetch('/api/po');
      const poData = await poRes.json();
      
      // Filter for returned POs
      const returnedList = (poData.pos || []).filter((p: any) => p.status === 'returned_for_edit');
      setPos(returnedList);
    } catch (err: any) {
      setError(err.message || 'Failed to load returned PO list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Scanning returned orders queue...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-clean" style={{ borderLeft: '4px solid var(--danger)', padding: '24px', margin: '20px auto', maxWidth: '600px' }}>
        <h3 style={{ color: 'var(--danger)', fontWeight: 800 }}>System Alert</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>{error}</p>
        <Link href="/po" className="btn-corp" style={{ display: 'inline-block', marginTop: '16px', textDecoration: 'none' }}>Return to Dashboard</Link>
      </div>
    );
  }

  const isPM = user?.role === 'pm';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Returned for Correction Queue</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Purchase orders returned by the Admin role for modifications and correction. {isPM ? 'Review suggestions, edit, and resubmit.' : 'View items and suggestions.'}
        </p>
      </div>

      {pos.length === 0 ? (
        <div className="card-clean" style={{ textAlign: 'center', padding: '64px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '48px' }}>✨</span>
          <h3 style={{ fontSize: '17px', fontWeight: 800 }}>Queue Completely Clear</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '400px' }}>
            There are no returned purchase orders requiring correction at this time.
          </p>
          <Link href="/po" className="btn-corp btn-primary-corp" style={{ textDecoration: 'none' }}>Go to Dashboard</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {pos.map(po => {
            const itemCount = Array.isArray(po.items) ? po.items.length : 0;
            return (
              <div key={po.id} className="card-clean tr-hover" style={{ display: 'flex', flexDirection: 'column', gap: '18px', borderLeft: '4px solid #ef4444', position: 'relative' }}>
                
                {/* Badge */}
                <div style={{ position: 'absolute', top: 0, right: 0, background: '#fef2f2', color: '#b91c1c', padding: '6px 14px', borderBottomLeftRadius: '10px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ↩ Returned for Edit
                </div>

                {/* Header detail */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>PO Number</span>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>{po.po_number}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Vendor</span>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>{po.vendor}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>PO Date</span>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>{po.po_date || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Net Amount</span>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px', fontFamily: 'monospace' }}>₹{(po.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => setSelectedPo(po)} className="btn-corp" style={{ fontSize: '12px', padding: '6px 12px' }}>
                      👁️ View Sheet
                    </button>
                    {(isPM || isAdmin) && (
                      <Link href={`/po/create?id=${po.id}`} className="btn-corp btn-primary-corp" style={{ textDecoration: 'none', fontSize: '12px', padding: '6px 14px', background: '#2563eb', borderColor: '#2563eb', color: 'white' }}>
                        ✏️ Edit &amp; Resubmit
                      </Link>
                    )}
                  </div>
                </div>

                {/* ── HIGHLIGHTED Admin Return Note ── */}
                <div style={{
                  background: 'linear-gradient(135deg, #fff0f0 0%, #fff5f5 100%)',
                  border: '2px solid #fca5a5',
                  borderLeft: '5px solid #ef4444',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 900, color: '#b91c1c', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <span style={{ fontSize: '18px' }}>⚠️</span>
                    Admin Correction Notice — Action Required
                  </div>
                  <p style={{
                    fontSize: '14px',
                    color: '#7f1d1d',
                    lineHeight: '1.6',
                    fontWeight: 700,
                    margin: '0',
                    background: '#fef2f2',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    fontStyle: 'italic'
                  }}>
                    "{po.correction_notes || 'Please review all inputs carefully and resubmit.'}"
                  </p>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 600 }}>
                  Created by: {po.creator_name || 'PM User'} &nbsp;•&nbsp; Last Updated: {po.updated_at || po.created_at || '-'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── VIEW SHEET MODAL ── */}
      {selectedPo && (
        <div
          onClick={() => setSelectedPo(null)}
          style={{
            position: 'fixed',
            top: '0', left: '0', right: '0', bottom: '0',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div
            className="card-clean fade-up"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '960px', maxHeight: '90vh', padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', borderTop: '4px solid #ef4444' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>↩ Returned PO — Sheet Preview</span>
                <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary)', marginTop: '4px' }}>PO: {selectedPo.po_number}</h3>
              </div>
              <button onClick={() => setSelectedPo(null)} style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: 'var(--text-ghost)', lineHeight: 1 }}>×</button>
            </div>

            {/* Summary info bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', background: '#f8fafc', padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              {[
                { label: 'Vendor / Supplier', value: selectedPo.vendor || '—' },
                { label: 'PO Date', value: selectedPo.po_date || '—' },
                { label: 'Items Count', value: `${(selectedPo.items || []).length} line items` },
              ].map(f => (
                <div key={f.label} style={{ flex: '1 1 160px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>{f.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 750, marginTop: '3px' }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* Return note inside modal too */}
            {selectedPo.correction_notes && (
              <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderLeft: '5px solid #ef4444', borderRadius: '10px', padding: '14px 18px' }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>⚠️ Admin Correction Note</div>
                <div style={{ fontSize: '13px', color: '#7f1d1d', fontWeight: 700, fontStyle: 'italic', lineHeight: 1.6 }}>"{selectedPo.correction_notes}"</div>
              </div>
            )}

            {/* Materials table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>
                    {['#', 'Category', 'Material Code', 'Material Description', 'Size / Thk', 'Current Stock', 'Req Qty', 'Unit', 'Rate (₹)', 'Amount (₹)'].map(h => (
                      <th key={h} style={{ textAlign: h === '#' || h === 'Req Qty' || h === 'Rate (₹)' || h === 'Amount (₹)' || h === 'Current Stock' ? 'right' : 'left', padding: '10px 12px', color: 'white', fontWeight: 800, fontSize: '11px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(selectedPo.items || []).length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-ghost)' }}>No items found</td></tr>
                  ) : (
                    (selectedPo.items || []).map((item: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-ghost)', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted)' }}>{item.category || '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>{item.material_code || '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.material_name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{item.size_thickness || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{(item.current_stock ?? 0).toLocaleString()} {item.current_stock_unit || ''}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>{(item.required_qty ?? 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-ghost)', fontSize: '11px' }}>{item.unit || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>₹{Number(item.order_rate || 0).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#16a34a' }}>₹{Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gross: <strong>₹{(selectedPo.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
              {(selectedPo.discount_percent ?? 0) > 0 && (
                <div style={{ fontSize: '13px', color: '#ef4444' }}>Discount: <strong>-{selectedPo.discount_percent}%</strong></div>
              )}
              <div style={{ fontSize: '16px', color: 'var(--primary)', fontWeight: 900 }}>Net Total: <strong>₹{(selectedPo.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button className="btn-corp" onClick={() => setSelectedPo(null)}>Close</button>
              {(isPM || isAdmin) && (
                <Link href={`/po/create?id=${selectedPo.id}`} className="btn-corp btn-primary-corp" style={{ textDecoration: 'none', background: '#2563eb', borderColor: '#2563eb', color: 'white' }}>
                  ✏️ Edit &amp; Resubmit
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
