'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPOQueue() {
  const [user, setUser] = useState<any>(null);
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals / Interactive state
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (meData.error || meData.user.role !== 'admin') {
        setError('Access Denied: Only System Administrators can review pending purchase orders.');
        setLoading(false);
        return;
      }
      setUser(meData.user);

      const poRes = await fetch('/api/po');
      const poData = await poRes.json();
      
      // Filter strictly for pending admin review POs
      const pendingPOs = (poData.pos || []).filter((p: any) => p.status === 'pending_admin_approval');
      setPos(pendingPOs);
    } catch (err: any) {
      setError(err.message || 'Failed to load pending queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerAction = async () => {
    if (!selectedPo || !actionType) return;
    
    if ((actionType === 'reject' || actionType === 'return') && !commentInput.trim()) {
      alert(`Please provide a reason or note for this ${actionType} action.`);
      return;
    }

    try {
      setActionLoading(true);
      
      const res = await fetch('/api/po/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPo.id,
          action: actionType,
          comments: commentInput,
          rejection_reason: actionType === 'reject' ? commentInput : undefined,
          correction_notes: actionType === 'return' ? commentInput : undefined
        })
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      setSuccess(`PO ${selectedPo.po_number} was successfully ${actionType}d!`);
      setSelectedPo(null);
      setActionType(null);
      setCommentInput('');

      setTimeout(() => {
        setSuccess('');
        loadData();
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Error processing request');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Scanning Admin Pending Queue...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-clean" style={{ borderLeft: '4px solid var(--danger)', padding: '24px', margin: '20px auto', maxWidth: '600px' }}>
        <h3 style={{ color: 'var(--danger)', fontWeight: 800 }}>Authorization Notice</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>{error}</p>
        <Link href="/po" className="btn-corp" style={{ display: 'inline-block', marginTop: '16px', textDecoration: 'none' }}>Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      
      {/* Header banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Admin Pending Approval Queue</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Review, authorize, reject, or return submitted purchase orders to the PM stage.
          </p>
        </div>
        <span style={{ fontSize: '12px', background: '#fffbeb', color: '#b45309', padding: '6px 12px', borderRadius: '8px', fontWeight: 700, border: '1px solid #fde68a' }}>
          {pos.length} Pending Approvals
        </span>
      </div>

      {success && (
        <div style={{ background: '#f0fdf4', borderLeft: '4px solid var(--success)', padding: '16px 20px', borderRadius: '8px', color: '#15803d', fontSize: '14px', fontWeight: 600 }}>
          {success}
        </div>
      )}

      {pos.length === 0 ? (
        <div className="card-clean" style={{ textAlign: 'center', padding: '64px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '48px' }}>🎉</span>
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Queue Completely Clear</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '400px' }}>
            There are no pending purchase orders requiring admin authorization at this time.
          </p>
          <Link href="/po" className="btn-corp btn-primary-corp" style={{ textDecoration: 'none' }}>Go to Dashboard</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {pos.map(po => {
            const itemCount = Array.isArray(po.items) ? po.items.length : 0;
            return (
              <div key={po.id} className="card-clean tr-hover" style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', overflow: 'hidden' }}>
                
                {/* Badge label */}
                <div style={{ position: 'absolute', right: '0', top: '0', background: '#fffbeb', color: '#b45309', padding: '8px 16px', borderBottomLeftRadius: '12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pending Review
                </div>

                {/* Title row */}
                <div className="grid grid-3" style={{ gap: '24px', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>PO NUMBER</span>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>{po.po_number}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>PO DATE</span>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>{po.po_date || po.created_at?.split('T')[0] || '-'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>VENDOR</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>{po.vendor}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>MATERIALS REGISTERED</span>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>{itemCount} material line{itemCount !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                {/* Detailed Material items table */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Code</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Name</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Size / Thickness</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-ghost)', fontWeight: 800, textAlign: 'right' }}>Current Stock</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Stock Unit</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-ghost)', fontWeight: 800, textAlign: 'right' }}>Required Qty</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Unit</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-ghost)', fontWeight: 800, textAlign: 'right' }}>Order Rate (₹)</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-ghost)', fontWeight: 800, textAlign: 'right' }}>Amount (₹)</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Vendor</th>
                        <th style={{ padding: '8px 12px', color: 'var(--text-ghost)', fontWeight: 800 }}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemCount === 0 ? (
                        <tr>
                          <td colSpan={11} style={{ padding: '12px', textAlign: 'center', color: 'var(--text-ghost)' }}>No items attached</td>
                        </tr>
                      ) : (
                        po.items.map((item: any, i: number) => (
                          <tr key={i} style={{ borderBottom: i !== itemCount - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700 }}>{item.material_code}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.material_name}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.size_thickness}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{item.current_stock.toLocaleString()}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-ghost)', fontSize: '11px' }}>{item.current_stock_unit || '-'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>{item.required_qty.toLocaleString()}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-ghost)' }}>{item.unit || 'Pair'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>₹{item.order_rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>₹{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.vendor || po.vendor}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{item.remarks || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pricing formulas review */}
                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: '16px 20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '48px' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Gross Amount</span>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>₹{po.gross_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Discount Applied</span>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444', marginTop: '2px', fontFamily: 'monospace' }}>-{po.discount_percent}%</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Net Amount Required</span>
                      <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--primary)', marginTop: '2px', fontFamily: 'monospace' }}>₹{po.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                </div>

                {/* Remarks block */}
                {po.remarks && (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', borderLeft: '3px solid var(--border)', paddingLeft: '12px' }}>
                    <strong>Global Remarks:</strong> {po.remarks}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Created by: {po.creator_name?.toUpperCase()}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-corp" style={{ color: 'var(--success)', border: '1px solid #10b981', background: '#f0fdf4' }} onClick={() => {
                      setSelectedPo(po);
                      setActionType('approve');
                      setCommentInput('Approved and authorized for Accountant processing.');
                    }}>
                      ✓ Approve PO
                    </button>

                    <button className="btn-corp" style={{ color: '#ef4444', border: '1px solid #fecaca', background: '#fef2f2' }} onClick={() => {
                      setSelectedPo(po);
                      setActionType('reject');
                      setCommentInput('');
                    }}>
                      × Reject PO
                    </button>

                    <button className="btn-corp" style={{ color: '#2563eb', border: '1px solid #bfdbfe', background: '#eff6ff' }} onClick={() => {
                      setSelectedPo(po);
                      setActionType('return');
                      setCommentInput('');
                    }}>
                      🔄 Return for edit
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Interactive modal for comment input */}
      {selectedPo && actionType && (
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
          <div className="card-clean fade-up" style={{ width: '100%', maxWidth: '500px', padding: '32px', borderTop: `4px solid ${actionType === 'approve' ? '#10b981' : (actionType === 'reject' ? '#ef4444' : '#3b82f6')}` }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, textTransform: 'capitalize' }}>
              Confirm {actionType} action on {selectedPo.po_number}
            </h3>
            
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: '20px' }}>
              {actionType === 'approve' && 'Approving this PO will lock Columns A-J from PM edits and unlock the PO in the Accountant processing queue.'}
              {actionType === 'reject' && 'Rejecting this PO terminates the operational workflow completely.'}
              {actionType === 'return' && 'Returning this PO allows the PM to modify Columns A-J and resubmit for approval.'}
            </p>

            <div className="form-group-lux" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>
                {actionType === 'approve' ? 'Comments (Optional)' : `Required Reason for ${actionType} *`}
              </label>
              <textarea rows={4} required={actionType !== 'approve'} placeholder="Type reason or notes..." value={commentInput} onChange={e => setCommentInput(e.target.value)} style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                fontWeight: 500,
                outline: 'none',
                resize: 'none'
              }} />
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-corp" disabled={actionLoading} onClick={() => {
                setSelectedPo(null);
                setActionType(null);
              }}>Cancel</button>
              
              <button className="btn-corp btn-primary-corp" disabled={actionLoading} onClick={triggerAction} style={{
                background: actionType === 'approve' ? '#10b981' : (actionType === 'reject' ? '#ef4444' : '#3b82f6'),
                color: 'white',
                fontWeight: 700
              }}>
                {actionLoading ? 'Saving...' : `Confirm ${actionType}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
