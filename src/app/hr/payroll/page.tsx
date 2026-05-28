'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface PayrollRun {
  id: number;
  month_year: string;
  unit: string;
  stage: string;
  total_gross: number;
  total_net: number;
  created_at: string;
}

interface PayrollSlip {
  id: number;
  emp_id: number;
  emp_code: string;
  name: string;
  department: string;
  unit: string;
  designation: string;
  payable_days: number;
  ot_hours: number;
  gross_earnings: number;
  total_deductions: number;
  net_payable: number;
  snapshot_json: string;
}

export default function PayrollEnginePage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [slips, setSlips] = useState<PayrollSlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [processMonth, setProcessMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [processUnit, setProcessUnit] = useState('');

  const loadRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/payroll');
      const data = await res.json();
      setRuns(data.runs || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { loadRuns(); }, []);

  const handleProcess = async () => {
    if (!processMonth) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process',
          month_year: processMonth,
          unit: processUnit || null,
          processed_by: 1
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        loadRuns();
        loadRunDetail(data.run_id);
      }
    } catch {
      alert('Failed to process payroll.');
    }
    setProcessing(false);
  };

  const loadRunDetail = async (runId: number) => {
    try {
      const res = await fetch(`/api/hr/payroll?run_id=${runId}`);
      const data = await res.json();
      setSelectedRun(data.run);
      setSlips(data.slips || []);
    } catch { }
  };

  const handleStageChange = async (runId: number, newStage: string) => {
    const confirmMsg = newStage === 'Locked'
      ? 'WARNING: Locking this payroll is PERMANENT. Attendance records will also be locked. Continue?'
      : `Move payroll to "${newStage}" stage?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_stage', run_id: runId, new_stage: newStage, user_id: 1 })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        loadRuns();
        loadRunDetail(runId);
      }
    } catch {
      alert('Failed to update stage.');
    }
  };

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const stageBadge = (stage: string) => {
    const cls = stage === 'Draft' ? styles.badgeDraft
      : stage === 'Verified' ? styles.badgeVerified
      : stage === 'Approved' ? styles.badgeApproved
      : styles.badgeLocked;
    return <span className={`${styles.badge} ${cls}`}>{stage}</span>;
  };

  // Calculate summary stats from selected run's slips
  const totalEmployees = slips.length;
  const totalGross = slips.reduce((s, sl) => s + sl.gross_earnings, 0);
  const totalDeductions = slips.reduce((s, sl) => s + sl.total_deductions, 0);
  const totalNet = slips.reduce((s, sl) => s + sl.net_payable, 0);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>Payroll Processing Engine</h1>
          <p>Enterprise-grade salary computation and 4-stage approval workflow.</p>
        </div>
        <div className={styles.controls}>
          <input type="month" className={styles.inputField} value={processMonth} onChange={e => setProcessMonth(e.target.value)} />
          <select className={styles.selectField} value={processUnit} onChange={e => setProcessUnit(e.target.value)}>
            <option value="">All Units</option>
            <option value="Unit 1">Unit 1</option>
            <option value="Unit 2">Unit 2</option>
          </select>
          <button className={styles.actionBtn} onClick={handleProcess} disabled={processing}>
            {processing ? '⚙️ Processing...' : '⚡ Process Payroll'}
          </button>
        </div>
      </div>

      {/* Payroll Runs Table */}
      <div className={styles.runsTable}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Period</th>
              <th>Unit</th>
              <th>Stage</th>
              <th>Gross Total</th>
              <th>Net Total</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>Loading payroll runs...</td></tr>
            ) : runs.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-ghost)' }}>No payroll runs found. Process your first payroll above.</td></tr>
            ) : runs.map(run => (
              <tr key={run.id} style={{ cursor: 'pointer', background: selectedRun?.id === run.id ? '#f0f9ff' : undefined }} onClick={() => loadRunDetail(run.id)}>
                <td><strong>{run.month_year}</strong></td>
                <td>{run.unit || 'All'}</td>
                <td>{stageBadge(run.stage)}</td>
                <td className={`${styles.currency} ${styles.positive}`}>{fmt(run.total_gross)}</td>
                <td className={`${styles.currency}`}>{fmt(run.total_net)}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(run.created_at).toLocaleDateString()}</td>
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {run.stage === 'Draft' && <button className={`${styles.stageBtn} ${styles.stageBtnVerify}`} onClick={() => handleStageChange(run.id, 'Verified')}>✓ Verify</button>}
                    {run.stage === 'Verified' && <button className={`${styles.stageBtn} ${styles.stageBtnApprove}`} onClick={() => handleStageChange(run.id, 'Approved')}>✓ Approve</button>}
                    {run.stage === 'Approved' && <button className={`${styles.stageBtn} ${styles.stageBtnLock}`} onClick={() => handleStageChange(run.id, 'Locked')}>🔒 Lock</button>}
                    {run.stage === 'Locked' && <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>🔒 Immutable</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected Run Detail */}
      {selectedRun && (
        <>
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Employees</div>
              <div className={styles.statValue}>{totalEmployees}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Gross Earnings</div>
              <div className={`${styles.statValue} ${styles.positive}`}>{fmt(totalGross)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Deductions</div>
              <div className={`${styles.statValue} ${styles.negative}`}>{fmt(totalDeductions)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Net Payable</div>
              <div className={styles.statValue}>{fmt(totalNet)}</div>
            </div>
          </div>

          <div className={styles.slipGrid}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Emp Code</th>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Days</th>
                  <th>OT Hrs</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net Payable</th>
                </tr>
              </thead>
              <tbody>
                {slips.map(slip => (
                  <tr key={slip.id}>
                    <td className={styles.mono}><strong>{slip.emp_code}</strong></td>
                    <td><strong>{slip.name}</strong></td>
                    <td>{slip.department || '-'}</td>
                    <td className={styles.mono}>{slip.payable_days}</td>
                    <td className={styles.mono}>{slip.ot_hours}</td>
                    <td className={`${styles.currency} ${styles.positive}`}>{fmt(slip.gross_earnings)}</td>
                    <td className={`${styles.currency} ${styles.negative}`}>{fmt(slip.total_deductions)}</td>
                    <td className={styles.currency}><strong>{fmt(slip.net_payable)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
