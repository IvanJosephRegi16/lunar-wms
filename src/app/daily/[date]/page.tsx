'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function DailySheetDetail({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  const router = useRouter();

  const [entries, setEntries] = useState<any[]>([]);
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [articleForm, setArticleForm] = useState({ article_code: '', colour: '', remarks: '' });
  const [duplicateModal, setDuplicateModal] = useState<{ show: boolean, data: any } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // UPDATED SIZE MATRIX TO INCLUDE SIZE 5
  const defaultSizes = {
    '5': { op: '', in: '', out: '', mr: '', sf: '' },
    '6': { op: '', in: '', out: '', mr: '', sf: '' },
    '7': { op: '', in: '', out: '', mr: '', sf: '' },
    '8': { op: '', in: '', out: '', mr: '', sf: '' },
    '9': { op: '', in: '', out: '', mr: '', sf: '' },
    '10': { op: '', in: '', out: '', mr: '', sf: '' },
    '11': { op: '', in: '', out: '', mr: '', sf: '' },
    '12': { op: '', in: '', out: '', mr: '', sf: '' }
  };
  const [sizeMatrix, setSizeMatrix] = useState<any>(JSON.parse(JSON.stringify(defaultSizes)));

  const loadData = () => {
    setLoading(true);
    fetch(`/api/daily?date=${date}`)
      .then(res => res.json())
      .then(d => {
        setEntries(d.entries || []);
        setSheet(d.sheet || { status: 'open' });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [date]);

  const fetchOpeningBalances = async (article: string, col: string) => {
     if (date === '2026-05-01' || isEditing || !article || !col) return;
     try {
       const res = await fetch(`/api/stock-lookup?article_code=${encodeURIComponent(article)}&colour=${encodeURIComponent(col)}&date=${date}`);
       const data = await res.json();
       if (data.openingBalances) {
          setSizeMatrix((prev: any) => {
            const next = { ...prev };
            Object.keys(data.openingBalances).forEach(sz => {
               if (next[sz]) next[sz].op = data.openingBalances[sz];
            });
            return next;
          });
       }
     } catch (e) {}
  };

  useEffect(() => {
    if (articleForm.article_code && articleForm.colour && !isEditing) {
      const timer = setTimeout(() => fetchOpeningBalances(articleForm.article_code, articleForm.colour), 500);
      return () => clearTimeout(timer);
    }
  }, [articleForm.article_code, articleForm.colour, isEditing, date]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleForm.article_code || !articleForm.colour) return alert('Article & Colour required');

    const submitEntries = async (force?: boolean) => {
      for (const size of ['5','6','7','8','9','10','11','12']) {
         const row = sizeMatrix[size];
         if (row.op !== '' || row.in !== '' || row.out !== '' || row.mr !== '' || row.sf !== '') {
            const res = await fetch('/api/daily', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                 sheet_date: date,
                 article_code: articleForm.article_code,
                 colour: articleForm.colour,
                 size,
                 opening_stock: row.op || 0,
                 inward_stock: row.in || 0,
                 outward_stock: row.out || 0,
                 machine_return_stock: row.mr || 0,
                 semi_finished_stock: row.sf || 0,
                 remarks: articleForm.remarks,
                 forceSave: force,
                 isEditing
              })
            });

            if (res.status === 409 && !force) {
              setDuplicateModal({ show: true, data: { msg: 'This article combo already exists. Do you want to merge/overwrite?' } });
              return;
            }
         }
      }
      resetForm();
      loadData();
    };
    await submitEntries();
  };

  const resetForm = () => {
    setArticleForm({ article_code: '', colour: '', remarks: '' });
    setSizeMatrix(JSON.parse(JSON.stringify(defaultSizes)));
    setShowForm(false);
    setIsEditing(false);
  };

  const handleEditClick = (article: string, colour: string) => {
     const rows = entries.filter(e => e.article_code === article && e.colour === colour);
     const newMatrix = JSON.parse(JSON.stringify(defaultSizes));
     rows.forEach(r => {
        if (newMatrix[r.size]) {
           newMatrix[r.size] = {
             op: r.opening_stock,
             in: r.inward_stock,
             out: r.outward_stock,
             mr: r.machine_return_stock,
             sf: r.semi_finished_stock
           };
        }
     });
     setArticleForm({ article_code: article, colour: colour, remarks: rows[0]?.remarks || '' });
     setSizeMatrix(newMatrix);
     setIsEditing(true);
     setShowForm(true);
     window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteArticle = async (article_code: string, colour: string) => {
    const isGlobal = window.confirm(`DELETE ARTICLE EVERYWHERE: ${article_code} [${colour}]\n\nAre you sure you want to remove this article from ALL daily logs and the inventory hub?\n\n- Click OK for SYSTEM-WIDE DELETE\n- Click CANCEL to abort.`);
    
    if (isGlobal) {
      const res = await fetch(`/api/daily?article_code=${encodeURIComponent(article_code)}&colour=${encodeURIComponent(colour)}&global=true`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
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

  if (loading) return <div className="loading-dot" style={{ margin: '100px auto', display: 'table' }}>Mounting Transaction Matrix...</div>;

  const isLocked = sheet?.status === 'locked';
  const isMay1 = date === '2026-05-01';

  const groupedData: Record<string, any> = {};
  entries.forEach(e => {
    const key = `${e.article_code}|${e.colour}`;
    if (!groupedData[key]) {
      groupedData[key] = {
        article_code: e.article_code, colour: e.colour,
        total_opening: 0, total_inward: 0, total_outward: 0, total_closing: 0,
        sizes: []
      };
    }
    const g = groupedData[key];
    g.sizes.push(e);
    g.total_opening += (e.opening_stock || 0);
    g.total_inward += (e.inward_stock || 0);
    g.total_outward += (e.outward_stock || 0);
    g.total_closing += (e.closing_stock || 0);
  });

  const filteredGroups = Object.values(groupedData).filter(g => 
    g.article_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.colour.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fade-up">
      <div className="flex-between mb-8">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <h2 className="title-main">Ledger Unit: {date}</h2>
             <span className={`status-tag ${sheet?.status}`}>{sheet?.status?.toUpperCase()}</span>
          </div>
        </div>
        <div className="flex gap-4">
           <button className="btn-corp" onClick={() => router.push('/daily')}>← Back to Logs</button>
           {!isLocked && (
             <button className="btn-corp btn-primary-corp" onClick={() => setShowForm(!showForm)}>
               {showForm ? 'Cancel Entry' : '+ Register Article Stock'}
             </button>
           )}
        </div>
      </div>

      {showForm && !isLocked && (
        <div className="card-clean fade-up" style={{ borderTop: '4px solid var(--primary)', marginBottom: '40px' }}>
           <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>{isEditing ? 'Modify Article Parameters' : 'Article Initialization Matrix'}</h3>
           <form onSubmit={handleCreate}>
              <div className="grid grid-3 mb-8">
                <div className="form-group-lux">
                  <label>Article Identifier</label>
                  <input type="text" placeholder="e.g. 2626" value={articleForm.article_code} onChange={e => setArticleForm({ ...articleForm, article_code: e.target.value.toUpperCase() })} required />
                </div>
                <div className="form-group-lux">
                  <label>Spectrum/Colour</label>
                  <input type="text" placeholder="e.g. TAN" value={articleForm.colour} onChange={e => setArticleForm({ ...articleForm, colour: e.target.value.toUpperCase() })} required />
                </div>
                <div className="form-group-lux">
                  <label>Operations Remarks</label>
                  <input type="text" placeholder="Internal notes..." value={articleForm.remarks} onChange={e => setArticleForm({ ...articleForm, remarks: e.target.value })} />
                </div>
              </div>

              <div style={{ overflowX: 'auto', marginBottom: '32px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                 <table className="table-corporate bordered" style={{ margin: 0 }}>
                    <thead style={{ background: '#f8fafc' }}>
                      <tr>
                        <th style={{ width: '80px' }}>Size</th>
                        <th>Opening</th>
                        <th style={{ color: 'var(--success)' }}>Inward Flow</th>
                        <th style={{ color: 'var(--danger)' }}>Outward Flow</th>
                        <th style={{ color: '#8b5cf6' }}>Mach Ret</th>
                        <th style={{ color: '#06b6d4' }}>Semi Fin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['5','6','7','8','9','10','11','12'].map(size => (
                        <tr key={size}>
                          <td style={{ fontWeight: 800, textAlign: 'center', background: '#f1f5f9' }}>{size}</td>
                          <td><input type="number" className="matrix-input-silk" value={sizeMatrix[size].op} onChange={e => setSizeMatrix({...sizeMatrix, [size]: {...sizeMatrix[size], op: e.target.value}})} disabled={!isMay1 && !isEditing} /></td>
                          <td><input type="number" className="matrix-input-silk" value={sizeMatrix[size].in} onChange={e => setSizeMatrix({...sizeMatrix, [size]: {...sizeMatrix[size], in: e.target.value}})} /></td>
                          <td><input type="number" className="matrix-input-silk" value={sizeMatrix[size].out} onChange={e => setSizeMatrix({...sizeMatrix, [size]: {...sizeMatrix[size], out: e.target.value}})} /></td>
                          <td><input type="number" className="matrix-input-silk" value={sizeMatrix[size].mr} onChange={e => setSizeMatrix({...sizeMatrix, [size]: {...sizeMatrix[size], mr: e.target.value}})} /></td>
                          <td><input type="number" className="matrix-input-silk" value={sizeMatrix[size].sf} onChange={e => setSizeMatrix({...sizeMatrix, [size]: {...sizeMatrix[size], sf: e.target.value}})} /></td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn-corp btn-primary-corp" style={{ flex: 1 }}>{isEditing ? 'Confirm Updates' : 'Commit Article to Ledger'}</button>
                <button type="button" className="btn-corp" onClick={resetForm}>Discard</button>
              </div>
           </form>
        </div>
      )}

      {/* SEARCH PIN */}
      <div className="flex-between mb-6">
         <div className="corp-search">
            <span>🔍</span>
            <input type="text" placeholder="Filter articles or colours..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
         </div>
      </div>

      <div className="card-clean" style={{ padding: '0' }}>
         <div style={{ overflowX: 'auto' }}>
            <table className="table-corporate bordered">
               <thead>
                  <tr>
                    <th style={{ width: '60px' }}></th>
                    <th>ARTICLE</th>
                    <th>COLOUR</th>
                    <th className="num-mono" style={{ textAlign: 'right' }}>TOT. OPENING</th>
                    <th className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>INWARD</th>
                    <th className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>OUTWARD</th>
                    <th className="num-mono" style={{ textAlign: 'right', background: '#f8fafc', fontWeight: 800 }}>BAL_CLOSING</th>
                    <th style={{ width: '80px', textAlign: 'center' }} className="no-print">EDIT</th>
                    <th style={{ width: '80px', textAlign: 'center' }} className="no-print">DELETE</th>
                  </tr>
               </thead>
               <tbody>
                  {filteredGroups.map((g: any) => {
                    const id = `${g.article_code}|${g.colour}`;
                    const isExpanded = expandedRows.has(id);
                    return (
                      <React.Fragment key={id}>
                         <tr className="tr-hover" onClick={() => toggleExpand(id)} style={{ cursor: 'pointer' }}>
                            <td style={{ textAlign: 'center', opacity: 0.4 }}>{isExpanded ? '▼' : '▶'}</td>
                            <td style={{ fontWeight: 800, fontSize: '17px' }}>{g.article_code}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>{g.colour}</td>
                            <td className="num-mono" style={{ textAlign: 'right' }}>{g.total_opening}</td>
                            <td className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{g.total_inward || '-'}</td>
                            <td className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>{g.total_outward || '-'}</td>
                            <td className="num-mono" style={{ textAlign: 'right', background: '#f8fafc', fontWeight: 800, fontSize: '18px', color: 'var(--primary)' }}>{g.total_closing}</td>
                             <td className="no-print" style={{ textAlign: 'center' }}>
                               {!isLocked && (
                                 <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }} onClick={e => { e.stopPropagation(); handleEditClick(g.article_code, g.colour); }}>✏️</button>
                               )}
                             </td>
                             <td className="no-print" style={{ textAlign: 'center' }}>
                               {!isLocked && (
                                 <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--danger)' }} onClick={e => { e.stopPropagation(); handleDeleteArticle(g.article_code, g.colour); }}>×</button>
                               )}
                             </td>
                         </tr>
                         {isExpanded && (
                           <tr>
                              <td colSpan={9} style={{ background: '#f8fafc', padding: '0' }}>
                                 <div className="fade-up" style={{ padding: '24px 60px 48px 100px' }}>
                                    <table className="table-corporate bordered" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px' }}>
                                       <thead>
                                          <tr style={{ background: '#f1f5f9' }}>
                                             <th>SIZE</th>
                                             <th className="num-mono" style={{ textAlign: 'right' }}>OPENING</th>
                                             <th className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>INWARD</th>
                                             <th className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>OUTWARD</th>
                                             <th className="num-mono" style={{ textAlign: 'right', color: '#8b5cf6' }}>MACH RET</th>
                                             <th className="num-mono" style={{ textAlign: 'right', color: '#06b6d4' }}>SEMI FIN</th>
                                             <th className="num-mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>BAL</th>
                                          </tr>
                                       </thead>
                                       <tbody>
                                          {g.sizes.map((s: any) => (
                                            <tr key={s.id} className="tr-hover">
                                               <td style={{ fontWeight: 800, fontSize: '16px' }}>{s.size}</td>
                                               <td className="num-mono" style={{ textAlign: 'right' }}>{s.opening_stock}</td>
                                               <td className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>{s.inward_stock || '-'}</td>
                                               <td className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>{s.outward_stock || '-'}</td>
                                               <td className="num-mono" style={{ textAlign: 'right', color: '#8b5cf6' }}>{s.machine_return_stock || '-'}</td>
                                               <td className="num-mono" style={{ textAlign: 'right', color: '#06b6d4' }}>{s.semi_finished_stock || '-'}</td>
                                               <td className="num-mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: '16px' }}>{s.closing_stock}</td>
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
         .matrix-input-silk { width: 100%; border: none; background: transparent; padding: 12px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 700; outline: none; }
         .matrix-input-silk:focus { background: white; box-shadow: inset 0 0 0 2px var(--primary); }
         .form-group-lux { display: flex; flex-direction: column; gap: 8px; }
         .form-group-lux label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
         .form-group-lux input { background: #f8fafc; border: 1px solid var(--border); padding: 10px 14px; border-radius: 8px; font-size: 14px; font-weight: 500; outline: none; transition: all 0.2s; }
         .form-group-lux input:focus { border-color: var(--primary); background: white; }
         .status-tag { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 900; background: #f1f5f9; color: var(--text-ghost); }
         .status-tag.open { background: #10b98115; color: var(--success); }
         .corp-search { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid var(--border); padding: 0 16px; border-radius: 8px; }
         .corp-search input { background: transparent; border: none; padding: 10px 0; outline: none; width: 250px; color: var(--text-main); font-size: 14px; }
      `}</style>
    </div>
  );
}
