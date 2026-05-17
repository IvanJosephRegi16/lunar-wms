'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function CreatePOFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // PO Header Details
  const [vendor, setVendor] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState('');

  // Spreadsheet Dynamic Rows
  const [items, setItems] = useState<any[]>([
    { material_code: '', material_name: '', size_thickness: '', order_rate: 0, current_stock: 0, current_stock_unit: '', custom_current_stock_unit: '', required_qty: 0, unit: '', custom_unit: '', remarks: '', vendor: '' }
  ]);

  // Fetch session and prefill edit details if applicable
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        // Verify User Auth
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();
        if (meData.error || (meData.user.role !== 'pm' && meData.user.role !== 'admin')) {
          setError('Unauthorized Access: Only Purchase Managers or System Administrators can create/edit POs.');
          setLoading(false);
          return;
        }
        setUser(meData.user);

        // Auto-generate default PO number based on today's IST date
        const nowIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' });
        const todayIST = nowIST.split(',')[0].trim(); // YYYY-MM-DD
        const dateParts = todayIST.replace(/-/g, '');
        const yy = dateParts.slice(2, 4);
        const mm = dateParts.slice(4, 6);
        const dd = dateParts.slice(6, 8);
        setPoDate(todayIST);
        if (!editId) {
          // Generate suggested PO number (user can override)
          setPoNumber(`PO-${yy}${mm}${dd}-`);
        }

        if (editId) {
          const res = await fetch(`/api/po/${editId}`);
          const data = await res.json();
          if (data.error) {
            setError(data.error);
            return;
          }
          const po = data.po;
          
          // Enforce locking rules on approved states
          if (po.status !== 'draft' && po.status !== 'returned_for_edit' && meData.user.role !== 'admin') {
            setError(`This PO has moved to the '${po.status}' stage and is completely locked from further PM edits.`);
            setLoading(false);
            return;
          }

          setPoNumber(po.po_number || '');
          setPoDate(po.po_date || todayIST);
          setVendor(po.vendor || '');
          setDiscountPercent(po.discount_percent || 0);
          setRemarks(po.remarks || '');
          if (po.status === 'returned_for_edit') {
            setCorrectionNotes(po.correction_notes || '');
          }

          if (Array.isArray(po.items) && po.items.length > 0) {
            setItems(po.items.map((it: any) => {
              const isPredefined = ['Pair', 'piece', 'Meter'].includes(it.unit);
              const isCsuPredefined = ['Pair', 'piece', 'Meter'].includes(it.current_stock_unit);
              return {
                material_code: it.material_code || '',
                material_name: it.material_name || '',
                size_thickness: it.size_thickness || '',
                order_rate: Number(it.order_rate) || 0,
                current_stock: Number(it.current_stock) || 0,
                current_stock_unit: isCsuPredefined ? it.current_stock_unit : (it.current_stock_unit ? 'Custom' : ''),
                custom_current_stock_unit: isCsuPredefined ? '' : (it.current_stock_unit || ''),
                required_qty: Number(it.required_qty) || 0,
                unit: isPredefined ? it.unit : (it.unit ? 'Custom' : ''),
                custom_unit: isPredefined ? '' : (it.unit || ''),
                remarks: it.remarks || '',
                vendor: it.vendor || ''
              };
            }));
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error initializing creator workspace');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [editId]);

  // Dynamic Row Actions
  const addRow = () => {
    setItems([
      ...items,
      { material_code: '', material_name: '', size_thickness: '', order_rate: 0, current_stock: 0, current_stock_unit: '', custom_current_stock_unit: '', required_qty: 0, unit: '', custom_unit: '', remarks: '', vendor: '' }
    ]);
  };

  const removeRow = (index: number) => {
    if (items.length <= 1) return;
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const clearTable = () => {
    setItems([
      { material_code: '', material_name: '', size_thickness: '', order_rate: 0, current_stock: 0, current_stock_unit: '', custom_current_stock_unit: '', required_qty: 0, unit: '', custom_unit: '', remarks: '', vendor: '' }
    ]);
  };

  const handleItemChange = (index: number, key: string, val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [key]: val };
    setItems(updated);
  };

  // Live spreadsheet formulas calculations
  const grossAmount = items.reduce((sum, item) => {
    const rate = Number(item.order_rate) || 0;
    const qty = Number(item.required_qty) || 0;
    return sum + (rate * qty);
  }, 0);

  const discountVal = Math.min(Math.max(Number(discountPercent) || 0, 0), 100);
  const netAmount = grossAmount * (1 - discountVal / 100);

  const handleAction = async (status: 'draft' | 'pending_admin_approval') => {
    setError('');
    setSuccess('');

    if (!vendor) {
      setError('Please specify a Vendor for this procurement order.');
      return;
    }

    // Verify row level items
    for (const [idx, item] of items.entries()) {
      if (!item.material_code || !item.material_name || !item.size_thickness) {
        setError(`Row #${idx + 1} has incomplete material fields. Material Code, Name, and Size/Thickness are required.`);
        return;
      }
      if (Number(item.order_rate) <= 0 || Number(item.required_qty) <= 0) {
        setError(`Row #${idx + 1} must have a positive Order Rate and Required Quantity.`);
        return;
      }
      const unitValue = item.unit === 'Custom' ? item.custom_unit : item.unit;
      if (!unitValue || !unitValue.trim()) {
        setError(`Row #${idx + 1} requires a unit selection or custom input.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const url = editId ? `/api/po/${editId}` : '/api/po';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          po_number: poNumber.trim(),
          po_date: poDate,
          vendor,
          discount_percent: discountVal,
          remarks,
          status,
          items: items.map(it => ({
            ...it,
            unit: it.unit === 'Custom' ? it.custom_unit : it.unit,
            current_stock_unit: it.current_stock_unit === 'Custom' ? it.custom_current_stock_unit : it.current_stock_unit
          }))
        })
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }

      if (status === 'pending_admin_approval') {
        setShowSuccessPopup(true);
      } else {
        setSuccess('Procurement PO Draft saved successfully!');
        setTimeout(() => {
          router.push('/po');
          router.refresh();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit PO');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Prefilling Material Procurement Workspace...</span>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="card-clean" style={{ borderLeft: '4px solid var(--danger)', padding: '24px', margin: '20px auto', maxWidth: '600px' }}>
        <h3 style={{ color: 'var(--danger)', fontWeight: 800 }}>Authorization Notice</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>{error}</p>
        <Link href="/po" className="btn-corp" style={{ display: 'inline-block', marginTop: '16px', textDecoration: 'none' }}>Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Back Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', background: '#e2e8f0', color: 'var(--text-ghost)', padding: '6px 12px', borderRadius: '8px', fontWeight: 700 }}>
          Logged Role: {user?.role?.toUpperCase()}
        </span>
      </div>

      {correctionNotes && (
        <div className="card-clean fade-up" style={{ borderLeft: '4px solid #3b82f6', background: '#eff6ff', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d4ed8', fontWeight: 800, fontSize: '15px' }}>
            <span>🔄 Returned by Admin for Correction</span>
          </div>
          <p style={{ color: '#1e40af', fontSize: '13px', lineHeight: '1.5', fontWeight: 600 }}>
            <strong>Admin Suggestion/Remarks:</strong> {correctionNotes}
          </p>
          <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 500 }}>
            * Note: You can modify the spreadsheet fields below. Submitting will send the updated PO back to the Admin queue for review.
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', borderLeft: '4px solid var(--danger)', padding: '16px 20px', borderRadius: '8px', color: '#b91c1c', fontSize: '14px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: '#f0fdf4', borderLeft: '4px solid var(--success)', padding: '16px 20px', borderRadius: '8px', color: '#15803d', fontSize: '14px', fontWeight: 600 }}>
          {success}
        </div>
      )}

      {/* Main Form Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Header Metadata Card */}
        <div className="card-clean" style={{ borderTop: '4px solid var(--primary)', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '20px' }}>
            {editId ? '🛠️ Modify Procurement Purchase Order' : '📝 Create Procurement Purchase Order'}
          </h3>
          
          {/* Row 1: PO No + PO Date + Vendor */}
          <div className="grid grid-3" style={{ gap: '20px', marginBottom: '20px' }}>
            <div className="form-group-lux">
              <label>PO Number * <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '10px', textTransform: 'none' }}>(Unique Reference)</span></label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. PO-260517-0001"
                  required
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  style={{ paddingRight: '36px' }}
                />
                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>🔑</span>
              </div>
            </div>

            <div className="form-group-lux">
              <label>PO Date * <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '10px', textTransform: 'none' }}>(Click to set today)</span></label>
              <input
                type="date"
                required
                value={poDate}
                onClick={e => {
                  // Auto-fill today if empty, then open calendar
                  if (!poDate) {
                    const todayIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0].trim();
                    setPoDate(todayIST);
                  }
                  (e.target as HTMLInputElement).showPicker?.();
                }}
                onChange={e => setPoDate(e.target.value)}
                style={{ cursor: 'pointer' }}
              />
            </div>

            <div className="form-group-lux">
              <label>Vendor / Supplier *</label>
              <input type="text" placeholder="e.g. Standard Polymer Ltd." required value={vendor} onChange={e => setVendor(e.target.value)} />
            </div>
          </div>

          {/* Row 2: Remarks */}
          <div className="form-group-lux">
            <label>Global Remarks / internal notes</label>
            <input type="text" placeholder="Specify order delivery terms, shipping schedules, or priority notices..." value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>
        </div>

        {/* Dynamic Spreadsheet Procurement Grid Table */}
        <div className="card-clean" style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Spreadsheet Procurement Dynamic Entry Grid</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Enter required material specifications, quantities, and operational rates.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-corp" onClick={clearTable} style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                🧹 Clear Table
              </button>
              <button className="btn-corp btn-primary-corp" onClick={addRow} style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--primary)', color: 'white' }}>
                ➕ Add Material Row
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-ghost)', fontWeight: 800, width: '40px' }}>#</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '130px' }}>Material Code *</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '160px' }}>Material Name *</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '100px' }}>Size / Thickness *</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '160px' }}>Current Stock & Unit</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '160px' }}>Required Qty & Unit *</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '100px' }}>Order Rate (₹) *</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '110px' }}>Amount (₹)</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '140px' }}>Vendor</th>
                  <th style={{ padding: '12px 12px', color: 'var(--text-ghost)', fontWeight: 800, minWidth: '150px' }}>Remarks</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-ghost)', fontWeight: 800, width: '50px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const itemAmount = (Number(item.order_rate) || 0) * (Number(item.required_qty) || 0);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-ghost)', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '8px' }}>
                        <input type="text" placeholder="e.g. PU-CHEM-01" required value={item.material_code} onChange={e => handleItemChange(idx, 'material_code', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="text" placeholder="e.g. Polyurethane Resin A" required value={item.material_name} onChange={e => handleItemChange(idx, 'material_name', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="text" placeholder="e.g. 5mm" required value={item.size_thickness} onChange={e => handleItemChange(idx, 'size_thickness', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Current Stock unit selector */}
                          <select
                            value={item.current_stock_unit || ''}
                            onChange={e => {
                              const v = e.target.value;
                              handleItemChange(idx, 'current_stock_unit', v);
                              if (!v) handleItemChange(idx, 'current_stock', 0);
                            }}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: '#f8fafc', color: 'var(--text-main)' }}
                          >
                            <option value="">-- Choose Unit --</option>
                            <option value="Pair">Pair</option>
                            <option value="piece">Piece</option>
                            <option value="Meter">Meter</option>
                            <option value="Custom">Custom</option>
                          </select>

                          {item.current_stock_unit === 'Custom' && (
                            <input
                              type="text"
                              placeholder="Write Custom Unit..."
                              value={item.custom_current_stock_unit || ''}
                              onChange={e => handleItemChange(idx, 'custom_current_stock_unit', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}
                            />
                          )}

                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={!item.current_stock_unit}
                            placeholder={!item.current_stock_unit ? 'Select unit first' : `Stock (${item.current_stock_unit === 'Custom' ? (item.custom_current_stock_unit || 'Custom') : item.current_stock_unit})`}
                            value={item.current_stock || ''}
                            onChange={e => handleItemChange(idx, 'current_stock', Math.max(parseFloat(e.target.value) || 0, 0))}
                            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, background: !item.current_stock_unit ? '#f1f5f9' : 'white', cursor: !item.current_stock_unit ? 'not-allowed' : 'auto' }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <select
                            value={item.unit || ''}
                            onChange={e => {
                              const newUnit = e.target.value;
                              handleItemChange(idx, 'unit', newUnit);
                              if (!newUnit) {
                                handleItemChange(idx, 'required_qty', 0);
                              }
                            }}
                            style={{ 
                              width: '100%', 
                              padding: '6px 8px', 
                              border: '1px solid var(--border)', 
                              borderRadius: '6px', 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              background: '#f8fafc',
                              color: 'var(--text-main)'
                            }}
                          >
                            <option value="">-- Choose Unit --</option>
                            <option value="Pair">Pair</option>
                            <option value="piece">Piece</option>
                            <option value="Meter">Meter</option>
                            <option value="Custom">Custom</option>
                          </select>

                          {item.unit === 'Custom' && (
                            <input 
                              type="text"
                              placeholder="Write Custom Unit..."
                              required
                              value={item.custom_unit || ''}
                              onChange={e => handleItemChange(idx, 'custom_unit', e.target.value)}
                              style={{ 
                                width: '100%', 
                                padding: '6px 8px', 
                                border: '1px solid var(--border)', 
                                borderRadius: '6px', 
                                fontSize: '11px', 
                                fontWeight: 600 
                              }}
                            />
                          )}

                          <input 
                            type="number" 
                            min="0.01" 
                            step="any" 
                            required 
                            disabled={!item.unit}
                            placeholder={!item.unit ? "Select unit first" : `Qty (${item.unit === 'Custom' ? (item.custom_unit || 'Custom') : item.unit})`}
                            value={item.required_qty || ''} 
                            onChange={e => handleItemChange(idx, 'required_qty', Math.max(parseFloat(e.target.value) || 0, 0))} 
                            style={{ 
                              width: '100%', 
                              padding: '8px 10px', 
                              border: '1px solid var(--border)', 
                              borderRadius: '6px', 
                              fontSize: '13px', 
                              fontWeight: 600, 
                              background: !item.unit ? '#f1f5f9' : '#fffbeb',
                              cursor: !item.unit ? 'not-allowed' : 'auto'
                            }} 
                          />
                        </div>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="number" min="0.01" step="any" required value={item.order_rate || ''} onChange={e => handleItemChange(idx, 'order_rate', Math.max(parseFloat(e.target.value) || 0, 0))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, background: '#fffbeb' }} />
                      </td>
                      <td style={{ padding: '12px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary)' }}>
                        ₹{itemAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="text" placeholder="Row Vendor (Optional)" value={item.vendor} onChange={e => handleItemChange(idx, 'vendor', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="text" placeholder="Note specifications..." value={item.remarks} onChange={e => handleItemChange(idx, 'remarks', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 500 }} />
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <button disabled={items.length <= 1} onClick={() => removeRow(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: items.length > 1 ? 'pointer' : 'not-allowed', fontSize: '16px', opacity: items.length > 1 ? 1 : 0.4 }}>
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Formula Panel */}
        <div className="grid grid-3" style={{ gap: '32px' }}>
          
          <div style={{ gridColumn: 'span 2' }} />

          {/* live calculations box */}
          <div className="card-clean" style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderLeft: '4px solid var(--primary)' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800 }}>Spreadsheet Procurement Formula Ledger</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Real-time dynamic calculations on Raw Materials.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Gross Total (Rate × Qty)</span>
                <span style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'monospace' }}>₹{grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Global Discount %</span>
                <input type="number" min="0" max="100" value={discountPercent || ''} onChange={e => setDiscountPercent(Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 100))} style={{ width: '70px', padding: '4px 8px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Net Procurement Total</span>
                <span style={{ fontSize: '17px', fontWeight: 900, fontFamily: 'monospace', color: 'var(--primary)' }}>₹{netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn-corp btn-primary-corp" disabled={submitting} onClick={() => handleAction('pending_admin_approval')} style={{ background: 'var(--primary)', color: 'white', fontWeight: 700, width: '100%' }}>
                {submitting ? 'Processing...' : 'Submit for Admin Review'}
              </button>
              
              <button className="btn-corp" disabled={submitting} onClick={() => handleAction('draft')} style={{ width: '100%' }}>
                Save Draft PO
              </button>
            </div>
          </div>

        </div>

      </div>

      {showSuccessPopup && (
        <div style={{
          position: 'fixed',
          top: '0', left: '0', right: '0', bottom: '0',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
        }}>
          <div className="card-clean fade-up" style={{
            width: '100%',
            maxWidth: '460px',
            padding: '36px',
            textAlign: 'center',
            borderTop: '5px solid #eab308',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#fef9c3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              boxShadow: '0 4px 10px rgba(234, 179, 8, 0.2)',
              animation: 'pulse-slow 2s infinite'
            }}>
              ⏳
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)' }}>
                Sent to Admin Successfully
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.5 }}>
                Wait for Approval....
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 18px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-ghost)', fontWeight: 700 }}>
              PO Number: {poNumber}
            </div>

            <button
              onClick={() => {
                router.push('/po');
                router.refresh();
              }}
              className="btn-corp btn-primary-corp"
              style={{
                width: '100%',
                background: '#eab308',
                borderColor: '#eab308',
                color: 'black',
                fontWeight: 800,
                fontSize: '14px',
                padding: '12px',
                marginTop: '10px'
              }}
            >
              Okay, Go to Dashboard
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .form-group-lux { display: flex; flex-direction: column; gap: 8px; }
        .form-group-lux label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .form-group-lux input { background: #f8fafc; border: 1px solid var(--border); padding: 10px 14px; border-radius: 8px; font-size: 14px; font-family: inherit; font-weight: 500; outline: none; transition: border-color 0.2s; }
        .form-group-lux input:focus { border-color: var(--primary); background: white; }
        .table-row-hover:hover { background: #f8fafc; }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

export default function CreatePO() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '16px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 600, fontSize: '13px' }}>Loading Workspace...</span>
      </div>
    }>
      <CreatePOFormContent />
    </Suspense>
  );
}
