'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut, Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const GOOGLE_SHEET_ID = '1ErWGgNjV-aBSj25nVMRO-dVuRiMIFd5OgvrwCN5Xegg';
const getCsvUrl = (sheetName: string) => `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

const parseDate = (dStr: string) => {
  if (!dStr) return null;
  const s = dStr.toString().trim();
  const p1 = s.split('-');
  const p2 = s.split('/');
  const parts = p1.length > 1 ? p1 : p2;
  
  if (parts.length === 3) {
    let d = parseInt(parts[0], 10);
    let m = parts[1];
    let y = parseInt(parts[2], 10);
    if (isNaN(y)) return null;
    if (y < 100) y += 2000;
    
    let monthIndex = -1;
    if (isNaN(parseInt(m, 10))) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      monthIndex = months.findIndex(x => m.toLowerCase().includes(x.toLowerCase()));
    } else {
      monthIndex = parseInt(m, 10) - 1;
    }
    if (monthIndex > -1) {
      return new Date(y, monthIndex, d);
    }
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const toISODate = (d: Date) => {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

export default function MISDashboard() {
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('Overview');

  // Date Filter State
  const [dateMode, setDateMode] = useState<'single'|'range'>('single');
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [endDate, setEndDate] = useState(toISODate(new Date()));

  // Sheet Data States
  const [qcData, setQcData] = useState<any[]>([]);
  const [cuttingPlan, setCuttingPlan] = useState<any[]>([]);
  
  // Individual Entries
  const [cuttingEntry, setCuttingEntry] = useState<any[]>([]);
  const [printingEntry, setPrintingEntry] = useState<any[]>([]);
  const [pastingEntry, setPastingEntry] = useState<any[]>([]);
  const [stitchingEntry, setStitchingEntry] = useState<any[]>([]);
  const [pouringEntry, setPouringEntry] = useState<any[]>([]);
  const [mcEntry, setMcEntry] = useState<any[]>([]);

  const fetchSheet = (sheetName: string): Promise<any[]> => {
    return new Promise((resolve) => {
      Papa.parse(getCsvUrl(sheetName), {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: () => resolve([])
      });
    });
  };

  const syncData = async () => {
    setLoading(true);
    try {
      const [
        qc, cp,
        ce, pre, pae, ste, poe, mce
      ] = await Promise.all([
        fetchSheet('QC'),
        fetchSheet('Cutting_Plan'),
        fetchSheet('Cutting_Entry'),
        fetchSheet('Printing_Entry'),
        fetchSheet('Pasting_Entry'),
        fetchSheet('Stiching_Entry'),
        fetchSheet('Pouring_Entry'),
        fetchSheet('MC_Entry')
      ]);

      setQcData(qc);
      setCuttingPlan(cp);
      setCuttingEntry(ce);
      setPrintingEntry(pre);
      setPastingEntry(pae);
      setStitchingEntry(ste);
      setPouringEntry(poe);
      setMcEntry(mce);
      
      setLastSynced(new Date());
    } catch (err) {
      console.error('Failed to sync data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncData();
    const interval = setInterval(() => {
      syncData();
    }, 15 * 60 * 1000); // 15 mins
    return () => clearInterval(interval);
  }, []);

  const getVal = (row: any, key: string) => {
    const v = row[key];
    if (!v || v.trim() === '' || v.toUpperCase() === 'NIL') return 0;
    return parseInt(v.replace(/,/g, ''), 10) || 0;
  };

  // Date Filtering Logic
  const startD = new Date(startDate);
  startD.setHours(0,0,0,0);
  const endD = dateMode === 'single' ? new Date(startDate) : new Date(endDate);
  endD.setHours(23,59,59,999);
  const daysInRange = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)));

  const filterByDate = (data: any[]) => {
    return data.filter(row => {
      const d = parseDate(row['Date'] || row['Date ']);
      if (!d) return false; // If no valid date, exclude
      return d.getTime() >= startD.getTime() && d.getTime() <= endD.getTime();
    });
  };

  // Filtered Datasets
  const fQc = filterByDate(qcData);
  const fCp = filterByDate(cuttingPlan);
  const fCe = filterByDate(cuttingEntry);
  const fPre = filterByDate(printingEntry);
  const fPae = filterByDate(pastingEntry);
  const fSte = filterByDate(stitchingEntry);
  const fPoe = filterByDate(pouringEntry);
  const fMce = filterByDate(mcEntry); // Note: MC_Entry usually has 'Export Date/Time' or similar. We rely on standard 'Date' column. If 'Date' missing, fallback logic might be needed.

  // Metrics Calculation
  const totalCutting = fCe.reduce((sum, r) => sum + getVal(r, 'Total'), 0);
  const totalPrinting = fPre.reduce((sum, r) => sum + getVal(r, 'Total'), 0);
  const totalPasting = fPae.reduce((sum, r) => sum + getVal(r, 'Total'), 0);
  const totalStitching = fSte.reduce((sum, r) => sum + getVal(r, 'Total'), 0);
  const totalPouring = fPoe.reduce((sum, r) => sum + getVal(r, 'Total'), 0);
  const totalQc = fQc.reduce((sum, r) => sum + getVal(r, 'Total'), 0);
  const totalPacking = fMce.reduce((sum, r) => sum + getVal(r, 'Total'), 0);

  const totalDamage = fQc.reduce((sum, r) => sum + getVal(r, 'Damage'), 0);

  // QC Pass Rate Logic:
  // Count all Sl Nos that have a valid entry in the Cutting_Plan sheet (in selected date range)
  const totalSlNosInPlan = fCp.length;
  // From those same Sl Nos, check how many appear in the QC sheet with a completed QC entry
  const slNosWithQcCompleted = fCp.filter(cp => {
    return qcData.some(q => q['Unique ID'] === cp['Unique ID'] && getVal(q, 'Total') > 0);
  }).length;
  const qcPassRate = totalSlNosInPlan > 0 ? ((slNosWithQcCompleted / totalSlNosInPlan) * 100).toFixed(1) : '0.0';

  const renderTabContent = () => {
    if (activeTab === 'Overview') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>Section efficiency — Selected Date(s)</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: 'Cutting', val: totalCutting, max: 3000 * daysInRange, color: '#6366f1' },
                { label: 'Printing', val: totalPrinting, max: 3000 * daysInRange, color: '#10b981' },
                { label: 'Pasting', val: totalPasting, max: 3000 * daysInRange, color: '#f59e0b' },
                { label: 'Pouring', val: totalPouring, max: 3000 * daysInRange, color: '#ec4899' },
                { label: 'QC', val: totalQc, max: 3000 * daysInRange, color: '#3b82f6' }
              ].map(s => {
                const pct = s.max > 0 ? Math.min(100, Math.round((s.val / s.max) * 100)) : 0;
                return (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '80px', fontSize: '13px', fontWeight: 600 }}>{s.label}</div>
                    <div style={{ flex: 1, background: '#374151', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: s.color, borderRadius: '5px' }} />
                    </div>
                    <div style={{ width: '40px', textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>{pct}%</div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '32px', height: '250px' }}>
              <Bar 
                data={{
                  labels: ['Cutting', 'Printing', 'Pasting', 'Stitching', 'Pouring', 'QC', 'Packing'],
                  datasets: [{
                    data: [totalCutting, totalPrinting, totalPasting, totalStitching, totalPouring, totalQc, totalPacking],
                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#6b7280', '#ec4899', '#3b82f6', '#4b5563'],
                    borderRadius: 4
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { 
                    y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
                    x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                  }
                }}
              />
            </div>
          </div>
          
          <div>
            <h3 style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>QC summary — Filtered Lots</h3>
            <div style={{ border: '1px solid #374151', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead style={{ background: '#1f2937', color: '#9ca3af', textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '12px' }}>Lot</th>
                    <th style={{ padding: '12px' }}>Article</th>
                    <th style={{ padding: '12px' }}>Colour</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>QC Qty</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Damage</th>
                  </tr>
                </thead>
                <tbody>
                  {fQc.slice(-10).reverse().map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{r['Unique ID']}</td>
                      <td style={{ padding: '12px' }}>{r['Article']}</td>
                      <td style={{ padding: '12px' }}>{r['Colour']}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{getVal(r, 'Total').toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: getVal(r, 'Damage') > 0 ? '#ef4444' : 'inherit' }}>{getVal(r, 'Damage') || 0}</td>
                    </tr>
                  ))}
                  {fQc.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>No QC entries for selected dates</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'Cutting Plan') {
      return (
        <div style={{ overflowX: 'auto', border: '1px solid #374151', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead style={{ background: '#1f2937', color: '#9ca3af', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '12px' }}>Unique ID</th>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Article</th>
                <th style={{ padding: '12px' }}>Colour</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Cutting</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Printing</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>QC</th>
              </tr>
            </thead>
            <tbody>
              {fCp.slice(-20).reverse().map((r, i) => {
                const badge = (val: string) => {
                  const v = val?.toString().toUpperCase() || 'NIL';
                  if (v === 'NIL' || v === '') return <span style={{ padding: '4px 8px', background: '#374151', color: '#9ca3af', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>Pending</span>;
                  return <span style={{ padding: '4px 8px', background: '#064e3b', color: '#34d399', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>Done</span>;
                };

                return (
                  <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{r['Unique ID']}</td>
                    <td style={{ padding: '12px' }}>{r['Date']}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#93c5fd' }}>{r['Article']}</td>
                    <td style={{ padding: '12px' }}>{r['Colour']}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{getVal(r, 'Total').toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{badge(r['Cutting Completed'])}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{badge(r['Printing Completed'])}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{badge(r['QC Completed'])}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      );
    }
    
    if (activeTab === 'QC Tracker') {
      const totalQcValue = fQc.reduce((sum, r) => sum + (getVal(r, 'Total') * (parseFloat(r['Rate']) || 0)), 0);
      return (
        <div style={{ overflowX: 'auto', border: '1px solid #374151', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead style={{ background: '#1f2937', color: '#9ca3af', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Lot</th>
                <th style={{ padding: '12px' }}>Article</th>
                <th style={{ padding: '12px' }}>Colour</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>QC Qty</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Damage</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Shortages</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Rate ₹</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Value ₹</th>
              </tr>
            </thead>
            <tbody>
              {fQc.map((r, i) => {
                const qty = getVal(r, 'Total');
                const rate = parseFloat(r['Rate']) || 0;
                const damage = getVal(r, 'Damage');
                return (
                  <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                    <td style={{ padding: '12px' }}>{r['Date']}</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{r['Unique ID']}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#93c5fd' }}>{r['Article']}</td>
                    <td style={{ padding: '12px' }}>{r['Colour']}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{qty.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: damage > 0 ? '#ef4444' : 'inherit', fontWeight: damage > 0 ? 800 : 400 }}>{damage}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{getVal(r, 'Shortages')}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{rate.toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{(qty * rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )
              })}
              <tr style={{ background: '#1f2937', fontWeight: 800 }}>
                <td colSpan={8} style={{ padding: '12px', textAlign: 'right' }}>TOTAL QC VALUE (Filtered):</td>
                <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: '#10b981' }}>₹{totalQcValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'Pouring Entry') {
      return (
        <div style={{ overflowX: 'auto', border: '1px solid #374151', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead style={{ background: '#1f2937', color: '#9ca3af', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Operator</th>
                <th style={{ padding: '12px' }}>Sl No</th>
                <th style={{ padding: '12px' }}>Article</th>
                <th style={{ padding: '12px' }}>Colour</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {fPoe.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                  <td style={{ padding: '12px' }}>{r['Date']}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{r['Operator'] || '-'}</td>
                  <td style={{ padding: '12px' }}>{r['Sl No'] || r['Unique ID'] || '-'}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: '#93c5fd' }}>{r['Article'] || '-'}</td>
                  <td style={{ padding: '12px' }}>{r['Colour'] || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{getVal(r, 'Total').toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'Packing Entry') {
      return (
        <div style={{ overflowX: 'auto', border: '1px solid #374151', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead style={{ background: '#1f2937', color: '#9ca3af', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Packed By</th>
                <th style={{ padding: '12px' }}>Article</th>
                <th style={{ padding: '12px' }}>Colour</th>
                <th style={{ padding: '12px' }}>Ratio</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total Pairs</th>
              </tr>
            </thead>
            <tbody>
              {fMce.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                  <td style={{ padding: '12px' }}>{r['Date'] || r['Export Date/Time'] || '-'}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{r['Packed By'] || '-'}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: '#93c5fd' }}>{r['Article'] || '-'}</td>
                  <td style={{ padding: '12px' }}>{r['Colour'] || '-'}</td>
                  <td style={{ padding: '12px', fontFamily: 'monospace' }}>{r['Ratio'] || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{getVal(r, 'Total').toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'Operator Report') {
      const getOpStats = (data: any[]) => {
        const ops: Record<string, number> = {};
        data.forEach(r => {
          const op = r['Operator'] || 'Unknown';
          ops[op] = (ops[op] || 0) + getVal(r, 'Total');
        });
        return Object.entries(ops).sort((a,b) => b[1] - a[1]);
      };

      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
          {/* Printing */}
          <div style={{ border: '1px solid #374151', borderRadius: '8px', overflow: 'hidden' }}>
            <h3 style={{ background: '#1f2937', padding: '12px', margin: 0, fontSize: '13px', color: '#f3f4f6', textTransform: 'uppercase' }}>Printing Operators</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <tbody>
                {getOpStats(fPre).map((op, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#10b981' }}>{op[0]}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{op[1].toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Stitching */}
          <div style={{ border: '1px solid #374151', borderRadius: '8px', overflow: 'hidden' }}>
            <h3 style={{ background: '#1f2937', padding: '12px', margin: 0, fontSize: '13px', color: '#f3f4f6', textTransform: 'uppercase' }}>Stitching Operators</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <tbody>
                {getOpStats(fSte).map((op, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#6b7280' }}>{op[0]}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{op[1].toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pouring */}
          <div style={{ border: '1px solid #374151', borderRadius: '8px', overflow: 'hidden' }}>
            <h3 style={{ background: '#1f2937', padding: '12px', margin: 0, fontSize: '13px', color: '#f3f4f6', textTransform: 'uppercase' }}>Pouring Operators</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <tbody>
                {getOpStats(fPoe).map((op, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#ec4899' }}>{op[0]}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{op[1].toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === 'Daily Production Report') {
      const topArticle = fCp.reduce((acc, r) => {
        const art = r['Article'];
        if (!art) return acc;
        acc.map[art] = (acc.map[art] || 0) + getVal(r, 'Total');
        if (acc.map[art] > acc.maxVal) { acc.maxVal = acc.map[art]; acc.top = art; }
        return acc;
      }, { map: {} as Record<string,number>, maxVal: 0, top: 'N/A' }).top;

      // Article-wise breakdown
      const articleBreakdown: Record<string, { [key:string]: number }> = {};
      [ { d: fCe, key: 'Cutting' }, { d: fPre, key: 'Printing' }, { d: fPae, key: 'Pasting' }, { d: fSte, key: 'Stitching' }, { d: fPoe, key: 'Pouring' }, { d: fQc, key: 'QC' }, { d: fMce, key: 'Packing' } ].forEach(set => {
        set.d.forEach(r => {
          const art = r['Article'] || 'Unknown';
          if (!articleBreakdown[art]) articleBreakdown[art] = { Cutting:0, Printing:0, Pasting:0, Stitching:0, Pouring:0, QC:0, Packing:0 };
          articleBreakdown[art][set.key] += getVal(r, 'Total');
        });
      });

      return (
        <div>
          {/* Combo Chart */}
          <div style={{ background: '#27272a', padding: '20px', borderRadius: '12px', border: '1px solid #3f3f46', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', color: '#f3f4f6', marginBottom: '16px' }}>Output Overview ({dateMode === 'single' ? startDate : `${startDate} to ${endDate}`})</h3>
            <div style={{ height: '350px' }}>
              <Chart 
                type='bar'
                data={{
                  labels: ['Cutting', 'Printing', 'Pasting', 'Stitching', 'Pouring', 'QC', 'Packing'],
                  datasets: [
                    {
                      type: 'line' as const,
                      label: 'Trend Line',
                      data: [totalCutting, totalPrinting, totalPasting, totalStitching, totalPouring, totalQc, totalPacking],
                      borderColor: '#facc15',
                      borderWidth: 2,
                      fill: false,
                      tension: 0.3
                    },
                    {
                      type: 'bar' as const,
                      label: 'Total Units',
                      data: [totalCutting, totalPrinting, totalPasting, totalStitching, totalPouring, totalQc, totalPacking],
                      backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#6b7280', '#ec4899', '#3b82f6', '#4b5563'],
                      borderRadius: 4
                    }
                  ]
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  scales: { y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } }, x: { grid: { display: false }, ticks: { color: '#9ca3af' } } }
                }}
              />
            </div>
          </div>

          {/* Stats Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Total Days</div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{daysInRange}</div>
            </div>
            <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Top Article</div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', color: '#93c5fd' }}>{topArticle}</div>
            </div>
            <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Avg Daily QC</div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{Math.round(totalQc / daysInRange).toLocaleString('en-IN')}</div>
            </div>
            <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Total Packed</div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{totalPacking.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Article Breakdown */}
          <div style={{ overflowX: 'auto', border: '1px solid #374151', borderRadius: '8px' }}>
            <h3 style={{ background: '#1f2937', padding: '12px', margin: 0, fontSize: '13px', color: '#f3f4f6', textTransform: 'uppercase' }}>Article-Wise Breakdown</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead style={{ background: '#27272a', color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #374151' }}>
                <tr>
                  <th style={{ padding: '12px' }}>Article</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Cutting</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Printing</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Pasting</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Stitching</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Pouring</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>QC</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Packing</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(articleBreakdown).sort((a,b) => b[1].QC - a[1].QC).map(([art, vals], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #374151' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{art}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{vals.Cutting.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{vals.Printing.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{vals.Pasting.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{vals.Stitching.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{vals.Pouring.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' }}>{vals.QC.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{vals.Packing.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === 'Analytics') {
      const topArticles = fCp.reduce((acc: any, r) => {
        acc[r['Article']] = (acc[r['Article']] || 0) + getVal(r, 'Total');
        return acc;
      }, {});
      const topArr = Object.entries(topArticles).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

      const colorMap = fCp.reduce((acc: any, r) => {
        if (!r['Colour']) return acc;
        acc[r['Colour']] = (acc[r['Colour']] || 0) + getVal(r, 'Total');
        return acc;
      }, {});
      const colorsArr = Object.entries(colorMap).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ background: '#27272a', padding: '20px', borderRadius: '12px', border: '1px solid #3f3f46' }}>
            <h3 style={{ fontSize: '14px', color: '#f3f4f6', marginBottom: '16px' }}>Top 5 Articles by Volume (in range)</h3>
            <div style={{ height: '300px' }}>
              <Bar 
                data={{
                  labels: topArr.map(a => a[0]),
                  datasets: [{
                    data: topArr.map(a => a[1]),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                  }]
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } }, x: { grid: { display: false }, ticks: { color: '#9ca3af' } } }
                }}
              />
            </div>
          </div>
          <div style={{ background: '#27272a', padding: '20px', borderRadius: '12px', border: '1px solid #3f3f46' }}>
            <h3 style={{ fontSize: '14px', color: '#f3f4f6', marginBottom: '16px' }}>Top Colors Scheduled (in range)</h3>
            <div style={{ height: '300px' }}>
              <Doughnut 
                data={{
                  labels: colorsArr.map(a => a[0]),
                  datasets: [{
                    data: colorsArr.map(a => a[1] as number),
                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'],
                    borderColor: '#27272a',
                    borderWidth: 2
                  }]
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'right', labels: { color: '#d1d5db' } } }
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    return <div style={{ color: '#9ca3af' }}>Select a tab to view data.</div>;
  };

  const getSinceTime = () => {
    if (!lastSynced) return 'never';
    const diff = Math.floor((new Date().getTime() - lastSynced.getTime()) / 60000);
    return diff === 0 ? 'just now' : `${diff} min ago`;
  };

  return (
    <div style={{ backgroundColor: '#18181b', minHeight: '100vh', color: '#f3f4f6', padding: '32px', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🏭</span> Lunar Slippers MIS Dashboard
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px' }}>Real-time Production Management System</p>
        </div>
        
        {/* Date Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#27272a', padding: '8px 16px', borderRadius: '12px', border: '1px solid #3f3f46' }} className="no-print">
          <select 
            value={dateMode} 
            onChange={e => setDateMode(e.target.value as 'single'|'range')}
            style={{ background: '#18181b', color: 'white', border: '1px solid #374151', padding: '6px 12px', borderRadius: '6px', fontSize: '13px' }}
          >
            <option value="single">Single Date</option>
            <option value="range">Date Range</option>
          </select>
          
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            style={{ background: '#18181b', color: 'white', border: '1px solid #374151', padding: '6px 12px', borderRadius: '6px', fontSize: '13px' }}
          />
          
          {dateMode === 'range' && (
            <>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>to</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                style={{ background: '#18181b', color: 'white', border: '1px solid #374151', padding: '6px 12px', borderRadius: '6px', fontSize: '13px' }}
              />
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }} className="no-print">
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            Last synced: <span style={{ color: '#d1d5db', fontWeight: 600 }}>{getSinceTime()}</span>
          </span>
          <button 
            onClick={() => window.print()}
            style={{ 
              background: '#4b5563', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', 
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            🖨️ Export PDF
          </button>
          <button 
            onClick={syncData}
            disabled={loading}
            style={{ 
              background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', 
              fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Syncing...' : '🔄 Sync Live Data'}
          </button>
        </div>
      </div>

      {loading && !lastSynced && (
        <div style={{ textAlign: 'center', padding: '64px', color: '#9ca3af' }}>
          <div className="loading-dot" />
          <div style={{ marginTop: '16px' }}>Connecting to Live Google Sheet Database...</div>
        </div>
      )}

      {(!loading || lastSynced) && (
        <>
          {/* Top Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '32px' }}>
            {[
              { title: 'CUTTING TOTAL', value: totalCutting.toLocaleString('en-IN'), sub: 'In range' },
              { title: 'PRINTING TOTAL', value: totalPrinting.toLocaleString('en-IN'), sub: 'In range' },
              { title: 'PASTING TOTAL', value: totalPasting.toLocaleString('en-IN'), sub: 'In range' },
              { title: 'POURING TOTAL', value: totalPouring.toLocaleString('en-IN'), sub: 'In range' },
              { title: 'PACKING TOTAL', value: totalPacking.toLocaleString('en-IN'), sub: 'In range' },
              { title: 'QC CLEARED', value: totalQc.toLocaleString('en-IN'), sub: `${totalDamage} damage`, isError: totalDamage > 0 }
            ].map((m, i) => (
              <div key={i} style={{ background: '#27272a', padding: '20px', borderRadius: '12px', border: '1px solid #3f3f46' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#a1a1aa', letterSpacing: '0.05em' }}>{m.title}</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>{m.value}</div>
                <div style={{ fontSize: '12px', color: m.isError ? '#ef4444' : '#10b981', marginTop: '4px' }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#27272a', padding: '20px', borderRadius: '12px', border: '1px solid #3f3f46', width: '250px', marginBottom: '32px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#a1a1aa', letterSpacing: '0.05em' }}>QC PASS RATE (IN RANGE)</div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>{qcPassRate}%</div>
            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>Based on Cutting Plan entries</div>
          </div>

          {/* Pipeline flow */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '14px', color: '#f3f4f6', marginBottom: '16px' }}>Pipeline flow ({dateMode === 'single' ? startDate : 'Date Range'})</h3>
            <div style={{ display: 'flex', gap: '16px' }}>
              {[
                { label: 'Cutting', val: totalCutting, color: '#6366f1' },
                { label: 'Printing', val: totalPrinting, color: '#10b981' },
                { label: 'Pasting', val: totalPasting, color: '#f59e0b' },
                { label: 'Stitching', val: totalStitching, color: '#6b7280' },
                { label: 'Pouring', val: totalPouring, color: '#ec4899' },
                { label: 'QC', val: totalQc, color: '#3b82f6' },
                { label: 'Packing', val: totalPacking, color: '#4b5563' }
              ].map((p, i) => (
                <div key={i} style={{ flex: 1, background: '#27272a', padding: '16px', borderRadius: '12px', border: '1px solid #3f3f46', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#d1d5db' }}>{p.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '8px', marginBottom: '12px' }}>{p.val.toLocaleString('en-IN')}</div>
                  <div style={{ background: '#374151', height: '4px', borderRadius: '2px', width: '80%', margin: '0 auto', overflow: 'hidden' }}>
                    <div style={{ background: p.color, height: '100%', width: Math.min(100, (p.val / (3000 * daysInRange)) * 100) + '%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #3f3f46', marginBottom: '24px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Overview', 'Cutting Plan', 'QC Tracker', 'Pouring Entry', 'Packing Entry', 'Daily Production Report', 'Operator Report', 'Analytics'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: activeTab === tab ? '#3f3f46' : 'transparent',
                    color: activeTab === tab ? '#f3f4f6' : '#9ca3af',
                    border: '1px solid',
                    borderColor: activeTab === tab ? '#52525b' : 'transparent',
                    padding: '8px 20px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: '16px'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            {/* Global Search */}
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search Unique ID..." 
                onChange={e => {
                  const val = e.target.value.trim().toUpperCase();
                  if (val) {
                    const lot = cuttingPlan.find(r => r['Unique ID'] === val); // Look in global unfiltered plan for search
                    if (lot) {
                      alert(`Lot: ${val}\nArticle: ${lot['Article']} - ${lot['Colour']}\nTotal: ${lot['Total']}\nCutting: ${lot['Cutting Completed'] || 'Pending'}\nPrinting: ${lot['Printing Completed'] || 'Pending'}\nQC: ${lot['QC Completed'] || 'Pending'}`);
                    }
                  }
                }}
                style={{ 
                  background: '#27272a', border: '1px solid #3f3f46', color: 'white', 
                  padding: '8px 16px', borderRadius: '20px', fontSize: '13px', width: '200px'
                }}
              />
            </div>
          </div>

          {/* Tab Content */}
          {renderTabContent()}

        </>
      )}
    </div>
  );
}
