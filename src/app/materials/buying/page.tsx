'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from './page.module.css';

export default function MaterialBuyingPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Purchase Form
  const [form, setForm] = useState({
    invoice_no: '', purchase_date: new Date().toISOString().split('T')[0],
    material_id: '', supplier_id: '', quantity: '', rate: '', remarks: ''
  });

  // Supplier Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ supplier_name: '', contact_person: '', contact_number: '', gstin: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      let url = '/api/materials/buying?';
      if (filterSupplier !== 'all') url += `supplier_id=${filterSupplier}&`;
      if (filterFrom) url += `from=${filterFrom}&`;
      if (filterTo) url += `to=${filterTo}&`;

      const res = await fetch(url);
      const data = await res.json();
      setPurchases(data.purchases || []);
      setMaterials(data.materials || []);
      setSuppliers(data.suppliers || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [filterSupplier, filterFrom, filterTo]);

  const computedTotal = useMemo(() => {
    const q = parseFloat(form.quantity) || 0;
    const r = parseFloat(form.rate) || 0;
    return Math.round(q * r * 100) / 100;
  }, [form.quantity, form.rate]);

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/materials/buying', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purchase', ...form })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setForm({ invoice_no: '', purchase_date: new Date().toISOString().split('T')[0], material_id: '', supplier_id: '', quantity: '', rate: '', remarks: '' });
        loadData();
      }
    } catch {
      alert('Failed to save purchase.');
    }
    setSaving(false);
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/materials/buying', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_supplier', ...supplierForm })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        setShowSupplierModal(false);
        setSupplierForm({ supplier_name: '', contact_person: '', contact_number: '', gstin: '' });
        loadData();
      }
    } catch {
      alert('Failed to add supplier.');
    }
  };

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const grandTotal = useMemo(() => purchases.reduce((s, p) => s + p.total_amount, 0), [purchases]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Material Procurement Console</h1>
          <p>Transaction-safe purchasing with automatic inventory updates.</p>
        </div>
        <div className={styles.controls}>
          <select className={styles.filterField} value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
            <option value="all">All Suppliers</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
          </select>
          <input type="date" className={styles.filterField} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From Date" />
          <input type="date" className={styles.filterField} value={filterTo} onChange={e => setFilterTo(e.target.value)} title="To Date" />
        </div>
      </div>

      {/* Purchase Entry Form */}
      <div className={styles.entryCard}>
        <h2>New Purchase Entry</h2>
        <form onSubmit={handlePurchase}>
          <div className={styles.formGrid}>
            <input type="date" required className={styles.filterField} value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} />
            <input placeholder="Invoice No (Optional)" className={styles.filterField} value={form.invoice_no} onChange={e => setForm({...form, invoice_no: e.target.value})} />
            
            <select required className={styles.filterField} value={form.material_id} onChange={e => setForm({...form, material_id: e.target.value})}>
              <option value="">-- Select Material --</option>
              {materials.map(m => (
                <option key={m.id} value={m.id}>
                  {m.material_name}{m.colour ? ` (${m.colour})` : ''} [{m.category_name}]
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select required className={styles.filterField} style={{ flex: 1 }} value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})}>
                <option value="">-- Supplier --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
              </select>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowSupplierModal(true)} style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>+ New</button>
            </div>

            <input type="number" step="0.01" required placeholder="Quantity" className={styles.filterField} value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
            <input type="number" step="0.01" required placeholder="Rate (₹/unit)" className={styles.filterField} value={form.rate} onChange={e => setForm({...form, rate: e.target.value})} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px', fontFamily: 'ui-monospace, monospace', color: computedTotal > 0 ? '#166534' : 'var(--text-ghost)' }}>
                Total: {fmt(computedTotal)}
              </div>
            </div>

            <input placeholder="Remarks" className={styles.filterField} value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '12px' }}>
            <button type="submit" className={styles.actionBtn} disabled={saving}>
              {saving ? '⏳ Processing...' : '⚡ Save Purchase & Update Stock'}
            </button>
          </div>
        </form>
      </div>

      {/* Purchase History Table */}
      <div className={styles.historyTable}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>
            Purchase History ({purchases.length} records)
          </h3>
          <div style={{ fontFamily: 'ui-monospace', fontWeight: 800, color: '#166534' }}>Grand Total: {fmt(grandTotal)}</div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice</th>
              <th>Material</th>
              <th>Category</th>
              <th>Supplier</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>Loading purchase history...</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-ghost)' }}>No purchases recorded yet.</td></tr>
            ) : purchases.map(p => (
              <tr key={p.id}>
                <td>{p.purchase_date}</td>
                <td style={{ color: p.invoice_no ? 'var(--text-main)' : 'var(--text-ghost)' }}>{p.invoice_no || '-'}</td>
                <td><strong>{p.material_name}</strong>{p.colour ? <span style={{ color: 'var(--text-ghost)', fontSize: '11px', marginLeft: '6px' }}>({p.colour})</span> : null}</td>
                <td><span className={styles.catChip}>{p.category_name}</span></td>
                <td>{p.supplier_name}</td>
                <td style={{ fontFamily: 'ui-monospace', fontWeight: 700 }}>{p.quantity} <span style={{ fontSize: '10px', color: 'var(--text-ghost)' }}>{p.unit_abbr}</span></td>
                <td style={{ fontFamily: 'ui-monospace' }}>{fmt(p.rate)}</td>
                <td className={styles.totalCell}>{fmt(p.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className={styles.supplierModal}>
          <div className={styles.supplierModalContent}>
            <h2 style={{ margin: '0 0 20px' }}>Register New Supplier</h2>
            <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input required placeholder="Supplier Name" className={styles.filterField} value={supplierForm.supplier_name} onChange={e => setSupplierForm({...supplierForm, supplier_name: e.target.value})} />
              <input placeholder="Contact Person" className={styles.filterField} value={supplierForm.contact_person} onChange={e => setSupplierForm({...supplierForm, contact_person: e.target.value})} />
              <input placeholder="Contact Number" className={styles.filterField} value={supplierForm.contact_number} onChange={e => setSupplierForm({...supplierForm, contact_number: e.target.value})} />
              <input placeholder="GSTIN" className={styles.filterField} value={supplierForm.gstin} onChange={e => setSupplierForm({...supplierForm, gstin: e.target.value})} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowSupplierModal(false)}>Cancel</button>
                <button type="submit" className={styles.actionBtn}>Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
