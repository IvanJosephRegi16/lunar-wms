"use client";

import { useState, useEffect } from 'react';

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

  return (
    <div className="main-content fade-up">
      <div className="card-clean">
        <h1 className="title-main">Material Movement History</h1>
        <p style={{ color: 'var(--text-ghost)', marginBottom: '24px' }}>Audit‑ready immutable log of all inventory changes.</p>
        <div className="flex-between" style={{ gap: '16px', flexWrap: 'wrap' }}>
          <select style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}>
            <option value="all">All Materials</option>
          </select>
          <select style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="Purchase">Purchase</option>
            <option value="Adjustment">Adjustment</option>
            <option value="Transfer">Transfer</option>
          </select>
          <input type="date" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="card-clean table-responsive">
        <table className="table-corporate">
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
                <tr key={m.id} className="tr-hover">
                  <td>{m.created_at?.split(' ')[0] || m.movement_date}</td>
                  <td>{m.material_name}{m.colour ? ` (${m.colour})` : ''}</td>
                  <td>{m.movement_type}</td>
                  <td>{m.before_qty}</td>
                  <td style={{ color: m.change_qty > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                    {m.change_qty > 0 ? `+${m.change_qty}` : m.change_qty}
                  </td>
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
