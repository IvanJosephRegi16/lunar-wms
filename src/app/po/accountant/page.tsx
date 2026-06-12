'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import EmailModal from '@/components/EmailModal';
import POResetExportPanel from '@/components/POResetExportPanel';

export default function AccountantWorkspace() {
  const [user, setUser] = useState<any>(null);
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    invoice_number: '',
    transport_charge: 0,
    amount_paid: 0,
    shipping_method: '',
    delivery_status: 'pending'
  });
  const [submitting, setSubmitting] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (meData.error || (meData.user.role !== 'accountant' && meData.user.role !== 'admin')) {
        setError('Unauthorized Access: Only Accountants or System Administrators can perform accounting operations.');
        setLoading(false);
        return;
      }
      setUser(meData.user);
      const poRes = await fetch('/api/po');
      const poData = await poRes.json();
      const activePOs = (poData.pos || []).filter((p: any) => p.status === 'accountant_processing');
      setPos(activePOs);
    } catch (err: any) {
      setError(err.message || 'Failed to load accountant workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const startProcessing = (po: any) => {
    setSelectedPo(po);
    const items = (po.items || []).map((it: any) => ({
      ...it,
      required_qty: it.required_qty ?? it.required_quantity ?? 0,
      order_rate: it.order_rate ?? 0,
    }));
    setEditedItems(items);
    setForm({
      invoice_number: po.invoice_number || '',
      transport_charge: po.transport_charge || 0,
      amount_paid: po.amount_paid || 0,
      shipping_method: po.shipping_method || '',
      delivery_status: po.delivery_status || 'pending'
    });
  };

  const handleItemChange = (idx: number, field: string, value: string) => {
    setEditedItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: Number(value) };
      return copy;
    });
  };

  const grossTotal = editedItems.reduce((sum, item) => sum + ((Number(item.required_qty) || 0) * (Number(item.order_rate) || 0)), 0);
  const discountPercent = Number(selectedPo?.discount_percent) || 0;
  const discountValue = grossTotal * (discountPercent / 100);
  const liveNetAmount = grossTotal - discountValue;

  const grandTotal = liveNetAmount + (Number(form.transport_charge) || 0);
  const balanceAmount = grandTotal - (Number(form.amount_paid) || 0);
  let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
  if (balanceAmount <= 0) paymentStatus = 'paid';
  else if ((Number(form.amount_paid) || 0) > 0) paymentStatus = 'partial';

  const handleSave = async (finalize = false) => {
    if (!selectedPo) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/po/accountant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPo.id,
          items: editedItems.map(it => ({ id: it.id, required_qty: it.required_qty, order_rate: it.order_rate })),
          invoice_number: form.invoice_number,
          transport_charge: Number(form.transport_charge) || 0,
          amount_paid: Number(form.amount_paid) || 0,
          shipping_method: form.shipping_method,
          delivery_status: form.delivery_status,
          finalize
        })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setSuccess(finalize ? `PO ${selectedPo.po_number} finalized!` : `PO ${selectedPo.po_number} saved!`);
      setSelectedPo(null);
      setTimeout(() => { setSuccess(''); loadData(); }, 1500);
    } catch (e: any) {
      alert(e.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
      <div className="loading-dot" />
      <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Loading Accountant Workspace...</span>
    </div>
  );

  if (error) return (
    <div>
      <div className="card-clean" style={{ borderLeft: '4px solid var(--danger)', padding: '24px', maxWidth: '600px' }}>
        <h3 style={{ color: 'var(--danger)', fontWeight: 800 }}>Authorization Notice</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>{error}</p>
        <Link href="/po" className="btn-corp" style={{ display: 'inline-block', marginTop: '16px', textDecoration: 'none' }}>← Back to Dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>


      {/* Header */}
      {!selectedPo && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Accountant Processing Workspace</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Review, edit line-item quantities &amp; rates, then finalize the PO lifecycle.
            </p>
          </div>
          <POResetExportPanel
            userRole={user?.role || ''}
            exportFilename={`Accountant_POs_${new Date().toISOString().slice(0,10)}`}
            exportHeaders={['PO Number', 'Vendor', 'Materials Count', 'Net Total (Rs)', 'Payment Status', 'Admin Approved At']}
            exportRows={pos.map((po: any) => [
              po.po_number,
              po.vendor || '',
              (po.items || []).length,
              po.net_amount ?? 0,
              po.payment_status || 'unpaid',
              po.approved_timestamp || ''
            ])}
            onResetComplete={loadData}
          />
        </div>
      )}

      {success && (
        <div style={{ background: '#f0fdf4', borderLeft: '4px solid #10b981', padding: '16px 20px', borderRadius: '8px', color: '#15803d', fontSize: '14px', fontWeight: 600 }}>
          {success}
        </div>
      )}

      {/* ───── LIST VIEW ───── */}
      {!selectedPo && (
        <div className="card-clean" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-corporate">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>Materials</th>
                  <th style={{ textAlign: 'right' }}>Net Total</th>
                  <th>Admin Approved At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-ghost)', fontWeight: 600 }}>No purchase orders pending accountant processing.</td></tr>
                ) : pos.map(po => {
                  const itemCount = Array.isArray(po.items) ? po.items.length : 0;
                  return (
                    <tr key={po.id} className="tr-hover">
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{po.po_number}</td>
                      <td>{po.vendor}</td>
                      <td style={{ fontWeight: 600 }}>{itemCount} line{itemCount !== 1 ? 's' : ''}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>₹{(po.net_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{po.approved_timestamp || '—'}</td>
                      <td>
                        <button className="btn-corp btn-primary-corp" onClick={() => startProcessing(po)} style={{ fontSize: '12px', padding: '6px 14px' }}>
                          ⚡ Process
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───── PROCESSING VIEW ───── */}
      {selectedPo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* PO Summary Banner */}
          <div style={{
            background: 'linear-gradient(135deg,#1e3a5f,#2563eb)',
            borderRadius: '12px', padding: '24px 28px',
            display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Purchase Order</div>
              <div style={{ color: 'white', fontSize: '24px', fontWeight: 900, marginTop: '2px' }}>{selectedPo.po_number}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Vendor</div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: '16px', marginTop: '2px' }}>{selectedPo.vendor}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Admin Approved At</div>
              <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '15px', marginTop: '2px' }}>{selectedPo.approved_timestamp || '—'}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Net Amount</div>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '20px', fontFamily: 'monospace', marginTop: '2px' }}>₹{(selectedPo.net_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          {selectedPo.remarks && (
            <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: '12px', fontSize: '13px' }}>
              <div style={{ fontWeight: 800, color: '#d97706', marginBottom: '4px', textTransform: 'uppercase', fontSize: '11px' }}>🔒 Private Remarks / Instructions</div>
              <div style={{ color: '#92400e', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{selectedPo.remarks}</div>
            </div>
          )}

          {/* Editable Items Table */}
          <div className="card-clean" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px' }}>Material Line Items</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Edit Required Quantity and Rate per line. Totals update automatically.</div>
              </div>
              {/* Send Email Button */}
              <button
                onClick={() => setShowEmailModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'linear-gradient(135deg,#2563eb,#0ea5e9)',
                  color: 'white', border: 'none', borderRadius: '10px',
                  padding: '10px 20px', fontWeight: 800, fontSize: '14px',
                  cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                  transition: 'transform 0.15s, box-shadow 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.35)'; }}
              >
                📧 Send Email
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-corporate" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Category</th>
                    <th>Material Code</th>
                    <th>Material Name</th>
                    <th>Size / Thickness</th>
                    <th style={{ textAlign: 'right' }}>Stock</th>
                    <th style={{ textAlign: 'right' }}>Req. Qty ✏️</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Rate (₹) ✏️</th>
                    <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                    <th>Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {editedItems.map((item, idx) => {
                    const amt = (item.required_qty || 0) * (item.order_rate || 0);
                    return (
                      <tr key={idx} className="tr-hover">
                        <td style={{ color: 'var(--text-ghost)', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600, fontSize: '11px', color: '#7c3aed', background: '#f5f3ff', padding: '4px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>{item.category || '—'}</td>
                        <td style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace', fontSize: '12px' }}>{item.material_code}</td>
                        <td style={{ fontWeight: 600 }}>{item.material_name}</td>
                        <td>{item.size_thickness}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{(item.current_stock ?? 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number" min="0"
                            value={item.required_qty}
                            onChange={e => handleItemChange(idx, 'required_qty', e.target.value)}
                            style={{
                              width: '80px', textAlign: 'right', padding: '6px 8px',
                              border: '2px solid #e5e7eb', borderRadius: '6px',
                              fontSize: '13px', fontFamily: 'monospace', fontWeight: 700,
                              outline: 'none'
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = '#2563eb'}
                            onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                          />
                        </td>
                        <td style={{ color: 'var(--text-ghost)', fontWeight: 600 }}>{item.unit || 'Pair'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number" min="0" step="0.01"
                            value={item.order_rate}
                            onChange={e => handleItemChange(idx, 'order_rate', e.target.value)}
                            style={{
                              width: '90px', textAlign: 'right', padding: '6px 8px',
                              border: '2px solid #e5e7eb', borderRadius: '6px',
                              fontSize: '13px', fontFamily: 'monospace', fontWeight: 700,
                              outline: 'none'
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = '#2563eb'}
                            onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#1e3a5f' }}>
                          ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{item.vendor || selectedPo.vendor}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Fields + Sidebar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>

            {/* Accountant editable fields */}
            <div className="card-clean" style={{ borderTop: '4px solid #10b981', padding: '24px' }}>
              <h3 style={{ fontWeight: 800, fontSize: '16px', marginBottom: '20px' }}>Financial Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { label: 'Invoice / Challan No.', field: 'invoice_number', type: 'text', placeholder: 'INV/2026/001' },
                  { label: 'Transport Charges (₹)', field: 'transport_charge', type: 'number', placeholder: '0' },
                  { label: 'Amount Paid (₹)', field: 'amount_paid', type: 'number', placeholder: '0' },
                  { label: 'Shipping Method', field: 'shipping_method', type: 'text', placeholder: 'Safe Express' },
                ].map(({ label, field, type, placeholder }) => (
                  <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                      {field === 'amount_paid' && (
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, amount_paid: grandTotal }))}
                          style={{
                            background: 'none', border: 'none', color: '#10b981', fontSize: '11px', fontWeight: 800, cursor: 'pointer', padding: '0', textDecoration: 'underline'
                          }}
                        >
                          💳 Pay Full Amount
                        </button>
                      )}
                    </div>
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={(form as any)[field]}
                      onChange={e => setForm({ ...form, [field]: e.target.value })}
                      style={{ padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Status</label>
                  <select
                    value={form.delivery_status}
                    onChange={e => setForm({ ...form, delivery_status: e.target.value })}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: 'white' }}
                  >
                    <option value="pending">⏳ Pending Dispatch</option>
                    <option value="in_transit">🚛 In Transit</option>
                    <option value="delivered">✅ Delivered &amp; Stocked</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Calculation sidebar */}
            <div className="card-clean" style={{ padding: '24px', position: 'sticky', top: '24px' }}>
              <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '20px' }}>📤 Send to Jobin</div>
              {[
                { label: 'Gross Total', value: `₹${grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'var(--text-main)', fontWeight: 700 },
                { label: `Discount (${discountPercent}%)`, value: `-₹${discountValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'var(--danger)', fontWeight: 700, show: discountPercent > 0 },
                { label: 'Net Total', value: `₹${liveNetAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'var(--primary)', fontWeight: 800 },
                { label: 'Transport', value: `₹${(Number(form.transport_charge) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#374151', fontWeight: 700 },
                { label: 'Grand Total', value: `₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#1e3a5f', fontWeight: 900 },
                { label: 'Amount Paid', value: `₹${(Number(form.amount_paid) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#10b981', fontWeight: 700 },
                { label: 'Balance', value: `₹${balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: balanceAmount > 0 ? '#f59e0b' : '#10b981', fontWeight: 900 },
              ].filter(item => item.show !== false).map(({ label, value, color, fontWeight }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: fontWeight || 800, color, fontSize: '14px' }}>{value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Status</span>
                <span style={{
                  fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                  padding: '4px 10px', borderRadius: '12px',
                  background: paymentStatus === 'paid' ? '#d1fae5' : paymentStatus === 'partial' ? '#fef3c7' : '#fee2e2',
                  color: paymentStatus === 'paid' ? '#065f46' : paymentStatus === 'partial' ? '#92400e' : '#991b1b',
                }}>{paymentStatus}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={() => handleSave(true)}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '13px', fontWeight: 800,
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white', border: 'none',
                    borderRadius: '10px', cursor: 'pointer', fontSize: '14px',
                    boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                    transition: 'transform 0.15s, box-shadow 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,58,237,0.45)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(124,58,237,0.35)'; }}
                >
                  {submitting ? '⏳ Sending...' : '📤 Send to Store Keeper'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && selectedPo && (
        <EmailModal
          po={selectedPo}
          items={editedItems}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  );
}
