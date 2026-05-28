'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface Employee { id: number; emp_code: string; punch_code: string; name: string; unit: string; }
interface Adjustment {
  id: number; emp_id: number; month_year: string; type: string; label: string;
  amount: number; is_deduction: number; remarks: string;
}

export default function AdjustmentsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [form, setForm] = useState({ emp_id: '', type: 'ADVANCE', label: '', amount: '', is_deduction: 1, remarks: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      // We leverage the existing payroll API for adjustments if it supports GET, 
      // or we can build a dedicated route. For now, let's fetch employees to populate the dropdown.
      const empRes = await fetch('/api/hr/employees');
      const empData = await empRes.json();
      setEmployees(empData.employees || []);
      
      // Fetch adjustments via a new API we will create
      const adjRes = await fetch(`/api/hr/adjustments?month=${month}`);
      const adjData = await adjRes.json();
      setAdjustments(adjData.adjustments || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [month]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_adjustment',
          emp_id: form.emp_id,
          month_year: month,
          type: form.type,
          label: form.label || form.type,
          amount: parseFloat(form.amount),
          is_deduction: form.is_deduction,
          remarks: form.remarks
        })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        setForm({ ...form, amount: '', remarks: '', label: '' });
        loadData();
      }
    } catch {
      alert('Failed to save adjustment');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this adjustment?')) return;
    try {
      await fetch('/api/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_adjustment', adjustment_id: id })
      });
      loadData();
    } catch {
      alert('Failed to delete.');
    }
  };

  const types = [
    { code: 'ADVANCE', name: 'Salary Advance', ded: 1 },
    { code: 'FINE', name: 'Fine / Penalty', ded: 1 },
    { code: 'FOOD', name: 'Canteen Deduction', ded: 1 },
    { code: 'WELFARE', name: 'Welfare Fund', ded: 1 },
    { code: 'BONUS', name: 'Bonus / Incentive', ded: 0 },
    { code: 'OTHER', name: 'Other Adjustment', ded: 1 }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Salary Adjustments Console</h1>
          <p>Manage one-off advances, fines, and bonuses for {month}</p>
        </div>
        <input type="month" className={styles.inputField} value={month} onChange={e => setMonth(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
        
        {/* Entry Form */}
        <div className={styles.card}>
          <h3>New Adjustment</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <select required className={styles.inputField} value={form.emp_id} onChange={e => setForm({...form, emp_id: e.target.value})}>
              <option value="">-- Select Worker --</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.emp_code} - {e.name}</option>)}
            </select>
            
            <select required className={styles.inputField} value={form.type} onChange={e => {
              const sel = types.find(t => t.code === e.target.value);
              setForm({...form, type: e.target.value, is_deduction: sel?.ded ?? 1});
            }}>
              {types.map(t => <option key={t.code} value={t.code}>{t.name} ({t.ded ? 'Deduct' : 'Add'})</option>)}
            </select>

            <input required type="number" step="0.01" placeholder="Amount (₹)" className={styles.inputField} value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
            <input placeholder="Custom Label (Optional)" className={styles.inputField} value={form.label} onChange={e => setForm({...form, label: e.target.value})} />
            <input placeholder="Remarks" className={styles.inputField} value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
            
            <button type="submit" className={styles.actionBtn}>➕ Add Record</button>
          </form>
        </div>

        {/* List */}
        <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Action</th>
                <th>Remarks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
              ) : adjustments.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-ghost)' }}>No adjustments for this month.</td></tr>
              ) : adjustments.map(adj => {
                const emp = employees.find(e => e.id === adj.emp_id);
                return (
                  <tr key={adj.id}>
                    <td><strong>{emp?.name}</strong> <span style={{ fontSize: '10px', color: 'var(--text-ghost)' }}>{emp?.emp_code}</span></td>
                    <td>{adj.label || adj.type}</td>
                    <td style={{ color: adj.is_deduction ? '#991b1b' : '#166534', fontWeight: 800 }}>
                      {adj.is_deduction ? '-' : '+'}₹{adj.amount.toFixed(2)}
                    </td>
                    <td><span className={styles.badge} style={{ background: adj.is_deduction ? '#fee2e2' : '#dcfce7', color: adj.is_deduction ? '#991b1b' : '#166534' }}>
                      {adj.is_deduction ? 'DEDUCTION' : 'EARNING'}
                    </span></td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{adj.remarks || '-'}</td>
                    <td><button onClick={() => handleDelete(adj.id)} className={styles.deleteBtn}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
