'use client';

import { useState, useEffect } from 'react';
import POResetExportPanel from '@/components/POResetExportPanel';

export default function SupervisorVerification() {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [receivedQty, setReceivedQty] = useState<Record<number, string>>({});
  const [userRole, setUserRole] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (meData.user) setUserRole(meData.user.role);
      const res = await fetch('/api/po/supervisor');
      const data = await res.json();
      if (Array.isArray(data)) setPos(data);
    } catch (err) {
      console.error('Failed to load supervisor queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const allItemsChecked = selectedPO?.items?.length > 0 && 
    selectedPO.items.every((_: any, i: number) => checkedItems[i]);

  const handleVerifyComplete = async () => {
    if (!allItemsChecked) {
      alert('Please verify all material line items before completing this PO.');
      return;
    }
    setVerifying(true);
    try {
      const payloadItems = selectedPO.items.map((item: any, i: number) => {
        const prevReceived = Number(item.received_qty || 0);
        const pending = Math.max(0, item.required_qty - prevReceived);
        const nowReceiving = receivedQty[i] !== undefined ? Number(receivedQty[i]) : pending;
        return {
          id: item.id,
          received_qty: prevReceived + nowReceiving
        };
      });

      const res = await fetch('/api/po/supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedPO.id, action: 'verify_complete', remarks, items: payloadItems })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setSelectedPO(null);
      setCheckedItems({});
      setReceivedQty({});
      setRemarks('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to verify');
    } finally {
      setVerifying(false);
    }
  };


  const handlePartialEntry = async () => {
    setVerifying(true);
    try {
      const payloadItems = selectedPO.items.map((item: any, i: number) => {
        const prevReceived = Number(item.received_qty || 0);
        const pending = Math.max(0, item.required_qty - prevReceived);
        const nowReceiving = receivedQty[i] !== undefined ? Number(receivedQty[i]) : pending;
        return {
          id: item.id,
          received_qty: prevReceived + nowReceiving
        };
      });

      const res = await fetch('/api/po/supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedPO.id, action: 'partial_entry', remarks, items: payloadItems })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      
      let remainingText = '';
      payloadItems.forEach((it: any, i: number) => {
        const og = selectedPO.items[i];
        const remaining = Math.max(0, og.required_qty - it.received_qty);
        const completed = it.received_qty;
        remainingText += `\n- ${og.material_name}:\n  Completed: ${completed} | Remaining: ${remaining}`;
      });
      
      alert(`Partial Entry Saved!\n\nStock Summary:${remainingText}`);
      
      // Update selectedPO with new received_qty so UI reflects changes
      const updatedPO = {
        ...selectedPO,
        items: selectedPO.items.map((item: any, i: number) => ({
          ...item,
          received_qty: payloadItems[i].received_qty
        }))
      };
      setSelectedPO(updatedPO);
      setReceivedQty({});
      setRemarks('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save partial entry');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Loading Supervisor Review Queue...</span>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>🔍 Supervisor Material Verification</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Verify all materials received against the Purchase Order before final completion.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <POResetExportPanel
            userRole={userRole}
            exportFilename={`Supervisor_POs_${new Date().toISOString().slice(0,10)}`}
            exportHeaders={['PO Number', 'Vendor', 'Items Count', 'Grand Total (Rs)', 'Payment Status', 'Created By']}
            exportRows={pos.map((po: any) => [
              po.po_number,
              po.vendor || '',
              (po.items || []).length,
              po.grand_total ?? 0,
              po.payment_status || 'unpaid',
              po.creator_name || ''
            ])}
            onResetComplete={loadData}
          />
          <div style={{
            background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', padding: '12px 20px',
            borderRadius: '14px', border: '1.5px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <span style={{ fontSize: '24px' }}>📋</span>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#4338ca', fontFamily: 'monospace' }}>{pos.length}</div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Review</div>
            </div>
          </div>
        </div>
      </div>

      {!selectedPO ? (
        /* ─── PO LIST TABLE ─── */
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>PO Number</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Vendor</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Items</th>
                  <th style={{ textAlign: 'right', padding: '14px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Grand Total</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Payment</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Created By</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-ghost)' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                      <div style={{ fontWeight: 800, fontSize: '15px' }}>No POs Pending Verification</div>
                      <div style={{ fontSize: '12px', marginTop: '6px', color: '#94a3b8' }}>All purchase orders have been verified. Check back later.</div>
                    </td>
                  </tr>
                ) : pos.map(po => (
                  <tr key={po.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{po.po_number}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>{po.vendor}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700 }}>{po.items?.length || 0}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>₹{Number(po.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                        background: po.payment_status === 'paid' ? '#f0fdf4' : '#fffbeb',
                        color: po.payment_status === 'paid' ? '#16a34a' : '#b45309',
                        border: `1px solid ${po.payment_status === 'paid' ? '#bbf7d0' : '#fde68a'}`
                      }}>{po.payment_status || 'unpaid'}</span>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', color: '#64748b' }}>{po.creator_name || '-'}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button onClick={() => { 
                        setSelectedPO(po); 
                        setCheckedItems({}); 
                        setRemarks(''); 
                        // Initialize receivedQty map
                        const initQty: Record<number, string> = {};
                        (po.items || []).forEach((item: any, i: number) => {
                           initQty[i] = item.received_qty > 0 ? item.received_qty.toString() : item.required_qty.toString();
                        });
                        setReceivedQty(initQty);
                      }}
                        style={{
                          background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', border: 'none',
                          padding: '8px 18px', borderRadius: '10px', fontWeight: 800, fontSize: '12px',
                          cursor: 'pointer', boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)', transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
                        🔍 Review & Verify
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ─── DETAILED VERIFICATION VIEW ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <button onClick={() => { setSelectedPO(null); setCheckedItems({}); setRemarks(''); }}
            style={{ alignSelf: 'flex-start', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', color: '#475569' }}>
            ← Back to Review Queue
          </button>

          {/* PO Summary Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #334155)', padding: '28px 32px',
            borderRadius: '18px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.25)'
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)' }}>Purchase Order</div>
              <div style={{ fontSize: '26px', fontWeight: 900, fontFamily: 'monospace', marginTop: '4px' }}>{selectedPO.po_number}</div>
              <div style={{ fontSize: '12px', marginTop: '6px', color: 'rgba(255,255,255,0.7)' }}>Vendor: <strong>{selectedPO.vendor}</strong></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)' }}>Grand Total</div>
              <div style={{ fontSize: '28px', fontWeight: 900, fontFamily: 'monospace', marginTop: '4px', color: '#a5b4fc' }}>₹{Number(selectedPO.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <div style={{ marginTop: '8px' }}>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                  background: selectedPO.payment_status === 'paid' ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)',
                  color: selectedPO.payment_status === 'paid' ? '#4ade80' : '#fbbf24'
                }}>{selectedPO.payment_status || 'unpaid'}</span>
              </div>
            </div>
          </div>

          {/* Material Verification Table */}
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📦</span> Material Line Items — Verification Checklist
              </h3>
              <div style={{ fontSize: '12px', fontWeight: 700, color: allItemsChecked ? '#16a34a' : '#94a3b8' }}>
                {Object.values(checkedItems).filter(Boolean).length} / {selectedPO.items?.length || 0} verified
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ width: '50px', padding: '12px', textAlign: 'center' }}>✓</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Material Code</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Material Name</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Size / Thickness</th>
                    <th style={{ textAlign: 'right', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Req. Stock</th>
                    <th style={{ textAlign: 'right', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Prev. Received</th>
                    <th style={{ textAlign: 'right', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Pending Stock</th>
                    <th style={{ textAlign: 'center', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Now Receiving</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Unit</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Vendor</th>
                    <th style={{ textAlign: 'right', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Rate (₹)</th>
                    <th style={{ textAlign: 'right', padding: '12px', fontWeight: 800, fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPO.items || []).map((item: any, i: number) => (
                    <tr key={i} style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: checkedItems[i] ? '#f0fdf4' : 'white',
                      transition: 'background 0.2s'
                    }}>
                      <td style={{ textAlign: 'center', padding: '12px' }}>
                        <label style={{ position: 'relative', display: 'inline-block', width: '22px', height: '22px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!checkedItems[i]}
                            onChange={e => setCheckedItems(prev => ({ ...prev, [i]: e.target.checked }))}
                            style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }} />
                          <span style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '22px', height: '22px', borderRadius: '6px',
                            border: checkedItems[i] ? '2px solid #22c55e' : '2px solid #cbd5e1',
                            background: checkedItems[i] ? '#22c55e' : 'white',
                            color: 'white', fontSize: '14px', fontWeight: 900, transition: 'all 0.2s'
                          }}>{checkedItems[i] ? '✓' : ''}</span>
                        </label>
                      </td>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#64748b', fontSize: '12px' }}>{item.material_category || 'Uncategorized'}</td>
                      <td style={{ padding: '12px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary)' }}>{item.material_code}</td>
                      <td style={{ padding: '12px', fontWeight: 700 }}>{item.material_name}</td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{item.size_thickness || '-'}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: '14px' }}>{Number(item.required_qty || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: '14px', color: '#16a34a' }}>{Number(item.received_qty || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: '14px', color: '#dc2626' }}>{Math.max(0, item.required_qty - (item.received_qty || 0)).toLocaleString()}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <input 
                          type="number" 
                          min="0"
                          max={Math.max(0, item.required_qty - (item.received_qty || 0))}
                          value={receivedQty[i] !== undefined ? receivedQty[i] : Math.max(0, item.required_qty - (item.received_qty || 0))}
                          onChange={(e) => setReceivedQty(prev => ({ ...prev, [i]: e.target.value }))}
                          style={{ width: '80px', padding: '6px', textAlign: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 700, fontFamily: 'monospace' }}
                        />
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700, fontSize: '12px', color: '#64748b' }}>{item.unit || 'Pair'}</td>
                      <td style={{ padding: '12px', fontWeight: 600, fontSize: '12px' }}>{item.vendor || selectedPO.vendor}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>₹{Number(item.order_rate || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>₹{Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks and Actions */}
          <div style={{
            background: 'white', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px',
            display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Supervisor Remarks
              </label>
              <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
                placeholder="Enter any observations, discrepancies, or notes..."
                rows={3}
                style={{
                  width: '100%', padding: '14px 16px', border: '1.5px solid #e2e8f0', borderRadius: '12px',
                  fontSize: '13px', fontWeight: 600, resize: 'vertical', outline: 'none', transition: 'border-color 0.2s',
                  fontFamily: 'inherit'
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#6366f1')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
              />
            </div>


            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              {/* Partial Entry */}
              <button onClick={handlePartialEntry} disabled={verifying}
                style={{
                  background: '#eff6ff', color: '#1d4ed8', border: '1.5px solid #bfdbfe',
                  padding: '12px 24px', borderRadius: '12px', fontWeight: 800, fontSize: '13px',
                  cursor: verifying ? 'wait' : 'pointer', opacity: verifying ? 0.6 : 1, transition: 'all 0.2s'
                }}>
                💾 Save Partial Entry
              </button>

              {/* Verify & Complete */}
              <button onClick={handleVerifyComplete} disabled={verifying || !allItemsChecked}
                style={{
                  background: allItemsChecked ? 'linear-gradient(135deg, #16a34a, #22c55e)' : '#e2e8f0',
                  color: allItemsChecked ? 'white' : '#94a3b8',
                  border: 'none', padding: '12px 32px', borderRadius: '12px',
                  fontWeight: 900, fontSize: '14px',
                  cursor: verifying || !allItemsChecked ? 'not-allowed' : 'pointer',
                  boxShadow: allItemsChecked ? '0 4px 12px rgba(34, 197, 94, 0.3)' : 'none',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                {verifying ? '⏳ Processing...' : '✅ Verify & Complete PO'}
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          {allItemsChecked && (
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', padding: '16px 24px',
              borderRadius: '14px', border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '12px'
            }}>
              <span style={{ fontSize: '24px' }}>✅</span>
              <div>
                <div style={{ fontWeight: 900, color: '#14532d', fontSize: '14px' }}>All Materials Verified</div>
                <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>Click "Verify & Complete PO" to finalize this purchase order.</div>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .fade-up {
          animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
