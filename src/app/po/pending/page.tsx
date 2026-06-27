'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPOQueue() {
  const [user, setUser] = useState<any>(null);
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showApproveSuccess, setShowApproveSuccess] = useState<any>(null);
  const [showReturnSuccess, setShowReturnSuccess] = useState<any>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (meData.error) { setError('Access Denied: Please log in.'); setLoading(false); return; }
      const isAllowed = meData.user.role === 'admin' || meData.user.role === 'pm' || meData.menuVisibility?.po_pending !== false;
      if (!isAllowed) { setError('Access Denied: Insufficient role authorization.'); setLoading(false); return; }
      setUser(meData.user);
      const poRes = await fetch('/api/po');
      const poData = await poRes.json();
      if (meData.user.role === 'pm') {
        setPos((poData.pos || []).filter((p: any) => p.status === 'pending_pm_approval'));
      } else {
        setPos((poData.pos || []).filter((p: any) => p.status === 'pending_admin_approval'));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pending queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const triggerAction = async () => {
    if (!selectedPo || !actionType) return;
    if ((actionType === 'reject' || actionType === 'return') && !commentInput.trim()) {
      alert(`Please provide a reason for this ${actionType} action.`);
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
      if (data.error) { alert(data.error); return; }

      const snapshot = { ...selectedPo };
      setSelectedPo(null);
      setActionType(null);
      setCommentInput('');

      if (actionType === 'approve') {
        setShowApproveSuccess(snapshot);
        setTimeout(() => { setShowApproveSuccess(null); loadData(); }, 4000);
      } else if (actionType === 'return') {
        setShowReturnSuccess({ po: snapshot, notes: commentInput });
        setTimeout(() => { setShowReturnSuccess(null); loadData(); }, 5000);
      } else {
        loadData();
      }
    } catch (err: any) {
      alert(err.message || 'Error processing request');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
      <div className="loading-dot" />
      <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>{user?.role === 'pm' ? 'Scanning PM Pre-Approval Queue...' : 'Scanning Admin Pending Queue...'}</span>
    </div>
  );

  if (error) return (
    <div className="card-clean" style={{ borderLeft: '4px solid var(--danger)', padding: '24px', margin: '20px auto', maxWidth: '600px' }}>
      <h3 style={{ color: 'var(--danger)', fontWeight: 800 }}>Authorization Notice</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>{error}</p>
      <Link href="/po" className="btn-corp" style={{ display: 'inline-block', marginTop: '16px', textDecoration: 'none' }}>Return to Dashboard</Link>
    </div>
  );

  const infoField = (label: string, value: string) => (
    <div style={{ flex: '1 1 130px' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 750, marginTop: '3px' }}>{value}</div>
    </div>
  );

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>{user?.role === 'pm' ? 'PM Pre-Approval Queue' : 'Admin Pending Approval Queue'}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {user?.role === 'pm' ? 'Review and pre-approve purchase orders to forward them to the Admin.' : 'Review, authorize, reject, or return submitted purchase orders to the PM stage.'}
          </p>
        </div>
        <span style={{ fontSize: '12px', background: '#fffbeb', color: '#b45309', padding: '6px 12px', borderRadius: '8px', fontWeight: 700, border: '1px solid #fde68a' }}>{pos.length} Pending</span>
      </div>

      {pos.length === 0 ? (
        <div className="card-clean" style={{ textAlign: 'center', padding: '64px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '48px' }}>🎉</span>
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Queue Completely Clear</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '400px' }}>No pending purchase orders requiring authorization at this time.</p>
          <Link href="/po" className="btn-corp btn-primary-corp" style={{ textDecoration: 'none' }}>Go to Dashboard</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {pos.map(po => {
            const itemCount = Array.isArray(po.items) ? po.items.length : 0;
            return (
              <div key={po.id} className="card-clean" style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', overflow: 'hidden', borderTop: '3px solid #f59e0b' }}>

                <div style={{ position: 'absolute', right: 0, top: 0, background: '#fffbeb', color: '#b45309', padding: '6px 14px', borderBottomLeftRadius: '10px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⏳ Pending Review</div>

                {/* PO Meta */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                  {infoField('PO Number', po.po_number)}
                  {infoField('PO Date', po.po_date || po.created_at?.split('T')[0] || '—')}
                  {infoField('Vendor', po.vendor || '—')}
                  {infoField('Items', `${itemCount} line${itemCount !== 1 ? 's' : ''}`)}
                  {infoField('Created By', po.creator_name || '—')}
                </div>

                {/* PM Remarks */}
                {po.remarks && (
                  <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '12px 16px', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ fontWeight: 800, color: '#d97706', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>📋 PM Remarks</div>
                    <div style={{ color: '#92400e', lineHeight: 1.6, fontWeight: 600 }}>{po.remarks}</div>
                  </div>
                )}

                {/* Full Materials Table */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>
                        {['#','Category','Material Code','Material Name','Size / Thk','Current Stock','Req Qty','Unit','Rate (₹)','Amount (₹)','Remarks'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', color: 'white', fontWeight: 800, fontSize: '11px', whiteSpace: 'nowrap', textAlign: ['Req Qty','Current Stock','Rate (₹)','Amount (₹)','#'].includes(h) ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {itemCount === 0 ? (
                        <tr><td colSpan={11} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-ghost)' }}>No items attached</td></tr>
                      ) : (
                        po.items.map((item: any, i: number) => (
                          <tr key={i} style={{ borderBottom: i !== itemCount - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-ghost)', fontWeight: 700 }}>{i + 1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.category || '—'}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{item.material_code || '—'}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.material_name || '—'}</td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{item.size_thickness || '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{(item.current_stock ?? 0).toLocaleString()} {item.current_stock_unit || ''}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{(item.required_qty ?? 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-ghost)', whiteSpace: 'nowrap' }}>{item.unit || '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>₹{Number(item.order_rate || 0).toFixed(2)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#16a34a', whiteSpace: 'nowrap' }}>₹{Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)', minWidth: '120px' }}>{item.remarks || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals bar */}
                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: '14px 20px', borderRadius: '10px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Gross Amount</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>₹{(po.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Discount</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444', fontFamily: 'monospace' }}>-{po.discount_percent || 0}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Net Amount</div>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary)', fontFamily: 'monospace' }}>₹{(po.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '18px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {user?.role === 'pm' && (
                    <Link href={`/po/create?id=${po.id}`} className="btn-corp" style={{ textDecoration: 'none', color: '#0f172a', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                      ✏️ Edit PO Details
                    </Link>
                  )}
                  <button className="btn-corp" style={{ color: '#16a34a', border: '1px solid #86efac', background: '#f0fdf4', fontWeight: 700 }}
                    onClick={() => { setSelectedPo(po); setActionType('approve'); setCommentInput(user?.role === 'pm' ? 'Pre-approved and sent to Admin.' : 'Approved and authorized for Accountant processing.'); }}>
                    {user?.role === 'pm' ? '✓ Approve & Send to Admin' : '✓ Approve PO'}
                  </button>
                  <button className="btn-corp" style={{ color: '#ef4444', border: '1px solid #fecaca', background: '#fef2f2', fontWeight: 700 }}
                    onClick={() => { setSelectedPo(po); setActionType('reject'); setCommentInput(''); }}>
                    ✕ Reject PO
                  </button>
                  <button className="btn-corp" style={{ color: '#2563eb', border: '1px solid #bfdbfe', background: '#eff6ff', fontWeight: 700 }}
                    onClick={() => { setSelectedPo(po); setActionType('return'); setCommentInput(''); }}>
                    🔄 Return for Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ACTION CONFIRMATION MODAL ── */}
      {selectedPo && actionType && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card-clean fade-up" style={{ width: '100%', maxWidth: '500px', padding: '36px', borderTop: `4px solid ${actionType === 'approve' ? '#10b981' : actionType === 'reject' ? '#ef4444' : '#3b82f6'}` }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>{actionType === 'approve' ? '✅' : actionType === 'reject' ? '❌' : '🔄'}</div>
            <h3 style={{ fontSize: '18px', fontWeight: 900, textTransform: 'capitalize', marginBottom: '6px' }}>Confirm {actionType} — {selectedPo.po_number}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
              {actionType === 'approve' && (user?.role === 'pm' ? 'Approving this PO will move it to the Admin processing queue.' : 'Approving this PO will move it to the Accountant processing queue. This action notifies the PM and all Accountants.')}
              {actionType === 'reject' && 'Rejecting this PO permanently terminates the workflow. The PM will be notified with your reason.'}
              {actionType === 'return' && (user?.role === 'pm' ? 'Returning this PO sends it back to the creator for corrections.' : 'Returning this PO sends it back to the PM for corrections. Your notes below will be highlighted to the PM as a mandatory correction notice.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>
                {actionType === 'approve' ? 'Comments (Optional)' : `Reason for ${actionType} *`}
              </label>
              <textarea rows={4} placeholder={actionType === 'return' ? 'Write clear correction instructions...' : 'Type reason or notes...'} value={commentInput} onChange={e => setCommentInput(e.target.value)} style={{ background: '#f8fafc', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', fontWeight: 500, outline: 'none', resize: 'none', width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-corp" disabled={actionLoading} onClick={() => { setSelectedPo(null); setActionType(null); }}>Cancel</button>
              <button className="btn-corp btn-primary-corp" disabled={actionLoading} onClick={triggerAction} style={{ background: actionType === 'approve' ? '#10b981' : actionType === 'reject' ? '#ef4444' : '#3b82f6', color: 'white', fontWeight: 800, border: 'none' }}>
                {actionLoading ? 'Processing...' : `Confirm ${actionType}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── APPROVE SUCCESS ANIMATED POPUP ── */}
      {showApproveSuccess && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div className="card-clean fade-up" style={{ width: '100%', maxWidth: '460px', padding: '48px 36px', textAlign: 'center', borderTop: '5px solid #10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', boxShadow: '0 30px 60px rgba(16,185,129,0.2)' }}>
            <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '44px', boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }}>✅</div>
            <div>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Purchase Order Approved</div>
              <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-main)', marginBottom: '8px' }}>Thanks for Approving!</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                PO <strong style={{ color: '#10b981' }}>{showApproveSuccess.po_number}</strong> has been {user?.role === 'pm' ? 'pre-approved and sent to Admin' : 'approved and successfully forwarded to Accountant'} for processing.
              </p>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginTop: '8px' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '999px', animation: 'countdown-bar 4s linear forwards' }} />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '-8px' }}>This message will close automatically</p>
          </div>
        </div>
      )}

      {/* ── RETURN SUCCESS ANIMATED POPUP ── */}
      {showReturnSuccess && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div className="card-clean fade-up" style={{ width: '100%', maxWidth: '500px', padding: '40px 36px', borderTop: '5px solid #3b82f6', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', boxShadow: '0 30px 60px rgba(59,130,246,0.2)' }}>
            <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '44px', boxShadow: '0 8px 24px rgba(59,130,246,0.25)' }}>🔄</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>PO Returned for Correction</div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)', marginBottom: '8px' }}>Return Notice Sent</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '16px' }}>
                PO <strong style={{ color: '#3b82f6' }}>{showReturnSuccess.po?.po_number}</strong> has been returned with your correction notes. They will see your message highlighted prominently.
              </p>
              <div style={{ background: 'linear-gradient(135deg, #fff0f0, #fff5f5)', border: '2px solid #fca5a5', borderLeft: '5px solid #ef4444', borderRadius: '10px', padding: '14px 18px', textAlign: 'left' }}>
                <div style={{ fontSize: '10px', color: '#b91c1c', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>⚠️ Your Correction Note</div>
                <div style={{ fontSize: '13px', color: '#7f1d1d', fontWeight: 700, fontStyle: 'italic', lineHeight: 1.6 }}>"{showReturnSuccess.notes}"</div>
              </div>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '999px', animation: 'countdown-bar 5s linear forwards' }} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes countdown-bar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
