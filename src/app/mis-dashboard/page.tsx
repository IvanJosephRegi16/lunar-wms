'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const GOOGLE_SHEET_ID = '1ErWGgNjV-aBSj25nVMRO-dVuRiMIFd5OgvrwCN5Xegg';
const getCsvUrl = (sheetName: string) => `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

export default function MISDashboard() {
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('Overview');

  // Sheet Data States
  const [statusData, setStatusData] = useState<any[]>([]);
  const [qcData, setQcData] = useState<any[]>([]);
  const [cuttingPlan, setCuttingPlan] = useState<any[]>([]);
  const [dailyReport, setDailyReport] = useState<any[]>([]);

  // Individual Entries
  const [cuttingEntry, setCuttingEntry] = useState<any[]>([]);
  const [printingEntry, setPrintingEntry] = useState<any[]>([]);
  const [pastingEntry, setPastingEntry] = useState<any[]>([]);
  const [stitchingEntry, setStitchingEntry] = useState<any[]>([]);
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
        st, qc, cp, dr,
        ce, pre, pae, ste, mce
      ] = await Promise.all([
        fetchSheet('status'),
        fetchSheet('QC'),
        fetchSheet('Cutting_Plan'),
        fetchSheet('dailyreport data'),
        fetchSheet('Cutting_Entry'),
        fetchSheet('Printing_Entry'),
        fetchSheet('Pasting_Entry'),
        fetchSheet('Stiching_Entry'),
        fetchSheet('MC_Entry')
      ]);

      setStatusData(st);
      setQcData(qc);
      setCuttingPlan(cp);
      setDailyReport(dr);
      setCuttingEntry(ce);
      setPrintingEntry(pre);
      setPastingEntry(pae);
      setStitchingEntry(ste);
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
      // Silent refresh
      syncData();
    }, 15 * 60 * 1000); // 15 mins
    return () => clearInterval(interval);
  }, []);

  const getTodayStr = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);
    // Note: Depends on sheet date format. Usually DD/MM/YY or DD-MMM-YY
    return `${dd}-${mm}-${yy}`; 
  };

  // Safe parse
  const getVal = (row: any, key: string) => {
    const v = row[key];
    if (!v || v.trim() === '' || v.toUpperCase() === 'NIL') return 0;
    return parseInt(v.replace(/,/g, ''), 10) || 0;
  };

  // Metrics Calculation
  const totalCuttingToday = cuttingEntry.reduce((sum, r) => sum + getVal(r, 'Total'), 0);
  const totalPrintingToday = printingEntry.reduce((sum, r) => sum + getVal(r, 'Total'), 0);
  const totalPastingToday = pastingEntry.reduce((sum, r) => sum + getVal(r, 'Total'), 0);
  const totalStitchingToday = stitchingEntry.reduce((sum, r) => sum + getVal(r, 'Total'), 0);
  const totalQcToday = qcData.reduce((sum, r) => sum + getVal(r, 'Total'), 0);
  const totalPackingToday = mcEntry.reduce((sum, r) => {
    // packing sum might require custom logic based on ratio
    return sum + getVal(r, 'Total'); 
  }, 0);

  const totalDamage = qcData.reduce((sum, r) => sum + getVal(r, 'Damage'), 0);
  const totalQcPairs = qcData.reduce((sum, r) => sum + getVal(r, 'QC Qty') || getVal(r, 'Total'), 0);
  const qcPassRate = totalQcPairs > 0 ? (((totalQcPairs - totalDamage) / totalQcPairs) * 100).toFixed(1) : '100.0';
  
  const activeLots = cuttingPlan.filter(r => {
    const t = getVal(r, 'Total');
    const qc = getVal(r, 'QC Completed');
    return t > 0 && qc < t; // Not fully QC'd
  }).length;

  const renderTabContent = () => {
    if (activeTab === 'Overview') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>Section efficiency — today</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: 'Cutting', val: totalCuttingToday, max: 3000, color: '#6366f1' },
                { label: 'Printing', val: totalPrintingToday, max: 3000, color: '#10b981' },
                { label: 'Pasting', val: totalPastingToday, max: 3000, color: '#f59e0b' },
                { label: 'QC', val: totalQcToday, max: 3000, color: '#3b82f6' }
              ].map(s => {
                const pct = Math.min(100, Math.round((s.val / s.max) * 100));
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
                  labels: ['Cutting', 'Printing', 'Pasting', 'QC'],
                  datasets: [{
                    data: [totalCuttingToday, totalPrintingToday, totalPastingToday, totalQcToday],
                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#3b82f6'],
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
            <h3 style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>QC summary — recent lots</h3>
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
                  {qcData.slice(-10).reverse().map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{r['Unique ID']}</td>
                      <td style={{ padding: '12px' }}>{r['Article']}</td>
                      <td style={{ padding: '12px' }}>{r['Colour']}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{getVal(r, 'Total').toLocaleString()}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: getVal(r, 'Damage') > 0 ? '#ef4444' : 'inherit' }}>{getVal(r, 'Damage') || 0}</td>
                    </tr>
                  ))}
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
              {cuttingPlan.slice(-20).reverse().map((r, i) => {
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
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{getVal(r, 'Total').toLocaleString()}</td>
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
      const totalQcValue = qcData.reduce((sum, r) => sum + (getVal(r, 'Total') * (parseFloat(r['Rate']) || 0)), 0);
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
              {qcData.slice(-30).reverse().map((r, i) => {
                const qty = getVal(r, 'Total');
                const rate = parseFloat(r['Rate']) || 0;
                const damage = getVal(r, 'Damage');
                return (
                  <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                    <td style={{ padding: '12px' }}>{r['Date']}</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{r['Unique ID']}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#93c5fd' }}>{r['Article']}</td>
                    <td style={{ padding: '12px' }}>{r['Colour']}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{qty.toLocaleString()}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: damage > 0 ? '#ef4444' : 'inherit', fontWeight: damage > 0 ? 800 : 400 }}>{damage}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{getVal(r, 'Shortages')}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{rate.toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{(qty * rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                )
              })}
              <tr style={{ background: '#1f2937', fontWeight: 800 }}>
                <td colSpan={8} style={{ padding: '12px', textAlign: 'right' }}>TOTAL RECENT QC VALUE:</td>
                <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: '#10b981' }}>₹{totalQcValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'Alerts') {
      const damages = qcData.filter(r => getVal(r, 'Damage') > 0).slice(-10).reverse();
      const overdue = cuttingPlan.filter(r => {
        const d = r['Date']; // e.g. "10-Jun-26"
        const qcDone = getVal(r, 'QC Completed') > 0;
        return !qcDone && d && r['Cutting Completed'] && r['Cutting Completed'] !== 'NIL';
      }).slice(-10);

      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ background: '#27272a', border: '1px solid #ef4444', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ color: '#ef4444', fontSize: '15px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span> Recent QC Damages
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {damages.map((d, i) => (
                <div key={i} style={{ background: '#18181b', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#f3f4f6' }}>Lot: {d['Unique ID']}</span>
                    <span style={{ color: '#ef4444', fontWeight: 800 }}>{getVal(d, 'Damage')} Damaged</span>
                  </div>
                  <div style={{ color: '#9ca3af' }}>{d['Article']} - {d['Colour']}</div>
                  {d['Remarks'] && <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>Reason: {d['Remarks']}</div>}
                </div>
              ))}
              {damages.length === 0 && <div style={{ color: '#9ca3af' }}>No recent damages found.</div>}
            </div>
          </div>

          <div style={{ background: '#27272a', border: '1px solid #f59e0b', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ color: '#f59e0b', fontSize: '15px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⏳</span> Overdue for QC (Cutting Done)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {overdue.map((o, i) => (
                <div key={i} style={{ background: '#18181b', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#f3f4f6' }}>Lot: {o['Unique ID']}</span>
                    <span style={{ color: '#f59e0b', fontWeight: 800 }}>Pending</span>
                  </div>
                  <div style={{ color: '#9ca3af' }}>{o['Article']} - {o['Colour']} ({getVal(o, 'Total')} pairs)</div>
                  <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>Started: {o['Date']}</div>
                </div>
              ))}
              {overdue.length === 0 && <div style={{ color: '#9ca3af' }}>No overdue lots found.</div>}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'Analytics') {
      const topArticles = cuttingPlan.reduce((acc: any, r) => {
        acc[r['Article']] = (acc[r['Article']] || 0) + getVal(r, 'Total');
        return acc;
      }, {});
      const topArr = Object.entries(topArticles).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

      const colorMap = cuttingPlan.reduce((acc: any, r) => {
        if (!r['Colour']) return acc;
        acc[r['Colour']] = (acc[r['Colour']] || 0) + getVal(r, 'Total');
        return acc;
      }, {});
      const colorsArr = Object.entries(colorMap).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ background: '#27272a', padding: '20px', borderRadius: '12px', border: '1px solid #3f3f46' }}>
            <h3 style={{ fontSize: '14px', color: '#f3f4f6', marginBottom: '16px' }}>Top 5 Articles by Volume</h3>
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
            <h3 style={{ fontSize: '14px', color: '#f3f4f6', marginBottom: '16px' }}>Top Colors Scheduled</h3>
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

    if (activeTab === 'Daily Report') {
      return (
        <div style={{ overflowX: 'auto', border: '1px solid #374151', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead style={{ background: '#1f2937', color: '#9ca3af', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Section</th>
                <th style={{ padding: '12px' }}>Article</th>
                <th style={{ padding: '12px' }}>Colour</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total Output</th>
              </tr>
            </thead>
            <tbody>
              {dailyReport.slice(-30).reverse().map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                  <td style={{ padding: '12px' }}>{r['Date'] || '-'}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{r['Section'] || '-'}</td>
                  <td style={{ padding: '12px' }}>{r['Article'] || '-'}</td>
                  <td style={{ padding: '12px' }}>{r['Colour'] || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{getVal(r, 'Total').toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'Operator Report') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ border: '1px solid #374151', borderRadius: '8px', overflow: 'hidden' }}>
            <h3 style={{ background: '#1f2937', padding: '12px', margin: 0, fontSize: '13px', color: '#f3f4f6', textTransform: 'uppercase' }}>Printing Operators</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <tbody>
                {printingEntry.slice(-15).reverse().map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#10b981' }}>{r['Operator'] || 'Unknown'}</td>
                    <td style={{ padding: '12px' }}>{r['Article']}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{getVal(r, 'Total').toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ border: '1px solid #374151', borderRadius: '8px', overflow: 'hidden' }}>
            <h3 style={{ background: '#1f2937', padding: '12px', margin: 0, fontSize: '13px', color: '#f3f4f6', textTransform: 'uppercase' }}>Stitching Operators</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <tbody>
                {stitchingEntry.slice(-15).reverse().map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#6b7280' }}>{r['Operator'] || 'Unknown'}</td>
                    <td style={{ padding: '12px' }}>{r['Article']}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{getVal(r, 'Total').toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === 'Packing Tracker') {
      return (
        <div style={{ overflowX: 'auto', border: '1px solid #374151', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead style={{ background: '#1f2937', color: '#9ca3af', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '12px' }}>Packed By</th>
                <th style={{ padding: '12px' }}>Article</th>
                <th style={{ padding: '12px' }}>Colour</th>
                <th style={{ padding: '12px' }}>Ratio</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total Pairs</th>
              </tr>
            </thead>
            <tbody>
              {mcEntry.slice(-30).reverse().map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #374151' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{r['Packed By'] || '-'}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: '#93c5fd' }}>{r['Article'] || '-'}</td>
                  <td style={{ padding: '12px' }}>{r['Colour'] || '-'}</td>
                  <td style={{ padding: '12px', fontFamily: 'monospace' }}>{r['Ratio'] || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{getVal(r, 'Total').toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🏭</span> Lunar Slippers MIS Dashboard
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px' }}>Real-time Production Management System</p>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
            {[
              { title: 'CUTTING TODAY', value: totalCuttingToday.toLocaleString(), sub: '↑ from sheet' },
              { title: 'PRINTING TODAY', value: totalPrintingToday.toLocaleString(), sub: '↑ from sheet' },
              { title: 'PASTING TODAY', value: totalPastingToday.toLocaleString(), sub: '↑ from sheet' },
              { title: 'QC CLEARED', value: totalQcToday.toLocaleString(), sub: `${totalDamage} damage`, isError: totalDamage > 0 },
              { title: 'ACTIVE LOTS', value: activeLots, sub: 'in Cutting Plan' }
            ].map((m, i) => (
              <div key={i} style={{ background: '#27272a', padding: '20px', borderRadius: '12px', border: '1px solid #3f3f46' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#a1a1aa', letterSpacing: '0.05em' }}>{m.title}</div>
                <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>{m.value}</div>
                <div style={{ fontSize: '12px', color: m.isError ? '#ef4444' : '#10b981', marginTop: '4px' }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#27272a', padding: '20px', borderRadius: '12px', border: '1px solid #3f3f46', width: '250px', marginBottom: '32px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#a1a1aa', letterSpacing: '0.05em' }}>QC PASS RATE</div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>{qcPassRate}%</div>
            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>Target ≥98%</div>
          </div>

          {/* Pipeline flow */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '14px', color: '#f3f4f6', marginBottom: '16px' }}>Today's pipeline flow</h3>
            <div style={{ display: 'flex', gap: '16px' }}>
              {[
                { label: 'Cutting', val: totalCuttingToday, color: '#6366f1' },
                { label: 'Printing', val: totalPrintingToday, color: '#10b981' },
                { label: 'Pasting', val: totalPastingToday, color: '#f59e0b' },
                { label: 'Stitching', val: totalStitchingToday, color: '#6b7280' },
                { label: 'QC', val: totalQcToday, color: '#3b82f6' },
                { label: 'Packing', val: totalPackingToday, color: '#4b5563' }
              ].map((p, i) => (
                <div key={i} style={{ flex: 1, background: '#27272a', padding: '16px', borderRadius: '12px', border: '1px solid #3f3f46', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#d1d5db' }}>{p.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '8px', marginBottom: '12px' }}>{p.val.toLocaleString()}</div>
                  <div style={{ background: '#374151', height: '4px', borderRadius: '2px', width: '80%', margin: '0 auto', overflow: 'hidden' }}>
                    <div style={{ background: p.color, height: '100%', width: Math.min(100, (p.val / 3000) * 100) + '%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #3f3f46', marginBottom: '24px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Overview', 'Cutting Plan', 'QC Tracker', 'Alerts', 'Analytics', 'Daily Report', 'Operator Report', 'Packing Tracker'].map(tab => (
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
                    const lot = cuttingPlan.find(r => r['Unique ID'] === val);
                    if (lot) {
                      // Switch to cutting plan or a generic view. Just filtering is complex for all tabs,
                      // but we can alert the user with the journey status.
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
