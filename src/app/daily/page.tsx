'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { downloadCSV } from '@/lib/exportCSV';

export default function DailySheets() {
  const [sheets, setSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const loadData = () => {
    setLoading(true);
    fetch('/api/daily')
      .then(res => res.json())
      .then(d => {
        setSheets(d.sheets || []);
        setLoading(false)
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleReset = async () => {
    const confirmStr = prompt('CAUTION: To RESET ALL STOCK DATA, type "RESET ALL DATA" exactly:');
    if (confirmStr === 'RESET ALL DATA') {
      setResetLoading(true);
      try {
        const res = await fetch('/api/system/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: 'RESET ALL DATA' })
        });
        if (res.ok) {
          alert('System successfully reset. All inventory volumes are now zero.');
          loadData();
        } else {
          const err = await res.json();
          alert('Error: ' + err.error);
        }
      } catch (e) {
        alert('Failed to connect to server.');
      }
      setResetLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fade-up">
        <div className="flex-between mb-8 no-print">
          <div className="skeleton-box skeleton-pulse" style={{ height: '42px', width: '280px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}></div>
          <div className="skeleton-box skeleton-pulse" style={{ height: '42px', width: '180px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}></div>
        </div>
        <div className="card-clean">
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '24px', marginBottom: '24px' }}>
            <div className="skeleton-box skeleton-pulse" style={{ height: '24px', width: '200px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', marginBottom: '8px' }}></div>
            <div className="skeleton-box skeleton-pulse" style={{ height: '14px', width: '320px', background: 'rgba(0,0,0,0.03)', borderRadius: '4px' }}></div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-corporate">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Log Date</th>
                  <th>Weekday</th>
                  <th style={{ textAlign: 'right' }}>Transaction Count</th>
                  <th style={{ textAlign: 'right' }}>Total Volume (Pairs)</th>
                  <th style={{ width: '120px' }}>State</th>
                  <th style={{ width: '150px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td><div className="skeleton-box skeleton-pulse" style={{ height: '16px', width: '110px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}></div></td>
                    <td><div className="skeleton-box skeleton-pulse" style={{ height: '16px', width: '80px', background: 'rgba(0,0,0,0.03)', borderRadius: '4px' }}></div></td>
                    <td><div className="skeleton-box skeleton-pulse" style={{ height: '16px', width: '50px', background: 'rgba(0,0,0,0.03)', borderRadius: '4px', marginLeft: 'auto' }}></div></td>
                    <td><div className="skeleton-box skeleton-pulse" style={{ height: '16px', width: '70px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', marginLeft: 'auto' }}></div></td>
                    <td><div className="skeleton-box skeleton-pulse" style={{ height: '20px', width: '60px', background: 'rgba(0,0,0,0.03)', borderRadius: '4px' }}></div></td>
                    <td><div className="skeleton-box skeleton-pulse" style={{ height: '30px', width: '90px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <style jsx>{`
          @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
          }
          .skeleton-pulse {
            animation: pulse 1.5s infinite ease-in-out;
          }
        `}</style>
      </div>
    );
  }

  const filteredSheets = sheets?.filter(s => s.sheet_date.includes(debouncedSearchTerm));

  const handleExportCSV = () => {
    const headers = ['Log Date', 'Weekday', 'Transaction Count', 'Total Volume (Pairs)', 'Status', 'Export Date/Time'];
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const rows = (filteredSheets || []).map((s: any) => {
      const d = new Date(s.sheet_date);
      return [
        s.sheet_date,
        d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' }),
        s.entry_count || 0,
        Number(s.total_pairs) || 0,
        s.status,
        now
      ];
    });
    downloadCSV(`Daily_Activity_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
  };

  return (
    <div className="fade-up">
      <div className="flex-between mb-8 no-print">
        <div className="corp-search" style={{ position: 'relative' }}>
           <span>🔍</span>
           <input 
              type="text" 
              placeholder="Search by date (YYYY-MM-DD)..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingRight: '36px' }}
           />
           {searchTerm && (
             <button 
               onClick={() => setSearchTerm('')} 
               style={{ 
                 position: 'absolute', 
                 right: '12px', 
                 background: 'none', 
                 border: 'none', 
                 cursor: 'pointer', 
                 color: 'var(--text-ghost)',
                 fontSize: '14px',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 padding: '4px'
               }}
             >
               ✖
             </button>
           )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-corp" onClick={handleExportCSV} style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>📥 Export CSV</button>
          <button className="btn-corp" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleReset} disabled={resetLoading}>
            {resetLoading ? 'Wiping...' : 'Clear All System Data'}
          </button>
        </div>
      </div>

      <div className="card-clean">
         <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Operation Transaction Logs</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Historical record of all daily logistics activity and yield.</p>
         </div>

         <div style={{ overflowX: 'auto' }}>
            <table className="table-corporate">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Log Date</th>
                  <th>Weekday</th>
                  <th className="num-mono" style={{ textAlign: 'right' }}>Transaction Count</th>
                  <th className="num-mono" style={{ textAlign: 'right' }}>Total Volume (Pairs)</th>
                  <th style={{ width: '120px' }}>State</th>
                  <th style={{ width: '150px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSheets?.map((s, i) => {
                  const d = new Date(s.sheet_date);
                  return (
                    <tr key={i} className="tr-hover">
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.sheet_date}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' })}</td>
                      <td className="num-mono" style={{ textAlign: 'right' }}>{s.entry_count || 0}</td>
                      <td className="num-mono" style={{ textAlign: 'right', fontWeight: 800 }}>
                         {(Number(s.total_pairs) || 0).toLocaleString()}
                      </td>
                      <td>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '11px', 
                          fontWeight: 700, 
                          textTransform: 'uppercase', 
                          background: s.status === 'open' ? '#10b98115' : '#f1f5f9',
                          color: s.status === 'open' ? 'var(--success)' : 'var(--text-ghost)'
                        }}>
                           {s.status}
                        </span>
                      </td>
                      <td>
                        <Link href={`/daily/${s.sheet_date}`} className="btn-corp btn-primary-corp" style={{ padding: '6px 16px', fontSize: '12px' }}>
                          Open Ledger
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {filteredSheets?.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-ghost)' }}>No operation logs found for the selected criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
         </div>
      </div>

      <style jsx>{`
        .corp-search { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid var(--border); padding: 0 16px; border-radius: 8px; }
        .corp-search input { background: transparent; border: none; padding: 10px 0; outline: none; width: 250px; color: var(--text-main); font-size: 14px; }
      `}</style>
    </div>
  );
}
