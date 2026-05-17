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
              <div key={po.id} className="card-clean tr-hover" style={{ display: 'flex', flexDirection: 'column', gap: '18px', borderLeft: '4px solid #3b82f6', position: 'relative' }}>
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
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px', fontFamily: 'monospace' }}>₹{po.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setSelectedPo(po)} className="btn-corp" style={{ fontSize: '12px', padding: '6px 12px' }}>
                      👁️ View Sheet
                    </button>
                    {(isPM || isAdmin) && (
                      <Link href={`/po/create?id=${po.id}`} className="btn-corp btn-primary-corp" style={{ textDecoration: 'none', fontSize: '12px', padding: '6px 14px', background: '#3b82f6', borderColor: '#3b82f6', color: 'white' }}>
                        ✏️ Edit & Resubmit
                      </Link>
                    )}
                  </div>
                </div>

                {/* Suggestions / remarks */}
                <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#1d4ed8', marginBottom: '4px' }}>
                    <span>💡 Suggestion / Instruction from Admin:</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#1e40af', lineHeight: '1.4', fontWeight: 600, margin: '0' }}>
                    "{po.correction_notes || 'Please review inputs and resubmit.'}"
                  </p>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 600 }}>
                  Created by: {po.creator_name || 'PM User'} • Last Updated: {po.updated_at || po.created_at || '-'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Materials Sheet Details Modal */}
      {selectedPo && (
        <div style={{
          position: 'fixed',
          top: '0', left: '0', right: '0', bottom: '0',
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="card-clean fade-up" style={{ width: '100%', maxWidth: '800px', maxHeight: '85vh', padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 800, textTransform: 'uppercase' }}>Sheet Preview</span>
                <h3 style={{ fontSize: '18px', fontWeight: 850, color: 'var(--primary)', marginTop: '4px' }}>PO: {selectedPo.po_number}</h3>
              </div>
              <button onClick={() => setSelectedPo(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-ghost)' }}>×</button>
            </div>

            <div className="grid grid-2" style={{ gap: '24px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700 }}>VENDOR / SUPPLIER</div>
                <div style={{ fontSize: '14px', fontWeight: 750, marginTop: '2px' }}>{selectedPo.vendor}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700 }}>PO DATE</div>
                <div style={{ fontSize: '14px', fontWeight: 750, marginTop: '2px' }}>{selectedPo.po_date || '-'}</div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Material Code</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Description</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Size / Thk</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Stock</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Required Qty</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Rate</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPo.items || []).map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{item.material_code}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.material_name}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{item.size_thickness}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'monospace' }}>{item.current_stock?.toLocaleString()} {item.current_stock_unit || 'Pair'}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace' }}>{item.required_qty?.toLocaleString()} {item.unit || 'Pair'}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'monospace' }}>₹{item.order_rate?.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, fontFamily: 'monospace' }}>₹{item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gross: <strong>₹{selectedPo.gross_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
              <div style={{ fontSize: '13px', color: '#ef4444' }}>Discount: <strong>-{selectedPo.discount_percent}%</strong></div>
              <div style={{ fontSize: '15px', color: 'var(--primary)', fontWeight: 800 }}>Net Total: <strong>₹{selectedPo.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn-corp" onClick={() => setSelectedPo(null)}>Close sheet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
