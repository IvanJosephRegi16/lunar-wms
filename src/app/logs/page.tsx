'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatToIST } from '@/lib/dateUtils';

export default function LogsPage() {
   const [data, setData] = useState<any>(null);
   const [loading, setLoading] = useState(true);
   const [page, setPage] = useState(1);

   useEffect(() => {
      setLoading(true);
      fetch(`/api/logs?page=${page}&limit=25`)
         .then(res => res.json())
         .then(d => {
            setData(d);
            setLoading(false);
         });
   }, [page]);

   if (loading && !data) return <div className="loading-dot" style={{ margin: '100px auto', display: 'table' }}>Retrieving Audit Trail...</div>;

   return (
      <div className="fade-up">
         <div className="flex-between mb-8">
            <div>
               <h1 className="title-main">Master Transaction Audit</h1>
               <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Granular record of all warehouse flux, chronologically indexed for logistics verification.</p>
            </div>
            <Link href="/" className="btn-corp">← Return to Intelligence Hub</Link>
         </div>

         <div className="card-clean" style={{ padding: '0' }}>
            <div style={{ overflowX: 'auto' }}>
               <table className="table-corporate bordered">
                  <thead>
                     <tr>
                        <th style={{ width: '130px' }}>Entry Date</th>
                        <th>Article ID</th>
                        <th>Spectrum</th>
                        <th style={{ textAlign: 'center' }}>SZ</th>
                        <th className="num-mono" style={{ textAlign: 'right' }}>INITIAL</th>
                        <th className="num-mono" style={{ textAlign: 'right', color: 'var(--success)' }}>INWARD</th>
                        <th className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>OUTWARD</th>
                        <th className="num-mono" style={{ textAlign: 'right', background: '#f8fafc', fontWeight: 800 }}>EQUITY BAL</th>
                        <th>TIMESTAMP</th>
                     </tr>
                  </thead>
                  <tbody style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                     {data?.logs?.map((l: any) => (
                        <tr key={l.id} className="tr-hover">
                           <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{l.sheet_date}</td>
                           <td style={{ fontWeight: 800 }}>{l.article_code}</td>
                           <td style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', fontWeight: 600 }}>{l.colour}</td>
                           <td style={{ textAlign: 'center', fontWeight: 900, background: '#f1f5f950' }}>{l.size}</td>
                           <td className="num-mono" style={{ textAlign: 'right', fontSize: '13px' }}>{(l.opening_stock || 0).toLocaleString()}</td>
                           <td className="num-mono" style={{ textAlign: 'right', color: 'var(--success)', fontSize: '13px' }}>{(l.inward_stock || 0).toLocaleString()}</td>
                           <td className="num-mono" style={{ textAlign: 'right', color: 'var(--danger)', fontSize: '13px' }}>{(l.outward_stock || 0).toLocaleString()}</td>
                           <td className="num-mono" style={{ textAlign: 'right', background: '#f8fafc', fontWeight: 800, fontSize: '15px', color: 'var(--primary)' }}>
                              {(l.closing_stock || 0).toLocaleString()}
                           </td>
                            <td style={{ fontSize: '10px', color: 'var(--text-ghost)', fontWeight: 500 }}>
                               {formatToIST(l.created_at)}
                            </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            {/* PAGINATION PANEL */}
            <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Showing <span style={{ color: 'var(--text-main)' }}>{((page - 1) * 25) + 1}</span> to <span style={{ color: 'var(--text-main)' }}>{Math.min(page * 25, data?.pagination?.total || 0)}</span> of <span style={{ color: 'var(--text-main)' }}>{data?.pagination?.total}</span> vectors
               </div>
               <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                     className="btn-corp"
                     disabled={page === 1}
                     onClick={() => setPage(p => p - 1)}
                     style={{ opacity: page === 1 ? 0.5 : 1 }}
                  >Previous Sector</button>
                  <div style={{ padding: '8px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: 800, fontSize: '13px' }}>
                     {page} / {data?.pagination?.totalPages}
                  </div>
                  <button
                     className="btn-corp"
                     disabled={page >= (data?.pagination?.totalPages || 0)}
                     onClick={() => setPage(p => p + 1)}
                     style={{ opacity: page >= (data?.pagination?.totalPages || 0) ? 0.5 : 1 }}
                  >Next Sector</button>
               </div>
            </div>
         </div>
      </div>
   );
}
