'use client';

import { useState, useEffect } from 'react';

export default function VStrap() {
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    article_code: '', colour: '',
    opening_stock: '', inward_qty: '', outward_qty: '', remarks: ''
  });

  const loadData = () => {
    setLoading(true);
    fetch('/api/v-strap')
      .then(res => res.json())
      .then(d => {
        setEntries(d.entries || []);
        setSummary(d.summary || null);
        setLoading(false);
      });
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/v-strap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      setShowForm(false);
      setForm({ ...form, article_code: '', colour: '', opening_stock: '', inward_qty: '', outward_qty: '', remarks: '' });
      loadData();
    } catch {
      alert('Error saving');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete entry?')) return;
    await fetch('/api/v-strap', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    loadData();
  };

  if (loading) return <div className="loading-dot" style={{ margin: '100px auto', display: 'table' }}>Scanning Raw Inventory...</div>;

  return (
    <div className="fade-up">
      <div className="flex-between mb-8">
        <div style={{ display: 'flex', gap: '24px' }}>
          {summary && (
            <div className="grid grid-2" style={{ gap: '12px' }}>
               <div style={{ background: '#f1f5f9', padding: '8px 16px', borderRadius: '8px', borderLeft: '3px solid var(--success)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Inward Total</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--success)' }}>{(summary.total_inward || 0).toLocaleString()}</div>
               </div>
               <div style={{ background: '#f1f5f9', padding: '8px 16px', borderRadius: '8px', borderLeft: '3px solid var(--danger)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Outward Total</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--danger)' }}>{(summary.total_outward || 0).toLocaleString()}</div>
               </div>
            </div>
          )}
        </div>
        <button className="btn-corp btn-primary-corp" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel Transaction' : '+ Register Flow Entry'}
        </button>
      </div>

      {showForm && (
        <div className="card-clean" style={{ borderTop: '4px solid var(--primary)', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>New V-Strap Transaction</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-3" style={{ gap: '20px' }}>
               <div className="form-group-lux">
                  <label>Service Date</label>
                  <input type="date" required value={form.entry_date} onChange={e => setForm({...form, entry_date: e.target.value})} />
               </div>
               <div className="form-group-lux">
                  <label>Article ID</label>
                  <input type="text" placeholder="e.g. VS-900" required value={form.article_code} onChange={e => setForm({...form, article_code: e.target.value})} />
               </div>
               <div className="form-group-lux">
                  <label>Spectrum/Colour</label>
                  <input type="text" placeholder="e.g. Black-Gold" required value={form.colour} onChange={e => setForm({...form, colour: e.target.value})} />
               </div>
            </div>

            <div className="grid grid-4" style={{ gap: '20px', marginTop: '24px' }}>
               <div className="form-group-lux">
                  <label>Opening Count</label>
                  <input type="number" value={form.opening_stock} onChange={e => setForm({...form, opening_stock: e.target.value})} />
               </div>
               <div className="form-group-lux">
                  <label>Inflow Qty</label>
                  <input type="number" value={form.inward_qty} onChange={e => setForm({...form, inward_qty: e.target.value})} />
               </div>
               <div className="form-group-lux">
                  <label>Outflow Qty</label>
                  <input type="number" value={form.outward_qty} onChange={e => setForm({...form, outward_qty: e.target.value})} />
               </div>
               <div className="form-group-lux">
                  <label>Internal Specs/Remarks</label>
                  <input type="text" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
               </div>
            </div>
            
            <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
               <button type="submit" className="btn-corp btn-primary-corp">Authorize & Commit</button>
               <button type="button" className="btn-corp" onClick={() => setShowForm(false)}>Discard</button>
            </div>
          </form>
        </div>
      )}

      <div className="card-clean" style={{ padding: '0' }}>
         <div style={{ padding: '32px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>V-Strap Vector History</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>High-fidelity ledger tracking the chronological flow of raw V-Strap materials.</p>
         </div>

         <div style={{ overflowX: 'auto' }}>
            <table className="table-corporate">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Log Date</th>
                  <th>Article ID</th>
                  <th>Spectrum</th>
                  <th className="num-mono" style={{ textAlign: 'right' }}>Initial</th>
                  <th className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>Inflow</th>
                  <th className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>Outflow</th>
                  <th className="num-mono" style={{ textAlign: 'right', background: '#f8fafc', fontWeight: 800 }}>Closing Bal</th>
                  <th>Specs</th>
                  <th>Operator</th>
                  <th style={{ width: '80px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="tr-hover">
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{e.entry_date}</td>
                    <td style={{ fontWeight: 700 }}>{e.article_code}</td>
                    <td style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', fontWeight: 600 }}>{e.colour}</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>{(e.opening_stock || 0).toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{(e.inward_qty || 0).toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>{(e.outward_qty || 0).toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right', background: '#f8fafc', fontWeight: 800, color: 'var(--primary)', fontSize: '16px' }}>
                       {e.closing_stock.toLocaleString()}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px', fontSize: '12px' }}>{e.remarks || '-'}</td>
                    <td style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-ghost)' }}>{e.created_by_name?.toUpperCase()}</td>
                    <td>
                       <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '16px' }} onClick={() => handleDelete(e.id)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
         </div>
      </div>

      <style jsx>{`
        .form-group-lux { display: flex; flexDirection: column; gap: 8px; }
        .form-group-lux label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .form-group-lux input { background: #f8fafc; border: 1px solid var(--border); padding: 10px 14px; borderRadius: 8px; font-size: 14px; font-family: inherit; font-weight: 500; outline: none; transition: border-color 0.2s; }
        .form-group-lux input:focus { border-color: var(--primary); background: white; }
      `}</style>
    </div>
  );
}
