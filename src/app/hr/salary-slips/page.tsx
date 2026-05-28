'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function SalarySlipsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [slips, setSlips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRuns = async () => {
    try {
      const res = await fetch('/api/hr/payroll');
      const data = await res.json();
      setRuns(data.runs?.filter((r: any) => r.stage === 'Approved' || r.stage === 'Locked') || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { loadRuns(); }, []);

  const loadRunDetail = async (runId: number) => {
    try {
      const res = await fetch(`/api/hr/payroll?run_id=${runId}`);
      const data = await res.json();
      setSelectedRun(data.run);
      setSlips(data.slips || []);
    } catch { }
  };

  const handlePrint = (slipId: string) => {
    const printContents = document.getElementById(slipId)?.innerHTML;
    if (!printContents) return;

    const originalContents = document.body.innerHTML;
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; max-width: 800px; margin: 0 auto;">
        ${printContents}
      </div>
    `;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload(); // Reload to restore React state cleanly after DOM manipulation
  };

  const handlePrintAll = () => {
    const printContents = document.getElementById('all-slips')?.innerHTML;
    if (!printContents) return;

    const originalContents = document.body.innerHTML;
    document.body.innerHTML = `
      <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto;">
        ${printContents}
      </div>
    `;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  };

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Salary Slips (PDF/Print)</h1>
          <p>Print or export slips for Approved and Locked payrolls.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        
        {/* Runs Sidebar */}
        <div className={styles.runsSidebar}>
          <h3>Available Payrolls</h3>
          {loading ? <p>Loading...</p> : runs.length === 0 ? <p className={styles.empty}>No approved payrolls found.</p> : runs.map(run => (
            <div 
              key={run.id} 
              className={`${styles.runCard} ${selectedRun?.id === run.id ? styles.runCardActive : ''}`}
              onClick={() => loadRunDetail(run.id)}
            >
              <div className={styles.runTitle}>{run.month_year} {run.unit ? `(${run.unit})` : '(All Units)'}</div>
              <div className={styles.runSub}>Stage: <strong>{run.stage}</strong> • ₹{run.total_net.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Slips Preview Area */}
        <div className={styles.slipsPreview}>
          {!selectedRun ? (
            <div className={styles.emptyState}>Select an approved payroll run to view slips.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Showing {slips.length} Slips</h3>
                <button className={styles.printBtn} onClick={handlePrintAll}>🖨️ Print All Slips</button>
              </div>

              <div id="all-slips" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                {slips.map((slip, index) => {
                  const snap = JSON.parse(slip.snapshot_json || '{}');
                  return (
                    <div id={`slip-${slip.id}`} key={slip.id} className={styles.slipCard} style={{ pageBreakAfter: index === slips.length - 1 ? 'auto' : 'always' }}>
                      
                      {/* Slip Header */}
                      <div className={styles.slipHeader}>
                        <div style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.5px' }}>VIKING INC.</div>
                        <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Salary Slip - {selectedRun.month_year}</div>
                      </div>

                      {/* Employee Info */}
                      <div className={styles.infoGrid}>
                        <div><label>Emp Name</label><div>{slip.name}</div></div>
                        <div><label>Emp Code</label><div>{slip.emp_code}</div></div>
                        <div><label>Designation</label><div>{slip.designation || '-'}</div></div>
                        <div><label>Department</label><div>{slip.department || '-'}</div></div>
                      </div>

                      {/* Attendance Summary */}
                      <div className={styles.infoGrid} style={{ marginTop: '16px', background: '#f8fafc' }}>
                        <div><label>Total Days</label><div>{snap.attendance_summary?.daysInMonth || '-'}</div></div>
                        <div><label>Payable Days</label><div>{slip.payable_days}</div></div>
                        <div><label>Absent Days</label><div>{snap.attendance_summary?.absentDays || 0}</div></div>
                        <div><label>OT Hours</label><div>{slip.ot_hours}</div></div>
                      </div>

                      {/* Financials Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
                        
                        {/* Earnings */}
                        <div className={styles.finTableWrap}>
                          <table className={styles.finTable}>
                            <thead><tr><th>EARNINGS</th><th style={{ textAlign: 'right' }}>AMOUNT</th></tr></thead>
                            <tbody>
                              <tr><td>Basic Wage</td><td align="right">{fmt(snap.earnings?.basic || 0)}</td></tr>
                              <tr><td>Dearness Allowance (DA)</td><td align="right">{fmt(snap.earnings?.da || 0)}</td></tr>
                              <tr><td>House Rent Allowance (HRA)</td><td align="right">{fmt(snap.earnings?.hra || 0)}</td></tr>
                              <tr><td>Other Allowances</td><td align="right">{fmt(snap.earnings?.other || 0)}</td></tr>
                              <tr><td>Overtime (OT)</td><td align="right">{fmt(snap.earnings?.ot || 0)}</td></tr>
                              {snap.additions?.extra > 0 && <tr><td>Other Additions</td><td align="right">{fmt(snap.additions.extra)}</td></tr>}
                            </tbody>
                            <tfoot><tr><td>GROSS EARNINGS</td><td align="right">{fmt(slip.gross_earnings)}</td></tr></tfoot>
                          </table>
                        </div>

                        {/* Deductions */}
                        <div className={styles.finTableWrap}>
                          <table className={styles.finTable}>
                            <thead><tr><th>DEDUCTIONS</th><th style={{ textAlign: 'right' }}>AMOUNT</th></tr></thead>
                            <tbody>
                              <tr><td>Provident Fund (PF)</td><td align="right">{fmt(snap.deductions?.pf || 0)}</td></tr>
                              <tr><td>ESI Contribution</td><td align="right">{fmt(snap.deductions?.esi || 0)}</td></tr>
                              <tr><td>Professional Tax (PT)</td><td align="right">{fmt(snap.deductions?.pt || 0)}</td></tr>
                              {snap.adjustments?.map((adj: any) => adj.is_deduction === 1 ? (
                                <tr key={adj.id}><td>{adj.label}</td><td align="right">{fmt(adj.amount)}</td></tr>
                              ) : null)}
                            </tbody>
                            <tfoot><tr><td>TOTAL DEDUCTIONS</td><td align="right">{fmt(slip.total_deductions)}</td></tr></tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Net Payable */}
                      <div className={styles.netBox}>
                        <div>NET PAYABLE</div>
                        <div style={{ fontSize: '24px' }}>{fmt(slip.net_payable)}</div>
                      </div>

                      {/* Print individual btn (Hidden on actual print) */}
                      <div className="no-print" style={{ marginTop: '20px', textAlign: 'right' }}>
                        <button className={styles.printBtn} onClick={() => handlePrint(`slip-${slip.id}`)}>🖨️ Print This Slip</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
