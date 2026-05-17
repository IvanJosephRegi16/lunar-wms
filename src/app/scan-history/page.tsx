'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface ScanHistory {
  id: number;
  barcode: string;
  article_code: string;
  colour: string;
  size: string;
  operator_name: string;
  carton_id: string;
  status: string;
  created_at: string;
}

export default function ScanHistoryPage() {
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch('/api/scan-history')
      .then(res => res.json())
      .then(data => {
        if (data.history) setHistory(data.history);
        setLoading(false);
      });
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      let parsedStr = dateString;
      // Convert SQLite "YYYY-MM-DD HH:MM:SS" into standard UTC ISO format "YYYY-MM-DDTHH:MM:SSZ"
      if (!dateString.includes('T') && !dateString.includes('Z') && dateString.includes(' ')) {
        parsedStr = dateString.replace(' ', 'T') + 'Z';
      }
      const d = new Date(parsedStr);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateString;
    }
  };

  const filteredHistory = history.filter(scan => {
    const matchesSearch = 
      scan.barcode.toLowerCase().includes(searchTerm.toLowerCase()) || 
      scan.article_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scan.operator_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || scan.status.includes(statusFilter);
    return matchesSearch && matchesStatus;
  });

  const exportCSV = () => {
    const headers = ['Timestamp', 'Barcode', 'Article', 'Colour', 'Size', 'Carton ID', 'Operator', 'Status'];
    const rows = filteredHistory.map(s => [
      formatDate(s.created_at).replace(/,/g, ''),
      s.barcode,
      s.article_code,
      s.colour,
      s.size,
      s.carton_id || '',
      s.operator_name || 'System',
      s.status
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `scan_history_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Scan History Audit</h1>
          <p>Operational audit trail for all scanning activities</p>
        </div>
        <button className={styles.exportBtn} onClick={exportCSV}>
          ⬇ Export CSV
        </button>
      </div>

      <div className={styles.filters}>
        <input 
          type="text" 
          placeholder="Search by Barcode, Article, or Operator..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <select 
          value={statusFilter} 
          onChange={e => setStatusFilter(e.target.value)}
          className={styles.statusSelect}
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="error">Errors</option>
        </select>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Loading history...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp (IST)</th>
                <th>Barcode</th>
                <th>Article</th>
                <th>Colour</th>
                <th>Size</th>
                <th>Carton ID</th>
                <th>Operator</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map(scan => (
                <tr key={scan.id}>
                  <td>{formatDate(scan.created_at)}</td>
                  <td className={styles.mono}>{scan.barcode}</td>
                  <td><strong>{scan.article_code}</strong></td>
                  <td>{scan.colour}</td>
                  <td>{scan.size}</td>
                  <td className={styles.mono}>{scan.carton_id || '-'}</td>
                  <td>{scan.operator_name || 'System'}</td>
                  <td>
                    <span className={scan.status.includes('success') ? styles.badgeSuccess : styles.badgeError}>
                      {scan.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={8} className={styles.empty}>No scan history found matching filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
