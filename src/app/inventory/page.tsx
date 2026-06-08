'use client';

import React, { useState, useEffect } from 'react';
import { downloadCSV } from '@/lib/exportCSV';
import ExportDropdown from '@/components/ExportDropdown';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [articleSearch, setArticleSearch] = useState('');
  const [colourSearch, setColourSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const loadInventory = () => {
    setLoading(true);
    fetch('/api/inventory')
      .then(res => res.json())
      .then(d => {
        setInventory(d.inventory || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleDeleteArticle = async (article: string, colour: string) => {
    if (!window.confirm(`PERMANENT SYSTEM-WIDE DELETE: ${article} [${colour}]\n\nThis will remove this article from ALL daily logs and the inventory hub.\nAre you sure?`)) return;
    
    try {
      const res = await fetch(`/api/daily?article_code=${encodeURIComponent(article)}&colour=${encodeURIComponent(colour)}&global=true`, { method: 'DELETE' });
      if (res.ok) {
        loadInventory();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (e) {
      alert('Failed to connect to server.');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="loading-dot" style={{ margin: '100px auto', display: 'table' }}>Scanning Distribution Hub...</div>;

  const groupedData: Record<string, any> = {};
  inventory.forEach(item => {
    const key = `${item.article_code}|${item.colour}`;
    if (!groupedData[key]) {
      groupedData[key] = {
        article_code: item.article_code,
        colour: item.colour,
        total_initial: 0,
        total_inward: 0,
        total_outward: 0,
        total_available: 0,
        sizes: []
      };
    }
    const g = groupedData[key];
    g.sizes.push(item);
    g.total_initial += (item.initial_opening || 0);
    g.total_inward += (item.total_inward || 0);
    g.total_outward += (item.total_outward || 0);
    g.total_available += (item.available_stock || 0);
  });

  const filteredGroups = Object.values(groupedData).filter((g: any) => {
    const matchArticle = String(g.article_code).toLowerCase().includes(articleSearch.toLowerCase());
    const matchColour = String(g.colour).toLowerCase().includes(colourSearch.toLowerCase());
    return matchArticle && matchColour;
  });

  const getExportData = () => {
    const headers = ['Article Code', 'Colour', 'Size', 'Initial Stock', 'Total Inward', 'Machine Return', 'Semi Finished', 'Total Outward', 'Available Balance', 'Export Date/Time'];
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const rows: any[][] = [];
    inventory.forEach(item => {
      rows.push([
        item.article_code,
        item.colour,
        item.size,
        item.initial_opening || 0,
        item.total_inward || 0,
        item.total_machine_return || 0,
        item.total_semi_finished || 0,
        item.total_outward || 0,
        item.available_stock || 0,
        now
      ]);
    });
    return { headers, rows, filename: `Live_Inventory_${new Date().toISOString().slice(0,10)}` };
  };

  const exportData = getExportData();

  return (
    <div className="fade-up">
      <div className="flex-between mb-8">
        <div>
           <h1 className="title-main">Live Inventory Hub</h1>
           <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Real-time stock equilibrium monitoring and asset distribution.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <ExportDropdown 
            filename={exportData.filename}
            headers={exportData.headers}
            rows={exportData.rows}
          />
          <button className="btn-corp btn-primary-corp" onClick={loadInventory}>Synchronize</button>
        </div>
      </div>

      <div className="card-clean" style={{ padding: '0' }}>
         <div style={{ overflowX: 'auto' }}>
            <table className="table-corporate bordered">
               <thead>
                  <tr>
                     <th style={{ width: '60px' }}></th>
                     <th>
                        <div style={{ marginBottom: '8px' }}>Logistics ID</div>
                        <input type="text" className="nano-input" placeholder="Filter..." value={articleSearch} onChange={e => setArticleSearch(e.target.value)} />
                     </th>
                     <th>
                        <div style={{ marginBottom: '8px' }}>Spectrum</div>
                        <input type="text" className="nano-input" placeholder="Filter..." value={colourSearch} onChange={e => setColourSearch(e.target.value)} />
                     </th>
                     <th className="num-mono" style={{ textAlign: 'right' }}>INITIAL</th>
                     <th className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>INWARD</th>
                     <th className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>OUTWARD</th>
                     <th className="num-mono" style={{ textAlign: 'right', background: '#f8fafc', fontWeight: 800 }}>EQUITY BAL</th>
                     <th className="num-mono" style={{ textAlign: 'right' }}>PRICE</th>
                     <th style={{ width: '80px', textAlign: 'center' }} className="no-print">DELETE</th>
                  </tr>
               </thead>
               <tbody>
                  {filteredGroups.map((group: any, idx) => {
                    const id = `${group.article_code}|${group.colour}`;
                    const isExpanded = expandedRows.has(id);
                    return (
                      <React.Fragment key={id}>
                         <tr className="tr-hover" onClick={() => toggleExpand(id)} style={{ cursor: 'pointer' }}>
                            <td style={{ textAlign: 'center', opacity: 0.4 }}>{isExpanded ? '▼' : '▶'}</td>
                            <td style={{ fontWeight: 700, fontSize: '16px' }}>{group.article_code}</td>
                            <td style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px', fontWeight: 600 }}>{group.colour}</td>
                            <td className="num-mono" style={{ textAlign: 'right' }}>{(group.total_initial || 0).toLocaleString()}</td>
                            <td className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{(group.total_inward || 0).toLocaleString()}</td>
                            <td className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>{(group.total_outward || 0).toLocaleString()}</td>
                            <td className="num-mono" style={{ textAlign: 'right', background: '#f8fafc', fontWeight: 800, fontSize: '18px', color: 'var(--primary)' }}>
                               {group.total_available.toLocaleString()}
                            </td>
                            <td className="num-mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                               {group.sizes[0]?.mrp ? `₹${group.sizes[0].mrp}` : '-'}
                            </td>
                            <td className="no-print">
                                <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                                   <button 
                                     style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--danger)' }} 
                                     onClick={() => handleDeleteArticle(group.article_code, group.colour)}
                                     title="System-wide Delete"
                                   >
                                     ×
                                   </button>
                                </div>
                             </td>
                         </tr>
                         {isExpanded && (
                           <tr>
                              <td colSpan={8} style={{ background: '#f8fafc', padding: '0' }}>
                                 <div className="fade-up" style={{ padding: '24px 60px 48px 100px' }}>
                                    <table className="table-corporate" style={{ background: 'white', borderRadius: '8px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                                       <thead>
                                          <tr style={{ background: '#f1f5f9' }}>
                                             <th style={{ fontSize: '10px' }}>SIZE_UNIT</th>
                                             <th className="num-mono" style={{ textAlign: 'right', fontSize: '10px' }}>INITIAL</th>
                                             <th className="num-mono" style={{ textAlign: 'right', fontSize: '10px', color: 'var(--success)' }}>INWARD</th>
                                             <th className="num-mono" style={{ textAlign: 'right', fontSize: '10px', color: '#8b5cf6' }}>MACH_RET</th>
                                             <th className="num-mono" style={{ textAlign: 'right', fontSize: '10px', color: '#06b6d4' }}>SEMI_FIN</th>
                                             <th className="num-mono" style={{ textAlign: 'right', fontSize: '10px', color: 'var(--danger)' }}>OUTWARD</th>
                                             <th className="num-mono" style={{ textAlign: 'right', fontSize: '10px', fontWeight: 800, color: 'var(--primary)' }}>BALANCE</th>
                                          </tr>
                                       </thead>
                                       <tbody>
                                          {group.sizes.map((s: any, sIdx: number) => (
                                            <tr key={sIdx} className="tr-hover">
                                               <td style={{ fontWeight: 800, fontSize: '15px' }}>{s.size}</td>
                                                <td className="num-mono" style={{ textAlign: 'right' }}>{(s.initial_opening || 0).toLocaleString()}</td>
                                                <td className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{(s.total_inward || 0).toLocaleString()}</td>
                                                <td className="num-mono" style={{ textAlign: 'right', color: '#8b5cf6' }}>{(s.total_machine_return || 0).toLocaleString()}</td>
                                                <td className="num-mono" style={{ textAlign: 'right', color: '#06b6d4' }}>{(s.total_semi_finished || 0).toLocaleString()}</td>
                                                <td className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>{(s.total_outward || 0).toLocaleString()}</td>
                                                <td className="num-mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: '16px' }}>{s.available_stock.toLocaleString()}</td>
                                            </tr>
                                          ))}
                                       </tbody>
                                    </table>
                                 </div>
                              </td>
                           </tr>
                         )}
                      </React.Fragment>
                    );
                  })}
               </tbody>
            </table>
         </div>
      </div>

      <style jsx>{`
         .nano-input { width: 100%; border: 1px solid var(--border); padding: 8px 12px; border-radius: 6px; font-size: 12px; outline: none; font-family: inherit; font-weight: 500; }
         .nano-input:focus { border-color: var(--primary); }
      `}</style>
    </div>
  );
}
