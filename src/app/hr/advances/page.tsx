'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function AdvancesPage() {
  const [advances, setAdvances] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [requestModal, setRequestModal] = useState(false);
  const [approveModal, setApproveModal] = useState<any>(null);
  
  // Request Form
  const [selectedEmp, setSelectedEmp] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [workerIntelligence, setWorkerIntelligence] = useState<any>(null);

  // Approve Form
  const [signature, setSignature] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/advances');
      const data = await res.json();
      setAdvances(data.advances || []);
      
      const empRes = await fetch('/api/hr/employees');
      const empData = await empRes.json();
      setEmployees(empData.employees?.filter((e: any) => e.status === 'Active') || []);
    } catch (e) {
      alert('Failed to load advances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadWorkerIntelligence = async (empId: string) => {
    if (!empId) {
      setWorkerIntelligence(null);
      return;
    }
    try {
      const res = await fetch(`/api/hr/attendance/summary?emp_id=${empId}`);
      const data = await res.json();
      setWorkerIntelligence(data);
    } catch (e) {
      console.error('Failed to load intelligence');
    }
  };

  const handleEmpSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEmp(e.target.value);
    loadWorkerIntelligence(e.target.value);
  };

  const submitRequest = async () => {
    if (!selectedEmp || !amount) return alert('Employee and amount required');
    try {
      const res = await fetch('/api/hr/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_id: selectedEmp, amount_requested: parseFloat(amount), remarks })
      });
      if (res.ok) {
        setRequestModal(false);
        setSelectedEmp('');
        setAmount('');
        setRemarks('');
        setWorkerIntelligence(null);
        loadData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      alert('Network error');
    }
  };

  const approveAdvance = async () => {
    if (signature !== 'APPROVED') return alert('Please type "APPROVED" to confirm.');
    try {
      const res = await fetch('/api/hr/advances/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          advance_id: approveModal.id, 
          amount_approved: parseFloat(approveModal.amount_requested), 
          signature 
        })
      });
      if (res.ok) {
        setApproveModal(null);
        setSignature('');
        loadData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      alert('Network error');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Advance Salary Pipeline</h1>
          <p>Workforce Financial Operations</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setRequestModal(true)}>
          + New Advance Request
        </button>
      </div>

      <div className={styles.grid}>
        {loading ? <p>Loading...</p> : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Amount</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {advances.map(a => (
                <tr key={a.id}>
                  <td>{a.request_date}</td>
                  <td>
                    <strong>{a.emp_code}</strong> - {a.emp_name}
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{a.department}</div>
                  </td>
                  <td>₹{a.amount_requested}</td>
                  <td><strong style={{ color: a.outstanding_balance > 0 ? '#ef4444' : '#22c55e' }}>₹{a.outstanding_balance}</strong></td>
                  <td>
                    <span className={`${styles.badge} ${styles[a.status]}`}>{a.status.toUpperCase()}</span>
                  </td>
                  <td>
                    {a.status === 'pending' && (
                      <button className={styles.actionBtn} onClick={() => {
                        setApproveModal(a);
                        loadWorkerIntelligence(a.emp_id.toString());
                      }}>
                        Review & Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {advances.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>No advances found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {requestModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Create Advance Request</h2>
            
            <div className={styles.formGroup}>
              <label>Select Employee</label>
              <select value={selectedEmp} onChange={handleEmpSelect}>
                <option value="">-- Select --</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.emp_code} - {e.name}</option>
                ))}
              </select>
            </div>

            {workerIntelligence && (
              <div className={styles.intelligenceCard}>
                <h4>Workforce Intelligence</h4>
                <div className={styles.intelGrid}>
                  <div><strong>Present:</strong> {workerIntelligence.summary.total_present} days</div>
                  <div><strong>Attendance:</strong> {workerIntelligence.summary.attendance_percentage}%</div>
                  <div><strong>OT:</strong> {workerIntelligence.summary.total_ot_hours} hours</div>
                  <div><strong>Pending Advances:</strong> ₹{workerIntelligence.advances.total_outstanding}</div>
                </div>
              </div>
            )}

            <div className={styles.formGroup}>
              <label>Advance Amount (₹)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>

            <div className={styles.formGroup}>
              <label>Remarks / Reason</label>
              <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>

            <div className={styles.modalActions}>
              <button onClick={() => { setRequestModal(false); setWorkerIntelligence(null); }} className={styles.cancelBtn}>Cancel</button>
              <button onClick={submitRequest} className={styles.primaryBtn}>Submit Request</button>
            </div>
          </div>
        </div>
      )}

      {approveModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.securityHeader}>
              🛡️ FINANCIAL OPERATIONS AUTHORIZATION
            </div>
            
            <div style={{ margin: '20px 0' }}>
              <p>You are authorizing an advance payment of <strong>₹{approveModal.amount_requested}</strong> for <strong>{approveModal.emp_name} ({approveModal.emp_code})</strong>.</p>
              
              {workerIntelligence && (
                <div className={styles.intelligenceCard} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <h4>Risk Assessment</h4>
                  <div className={styles.intelGrid}>
                    <div><strong>Attendance Reliability:</strong> {workerIntelligence.summary.attendance_percentage}%</div>
                    <div><strong>Current Outstanding:</strong> <span style={{ color: workerIntelligence.advances.total_outstanding > 0 ? 'red' : 'green' }}>₹{workerIntelligence.advances.total_outstanding}</span></div>
                    <div><strong>Estimated Basic Salary:</strong> ₹{workerIntelligence.salary.basic_wage}</div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label style={{ color: '#dc2626', fontWeight: 'bold' }}>Digital Signature Confirmation</label>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>To authorize this transaction and lock it into the payroll deduction pipeline, type "APPROVED" below.</p>
              <input 
                type="text" 
                placeholder="Type APPROVED to confirm" 
                value={signature} 
                onChange={e => setSignature(e.target.value)} 
                style={{ border: '2px solid #ef4444', background: '#fef2f2' }}
              />
            </div>

            <div className={styles.modalActions}>
              <button onClick={() => { setApproveModal(null); setSignature(''); setWorkerIntelligence(null); }} className={styles.cancelBtn}>Cancel</button>
              <button 
                onClick={approveAdvance} 
                className={styles.primaryBtn} 
                disabled={signature !== 'APPROVED'}
                style={{ background: signature === 'APPROVED' ? '#16a34a' : '#94a3b8' }}
              >
                🔒 Confirm Authorization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
