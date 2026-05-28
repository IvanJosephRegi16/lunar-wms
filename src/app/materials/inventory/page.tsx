'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from './page.module.css';

export default function MaterialsInventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState('all');

  // New Material Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    material_name: '', category_id: '', colour: '', unit_id: '',
    current_stock: '', min_stock_level: '', warning_threshold: ''
  });

  // Movement History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (materialId: number) => {
    setSelectedMaterialId(materialId);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/materials/movements?material_id=${materialId}`);
      const data = await res.json();
      setMovements(data.movements || []);
    } catch {
      setMovements([]);
    }
    setHistoryLoading(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/materials/inventory');
      const data = await res.json();
      setInventory(data.inventory || []);
      setCategories(data.categories || []);
      setUnits(data.units || []);
      setSuppliers(data.suppliers || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const getStockStatus = (current: number, min: number, warn: number) => {
    if (min > 0 && current <= min) return 'Critical';
    if (warn > 0 && current <= warn) return 'Low';
    return 'Normal';
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchSearch = item.material_name.toLowerCase().includes(search.toLowerCase()) || 
                          (item.colour || '').toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === 'all' || item.category_id.toString() === catFilter;
      const status = getStockStatus(item.current_stock, item.min_stock_level, item.warning_threshold);
      const matchAlert = alertFilter === 'all' || 
                         (alertFilter === 'alerts' && status !== 'Normal') || 
                         status.toLowerCase() === alertFilter;
      
      return matchSearch && matchCat && matchAlert;
    });
  }, [inventory, search, catFilter, alertFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/materials/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        setShowModal(false);
        setForm({ material_name: '', category_id: '', colour: '', unit_id: '', current_stock: '', min_stock_level: '', warning_threshold: '' });
        loadData();
      }
    } catch {
      alert('Error creating material');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Raw Material Inventory</h1>
          <p>Factory stock operations and intelligence command center.</p>
        </div>
        <div className={styles.controls}>
          <input 
            type="text" 
            placeholder="Search material or colour..." 
            className={styles.filterField}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className={styles.filterField} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
          </select>
          <select className={styles.filterField} value={alertFilter} onChange={e => setAlertFilter(e.target.value)}>
            <option value="all">All Stock Levels</option>
            <option value="alerts">⚠️ Any Alerts</option>
            <option value="low">Low Stock</option>
            <option value="critical">Critical Stock</option>
          </select>
          <button className={styles.actionBtn} onClick={() => setShowModal(true)}>➕ Add Material</button>
        </div>
      </div>

      <div className={styles.matrixWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Material Details</th>
              <th>Category</th>
              <th>Colour</th>
              <th>Current Stock</th>
              <th>Thresholds (Warn/Min)</th>
              <th>Last Supplier</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center' }}>Loading Inventory...</td></tr>
            ) : filteredInventory.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-ghost)' }}>No materials found.</td></tr>
            ) : filteredInventory.map(item => {
              const status = getStockStatus(item.current_stock, item.min_stock_level, item.warning_threshold);
              const badgeClass = status === 'Critical' ? styles.stockCritical 
                               : status === 'Low' ? styles.stockLow 
                               : styles.stockNormal;
              
              return (
                <tr key={item.id}>
                  <td><strong>{item.material_name}</strong></td>
                  <td><span className={styles.catChip}>{item.category_name}</span></td>
                  <td>{item.colour || '-'}</td>
                  <td>
                    <div className={`${styles.stockBadge} ${badgeClass}`}>
                      {item.current_stock.toLocaleString()} <span className={styles.unitAbbr}>{item.abbreviation}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-ghost)', fontSize: '12px' }}>
                    {item.warning_threshold} / {item.min_stock_level}
                  </td>
                  <td style={{ fontSize: '12px' }}>{item.last_supplier_name || '-'}</td>
                  <td>
                    {status === 'Critical' && <span style={{ color: '#991b1b', fontWeight: 800, fontSize: '12px' }}>⚠️ CRITICAL</span>}
                    {status === 'Low' && <span style={{ color: '#854d0e', fontWeight: 800, fontSize: '12px' }}>⚡ LOW</span>}
                    {status === 'Normal' && <span style={{ color: '#166534', fontWeight: 700, fontSize: '12px' }}>OK</span>}
                  </td>
                  <td>
                    <button 
                      onClick={() => openHistory(item.id)}
                      style={{ background: 'transparent', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-main)' }}
                    >
                      Audit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New Material Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 style={{ margin: '0 0 16px 0' }}>Register New Material</h2>
            <form onSubmit={handleCreate}>
              <div className={styles.modalGrid}>
                <input required placeholder="Material Name" className={styles.filterField} value={form.material_name} onChange={e => setForm({...form, material_name: e.target.value})} />
                <input placeholder="Colour (Optional)" className={styles.filterField} value={form.colour} onChange={e => setForm({...form, colour: e.target.value})} />
                
                <select required className={styles.filterField} value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                  <option value="">-- Select Category --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                </select>

                <select required className={styles.filterField} value={form.unit_id} onChange={e => setForm({...form, unit_id: e.target.value})}>
                  <option value="">-- Select Unit --</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.unit_name} ({u.abbreviation})</option>)}
                </select>

                <input type="number" step="0.01" placeholder="Opening Stock (Qty)" className={styles.filterField} value={form.current_stock} onChange={e => setForm({...form, current_stock: e.target.value})} />
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" step="0.01" placeholder="Warn Lvl" className={styles.filterField} value={form.warning_threshold} onChange={e => setForm({...form, warning_threshold: e.target.value})} style={{ width: '50%' }} title="Warning Threshold" />
                  <input type="number" step="0.01" placeholder="Min Lvl" className={styles.filterField} value={form.min_stock_level} onChange={e => setForm({...form, min_stock_level: e.target.value})} style={{ width: '50%' }} title="Critical Minimum Level" />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={styles.actionBtn}>Save Material</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement History Modal */}
      {historyModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '800px', width: '90%' }}>
            <h2 style={{ margin: '0 0 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Material Audit Trail
              <button onClick={() => setHistoryModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </h2>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <table className={styles.table} style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Before</th>
                    <th>Change</th>
                    <th>After</th>
                    <th>Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
                  ) : movements.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-ghost)' }}>No movements found.</td></tr>
                  ) : (
                    movements.map((m, i) => (
                      <tr key={i}>
                        <td>{m.created_at?.split(' ')[0] || m.movement_date}</td>
                        <td style={{ fontWeight: 600 }}>{m.movement_type}</td>
                        <td className="num-mono">{m.before_qty}</td>
                        <td className="num-mono" style={{ color: m.change_qty > 0 ? '#16a34a' : (m.change_qty < 0 ? '#dc2626' : 'inherit'), fontWeight: 800 }}>
                          {m.change_qty > 0 ? '+' : ''}{m.change_qty}
                        </td>
                        <td className="num-mono">{m.after_qty}</td>
                        <td style={{ color: 'var(--text-ghost)' }}>{m.source_reference || m.remarks || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
