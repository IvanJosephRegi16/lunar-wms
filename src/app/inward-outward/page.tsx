'use client';

import { useState, useEffect, useMemo } from 'react';

export default function InwardOutward() {
  const [dailyTotals, setDailyTotals] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily'|'article'>('daily');

  // New Search States
  const [articleSearch, setArticleSearch] = useState('');
  const [colourSearch, setColourSearch] = useState('');

  const loadData = () => {
    setLoading(true);
    fetch('/api/inward-outward')
      .then(res => res.json())
      .then(d => {
        setDailyTotals(d.dailyTotals || []);
        setSummary(d.summary || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  // Filtering Logic
  const filteredSummary = useMemo(() => {
    return summary.filter(s => 
      String(s.article_code).toLowerCase().includes(articleSearch.toLowerCase()) &&
      String(s.colour).toLowerCase().includes(colourSearch.toLowerCase())
    );
  }, [summary, articleSearch, colourSearch]);

  if (loading) return <div className="loading-dot" style={{ margin: '100px auto', display: 'table' }}>Calculating Flux Vectors...</div>;

  return (
    <div className="fade-up">
      {/* PROFESSIONAL TAB NAVIGATION */}
      <div className="flex-between mb-8 no-print">
        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
           <button className={`nav-tab ${activeTab === 'daily' ? 'active' : ''}`} onClick={() => setActiveTab('daily')}>Date-wise Summary</button>
           <button className={`nav-tab ${activeTab === 'article' ? 'active' : ''}`} onClick={() => setActiveTab('article')}>Article-wise Summary</button>
        </div>
        <button className="btn-corp btn-primary-corp" onClick={loadData}>Refresh Data</button>
      </div>

      <div className="card-clean" style={{ borderLeft: '4px solid var(--primary)', background: '#eff6ff', padding: '20px 32px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
           <span style={{ fontSize: '24px' }}>💡</span>
           <p style={{ fontSize: '13px', color: '#1e40af', fontWeight: 500, lineHeight: '1.6' }}>
             Historical delta of your warehouse. 
             <strong> Inward</strong> includes Production, Machine Returns, and Open Stock. 
             <strong> Outward</strong> tracks all dispatches.
           </p>
        </div>
      </div>

      <div className="card-clean" style={{ padding: '0' }}>
         <div style={{ padding: '32px 32px 16px 32px', borderBottom: '1px solid var(--border)' }}>
            <div className="flex-between">
               <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800 }}>{activeTab === 'daily' ? 'Chronological Flow Summary' : 'Article-wise Flow Analysis'}</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Logistics metrics processed from all active transaction units.</p>
               </div>
               
               {/* SEARCH INPUTS FOR ARTICLE TAB */}
               {activeTab === 'article' && (
                 <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="corp-search" style={{ position: 'relative' }}>
                       <span>🔍</span>
                       <input 
                         type="text" 
                         placeholder="Article..." 
                         value={articleSearch} 
                         onChange={e => setArticleSearch(e.target.value)} 
                         style={{ paddingRight: '28px' }}
                       />
                       {articleSearch && (
                         <button 
                           onClick={() => setArticleSearch('')} 
                           style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-ghost)', fontSize: '11px', padding: '4px' }}
                         >
                           ✖
                         </button>
                       )}
                    </div>
                    <div className="corp-search" style={{ position: 'relative' }}>
                       <span>🔍</span>
                       <input 
                         type="text" 
                         placeholder="Colour..." 
                         value={colourSearch} 
                         onChange={e => setColourSearch(e.target.value)} 
                         style={{ paddingRight: '28px' }}
                       />
                       {colourSearch && (
                         <button 
                           onClick={() => setColourSearch('')} 
                           style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-ghost)', fontSize: '11px', padding: '4px' }}
                         >
                           ✖
                         </button>
                       )}
                    </div>
                    {(articleSearch || colourSearch) && (
                      <button 
                        className="btn-corp" 
                        onClick={() => { setArticleSearch(''); setColourSearch(''); }}
                        style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--danger)', borderColor: 'var(--danger)', borderRadius: '8px' }}
                      >
                        Clear All
                      </button>
                    )}
                 </div>
               )}
            </div>
         </div>

         <div className="scroll-table-wrapper" style={{ overflowY: 'auto', maxHeight: '600px', overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
            {activeTab === 'daily' ? (
               <table className="table-corporate" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: 'inset 0 -1px 0 var(--border)' }}>Date</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: 'inset 0 -1px 0 var(--border)' }}>Weekday</th>
                    <th className="num-mono" style={{ textAlign: 'right', color: 'var(--success)', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: 'inset 0 -1px 0 var(--border)' }}>Total Inward</th>
                    <th className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: 'inset 0 -1px 0 var(--border)' }}>Total Outward</th>
                    <th className="num-mono" style={{ textAlign: 'right', backgroundColor: '#f8fafc', width: '200px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: 'inset 0 -1px 0 var(--border)' }}>Daily Net Change</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyTotals.map((d, i) => {
                    const dateObj = new Date(d.sheet_date);
                    const net = (Number(d.inward_total) || 0) - (Number(d.outward_total) || 0);
                    return (
                     <tr key={i} className="tr-hover">
                       <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{d.sheet_date}</td>
                       <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{dateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' })}</td>
                       <td className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{(d.inward_total || 0).toLocaleString()}</td>
                       <td className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>{(d.outward_total || 0).toLocaleString()}</td>
                       <td className="num-mono" style={{ textAlign: 'right', background: '#f8fafc', fontWeight: 800, fontSize: '16px' }}>
                         <span style={{
                           display: 'inline-block',
                           padding: '4px 12px',
                           borderRadius: '20px',
                           fontWeight: 800,
                           fontSize: '13px',
                           background: net >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                           color: net >= 0 ? 'var(--success)' : 'var(--danger)',
                         }}>
                           {net > 0 ? '+' : ''}{net.toLocaleString()}
                         </span>
                       </td>
                     </tr>
                    );
                  })}
                </tbody>
               </table>
            ) : (
               <table className="table-corporate bordered" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: 'inset 0 -1px 0 var(--border)' }}>Article Code</th>
                    <th style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: 'inset 0 -1px 0 var(--border)' }}>Spectrum</th>
                    <th style={{ textAlign: 'center', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: 'inset 0 -1px 0 var(--border)' }}>Unit Size</th>
                    <th className="num-mono" style={{ textAlign: 'right', color: 'var(--success)', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: 'inset 0 -1px 0 var(--border)' }}>Total Inward</th>
                    <th className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: 'inset 0 -1px 0 var(--border)' }}>Total Outward</th>
                    <th className="num-mono" style={{ textAlign: 'right', backgroundColor: '#f8fafc', fontWeight: 800, position: 'sticky', top: 0, zIndex: 10, borderBottom: '2px solid var(--border)', boxShadow: 'inset 0 -1px 0 var(--border)' }}>Asset Inventory</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.map((s, i) => (
                    <tr key={i} className="tr-hover">
                      <td style={{ fontWeight: 700, fontSize: '15px' }}>{s.article_code}</td>
                      <td style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px', fontWeight: 600 }}>{s.colour}</td>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--primary)', background: '#f1f5f930' }}>{s.size || '-'}</td>
                      <td className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{(s.total_inward || 0).toLocaleString()}</td>
                      <td className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>{(s.total_outward || 0).toLocaleString()}</td>
                      <td className="num-mono" style={{ textAlign: 'right', background: '#f8fafc', fontWeight: 800, fontSize: '16px', color: 'var(--primary)' }}>
                        {((Number(s.total_inward) || 0) - (Number(s.total_outward) || 0)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {filteredSummary.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-ghost)' }}>No articles found matching filters.</td>
                    </tr>
                  )}
                </tbody>
               </table>
            )}
         </div>
      </div>

      <style jsx>{`
        .nav-tab { padding: 8px 16px; border-radius: 6px; border: none; background: transparent; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--text-muted); transition: 0.2s; }
        .nav-tab.active { background: white; color: var(--text-main); box-shadow: var(--shadow-sm); }
        .corp-search { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid var(--border); padding: 0 16px; border-radius: 8px; }
        .corp-search input { background: transparent; border: none; padding: 10px 0; outline: none; width: 120px; color: var(--text-main); font-size: 13px; font-weight: 600; }
      `}</style>
    </div>
  );
}
