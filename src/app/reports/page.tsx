'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatToIST } from '@/lib/dateUtils';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'final_report'|'final_sheet'>('final_report');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [globalSearch, setGlobalSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?type=${activeTab}`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, [activeTab]);

  const handlePrint = () => window.print();

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const processedData = useMemo(() => {
    const rawList = activeTab === 'final_report' ? (data?.data || []) : (data?.dailySummary || []);
    if (!rawList) return [];

    let result = rawList.filter((item: any) => {
      const globalMatch = !globalSearch || Object.values(item).some(val => String(val).toLowerCase().includes(globalSearch.toLowerCase()));
      if (!globalMatch) return false;
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        return String(item[key] || '').toLowerCase().includes(value.toLowerCase());
      });
    });

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a: any, b: any) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (!isNaN(Number(valA)) && !isNaN(Number(valB))) { valA = Number(valA); valB = Number(valB); }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, activeTab, filters, sortConfig, globalSearch]);

  const resetFilters = () => {
     setFilters({});
     setGlobalSearch('');
     setSortConfig({ key: '', direction: null });
  };

  if (loading) return <div className="loading-dot" style={{ margin: '100px auto', display: 'table' }}>Synchronizing Ledger Data...</div>;

  return (
    <div>
      {/* PROFESSIONAL TAB NAVIGATION */}
      <div className="flex-between mb-8 no-print">
        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
           <button className={`nav-tab ${activeTab === 'final_report' ? 'active' : ''}`} onClick={() => { setActiveTab('final_report'); resetFilters(); }}>Inventory Balance</button>
           <button className={`nav-tab ${activeTab === 'final_sheet' ? 'active' : ''}`} onClick={() => { setActiveTab('final_sheet'); resetFilters(); }}>Production Logs</button>
        </div>
        <div className="flex gap-4">
           <div className="corp-search">
              <span>🔍</span>
              <input type="text" placeholder="Global filter..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} />
           </div>
           <button className="btn-corp btn-primary-corp" onClick={handlePrint}>Print Report</button>
        </div>
      </div>

      <div className="card-clean">
         <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '32px', marginBottom: '32px' }}>
            <div className="flex-between mb-4">
               <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Document: {activeTab === 'final_report' ? 'RE_INV_CONSOL_01' : 'RE_PROD_LEDR_01'}</span>
               <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>Timestamp: {formatToIST(new Date())}</span>
            </div>
            <h2 className="title-main" style={{ fontSize: '24px' }}>{activeTab === 'final_report' ? 'Consolidated Warehouse Asset Report' : 'Daily Production Transaction Ledger'}</h2>
         </div>

         <div style={{ overflowX: 'auto' }}>
            <table className="table-corporate bordered">
               <thead>
                  <tr>
                     <th onClick={() => handleSort(activeTab==='final_report'?'last_activity':'sheet_date')} style={{ cursor: 'pointer' }}>Date {sortConfig.key===(activeTab==='final_report'?'last_activity':'sheet_date') && (sortConfig.direction==='asc'?'↑':'↓')}</th>
                     <th onClick={() => handleSort('article_code')} style={{ cursor: 'pointer' }}>Article {sortConfig.key==='article_code' && (sortConfig.direction==='asc'?'↑':'↓')}</th>
                     <th onClick={() => handleSort('colour')} style={{ cursor: 'pointer' }}>Colour {sortConfig.key==='colour' && (sortConfig.direction==='asc'?'↑':'↓')}</th>
                     <th className="num-mono" style={{ textAlign: 'right' }}>Sz 5</th>
                     <th className="num-mono" style={{ textAlign: 'right' }}>Sz 6</th>
                     <th className="num-mono" style={{ textAlign: 'right' }}>Sz 7</th>
                     <th className="num-mono" style={{ textAlign: 'right' }}>Sz 8</th>
                     <th className="num-mono" style={{ textAlign: 'right' }}>Sz 9</th>
                     <th className="num-mono" style={{ textAlign: 'right' }}>Sz 10</th>
                     <th className="num-mono" style={{ textAlign: 'right' }}>Sz 11</th>
                     <th className="num-mono" style={{ textAlign: 'right' }}>Sz 12</th>
                     <th className="num-mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{activeTab === 'final_report' ? 'BALANCE' : 'NET_FLOW'}</th>
                  </tr>
                  <tr className="no-print">
                     <td><input type="date" className="nano-input" value={activeTab==='final_report'?filters.last_activity:filters.sheet_date} onChange={e => setFilters({...filters, [activeTab==='final_report'?'last_activity':'sheet_date']: e.target.value})} /></td>
                     <td><input type="text" className="nano-input" placeholder="Filter..." value={filters.article_code||''} onChange={e => setFilters({...filters, article_code: e.target.value})} /></td>
                     <td><input type="text" className="nano-input" placeholder="Filter..." value={filters.colour||''} onChange={e => setFilters({...filters, colour: e.target.value})} /></td>
                     <td colSpan={9}></td>
                  </tr>
               </thead>
               <tbody>
                  {processedData.map((r: any, i: number) => (
                    <tr key={i} className="tr-hover">
                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{activeTab === 'final_report' ? r.last_activity : r.sheet_date}</td>
                        <td style={{ fontWeight: 700 }}>{r.article_code}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase' }}>{r.colour}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: r.s5 < 0 ? 'var(--danger)' : 'inherit' }}>{r.s5 || '-'}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: r.s6 < 0 ? 'var(--danger)' : 'inherit' }}>{r.s6 || '-'}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: r.s7 < 0 ? 'var(--danger)' : 'inherit' }}>{r.s7 || '-'}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: r.s8 < 0 ? 'var(--danger)' : 'inherit' }}>{r.s8 || '-'}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: r.s9 < 0 ? 'var(--danger)' : 'inherit' }}>{r.s9 || '-'}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: r.s10 < 0 ? 'var(--danger)' : 'inherit' }}>{r.s10 || '-'}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: r.s11 < 0 ? 'var(--danger)' : 'inherit' }}>{r.s11 || '-'}</td>
                        <td className="num-mono" style={{ textAlign: 'right', color: r.s12 < 0 ? 'var(--danger)' : 'inherit' }}>{r.s12 || '-'}</td>
                        <td className="num-mono" style={{ textAlign: 'right', fontWeight: 800, fontSize: '15px', color: (activeTab === 'final_report' ? r.net_stock : r.total_added) < 0 ? 'var(--danger)' : 'var(--primary)' }}>
                           {activeTab === 'final_report' ? r.net_stock : r.total_added}
                        </td>
                    </tr>
                  ))}
               </tbody>
               <tfoot style={{ background: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                  <tr style={{ fontWeight: 800 }}>
                    <td colSpan={3} style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Dynamic dataset summation</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>{processedData.reduce((a:any,c:any)=>a+(c.s5||0), 0).toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>{processedData.reduce((a:any,c:any)=>a+(c.s6||0), 0).toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>{processedData.reduce((a:any,c:any)=>a+(c.s7||0), 0).toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>{processedData.reduce((a:any,c:any)=>a+(c.s8||0), 0).toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>{processedData.reduce((a:any,c:any)=>a+(c.s9||0), 0).toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>{processedData.reduce((a:any,c:any)=>a+(c.s10||0), 0).toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>{processedData.reduce((a:any,c:any)=>a+(c.s11||0), 0).toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right' }}>{processedData.reduce((a:any,c:any)=>a+(c.s12||0), 0).toLocaleString()}</td>
                    <td className="num-mono" style={{ textAlign: 'right', fontSize: '18px', color: 'var(--primary)' }}>
                      {processedData.reduce((a:any,c:any)=>a+(activeTab==='final_report'?c.net_stock:c.total_added), 0).toLocaleString()}
                    </td>
                  </tr>
               </tfoot>
            </table>
         </div>

         {activeTab === 'final_report' && (
            <div className="grid grid-2" style={{ marginTop: '32px' }}>
               <div style={{ padding: '20px', background: '#f1f5f9', borderRadius: '8px', borderLeft: '4px solid var(--success)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>V-Strap Total Inbound</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--success)' }}>+{data?.vStrapSummary?.total_inward || 0}</div>
               </div>
               <div style={{ padding: '20px', background: '#f1f5f9', borderRadius: '8px', borderLeft: '4px solid var(--danger)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>V-Strap Total Outbound</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--danger)' }}>-{data?.vStrapSummary?.total_outward || 0}</div>
               </div>
            </div>
         )}
      </div>

      <style jsx>{`
        .nav-tab { padding: 8px 16px; border-radius: 6px; border: none; background: transparent; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--text-muted); transition: 0.2s; }
        .nav-tab.active { background: white; color: var(--text-main); box-shadow: var(--shadow-sm); }
        .corp-search { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid var(--border); padding: 0 16px; border-radius: 8px; }
        .corp-search input { background: transparent; border: none; padding: 10px 0; outline: none; width: 200px; color: var(--text-main); font-size: 14px; }
        .nano-input { width: 100%; border: 1px solid var(--border); padding: 6px 10px; border-radius: 4px; font-size: 11px; outline: none; font-family: inherit; }
        .nano-input:focus { border-color: var(--primary); }
      `}</style>
    </div>
  );
}
