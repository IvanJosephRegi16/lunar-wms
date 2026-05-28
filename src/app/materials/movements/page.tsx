import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function MaterialMovementsPage() {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMaterial, setFilterMaterial] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      let url = '/api/materials/movements?';
      if (filterMaterial !== 'all') url += `material_id=${filterMaterial}&`;
      if (filterType !== 'all') url += `type=${filterType}&`;
      if (dateFrom) url += `from=${dateFrom}&`;
      if (dateTo) url += `to=${dateTo}&`;
      const res = await fetch(url);
      const data = await res.json();
      setMovements(data.movements || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [filterMaterial, filterType, dateFrom, dateTo]);

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Material Movement History</h1>
        <p>Audit‑ready immutable log of all inventory changes.</p>
        <div className={styles.controls}>
          <select className={styles.filterField} value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}>
            <option value="all">All Materials</option>
            {/* In a real app, populate this dropdown from a materials lookup API */}
          </select>
          <select className={styles.filterField} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="Purchase">Purchase</option>
            <option value="Adjustment">Adjustment</option>
            <option value="Transfer">Transfer</option>
          </select>
          <input type="date" className={styles.filterField} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className={styles.filterField} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className={styles.historyTable}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Material</th>
              <th>Type</th>
              <th>Before Qty</th>
              <th>Change Qty</th>
              <th>After Qty</th>
              <th>Reference</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>Loading movements...</td></tr>
            ) : movements.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-ghost)' }}>No movements recorded.</td></tr>
            ) : (
              movements.map(m => (
                <tr key={m.id}>
                  <td>{m.created_at?.split(' ')[0] || m.movement_date}</td>
                  <td>{m.material_name}{m.colour ? ` (${m.colour})` : ''}</td>
                  <td>{m.movement_type}</td>
                  <td>{m.before_qty}</td>
                  <td>{m.change_qty > 0 ? `+${m.change_qty}` : m.change_qty}</td>
                  <td>{m.after_qty}</td>
                  <td>{m.source_reference}</td>
                  <td>{m.remarks}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
