'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ApprovedPOs() {
  const [user, setUser] = useState<any>(null);
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [selectedPo, setSelectedPo] = useState<any>(null);

  useEffect(() => {
    // Fetch auth session to know user details
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});

    // Fetch POs
    fetch('/api/po')
      .then(res => res.json())
      .then(data => {
        setPos(data.pos || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Loading approved orders queue...</span>
      </div>
    );
  }

  // Filter list based on selected view mode
  const filteredPOs = pos.filter((po: any) => {
    if (viewMode === 'active') {
      return po.status === 'accountant_processing';
    } else {
      // History: show everything that is approved (currently processing or completed)
      return po.status === 'accountant_processing' || po.status === 'completed';
    }
  });

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Approved PO Log</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {viewMode === 'active' 
              ? 'Purchase orders approved by Admin and currently undergoing Accountant processing.' 
              : 'Historical ledger of all approved purchase orders including completed and paid logs.'}
          </p>
        </div>

        {/* View Mode Switcher buttons */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button 
            onClick={() => setViewMode('active')}
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'active' ? 'white' : 'transparent',
              color: viewMode === 'active' ? 'var(--primary)' : 'var(--text-ghost)',
              cursor: 'pointer',
              boxShadow: viewMode === 'active' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            ⚡ Active Queue
          </button>
          
          <button 
            onClick={() => setViewMode('history')}
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'history' ? 'white' : 'transparent',
              color: viewMode === 'history' ? 'var(--primary)' : 'var(--text-ghost)',
              cursor: 'pointer',
              boxShadow: viewMode === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            📜 Approved History
          </button>
        </div>
      </div>

      {/* Main clean card data table */}
      <div className="card-clean" style={{ padding: '0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-corporate">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Supplier/Vendor</th>
                <th style={{ textAlign: 'right' }}>Items Count</th>
                <th style={{ textAlign: 'right' }}>Net Amount</th>
                {viewMode === 'history' && (
                  <>
                    <th style={{ textAlign: 'right' }}>Paid Amt</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                  </>
                )}
                <th>Status</th>
                <th>Approved On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={viewMode === 'history' ? 9 : 7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-ghost)', fontWeight: 600 }}>
                    No {viewMode === 'active' ? 'Active' : 'Historical'} Approved POs found.
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po: any) => {
                  const itemCount = Array.isArray(po.items) ? po.items.length : 0;
                  return (
                    <tr key={po.id} className="tr-hover">
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{po.po_number}</td>
                      <td style={{ fontWeight: 600 }}>{po.vendor || po.supplier_name || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{itemCount} item{itemCount !== 1 ? 's' : ''}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-main)' }}>
                        ₹{(po.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      {viewMode === 'history' && (
                        <>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>
                            ₹{(po.amount_paid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: po.balance_amount > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                            ₹{(po.balance_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </>
                      )}
                      <td>
                        {po.status === 'completed' ? (
                          <span style={{ display: 'inline-block', background: '#dcfce7', color: '#16a34a', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                            Completed
                          </span>
                        ) : (
                          <span style={{ display: 'inline-block', background: '#fef9c3', color: '#ca8a04', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                            Accountant processing
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {po.approved_timestamp || '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => setSelectedPo(po)} 
                            className="btn-corp" 
                            style={{ padding: '6px 12px', fontSize: '11px' }}
                          >
                            👁️ View Sheet
                          </button>
                          
                          {(user?.role === 'accountant' || user?.role === 'admin') && po.status === 'accountant_processing' && (
                            <Link href="/po/accountant" className="btn-corp btn-primary-corp" style={{ textDecoration: 'none', fontSize: '11px', padding: '6px 12px' }}>
                              Process Financials →
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 800, textTransform: 'uppercase' }}>Approved PO Specifications</span>
                <h3 style={{ fontSize: '18px', fontWeight: 850, color: 'var(--primary)', marginTop: '4px' }}>PO: {selectedPo.po_number}</h3>
              </div>
              <button onClick={() => setSelectedPo(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-ghost)' }}>×</button>
            </div>

            <div className="grid grid-2" style={{ gap: '24px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700 }}>VENDOR / SUPPLIER</div>
                <div style={{ fontSize: '14px', fontWeight: 750, marginTop: '2px' }}>{selectedPo.vendor || selectedPo.supplier_name}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700 }}>PO DATE / APPROVED ON</div>
                <div style={{ fontSize: '14px', fontWeight: 750, marginTop: '2px' }}>{selectedPo.po_date || '-'} ({selectedPo.approved_timestamp || '-'})</div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Material Code</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Description</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Size / Thk</th>
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
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace' }}>{Number(item.required_qty || 0).toLocaleString()} {item.unit || 'Pair'}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'monospace' }}>₹{Number(item.order_rate || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, fontFamily: 'monospace' }}>₹{Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gross: <strong>₹{(selectedPo.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
              <div style={{ fontSize: '13px', color: '#ef4444' }}>Discount: <strong>-{(selectedPo.discount_percent ?? 0)}%</strong></div>
              <div style={{ fontSize: '15px', color: 'var(--primary)', fontWeight: 800 }}>Net Total: <strong>₹{(selectedPo.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
              {selectedPo.status === 'completed' && (
                <>
                  <div style={{ fontSize: '13px', color: '#16a34a' }}>Paid Total: <strong>₹{(selectedPo.amount_paid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
                  <div style={{ fontSize: '13px', color: selectedPo.balance_amount > 0 ? '#dc2626' : 'var(--text-muted)' }}>Balance Remaining: <strong>₹{(selectedPo.balance_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
                </>
              )}
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
