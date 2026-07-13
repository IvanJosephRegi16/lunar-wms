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
  scan_type: string;
  brand: string;
}

export default function ScanHistoryPage() {
  const [user, setUser] = useState<any>(null);
  const [menuVisibility, setMenuVisibility] = useState<any>(null);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [loading, setLoading] = useState(true);
  
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scanTypeFilter, setScanTypeFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetCount, setResetCount] = useState(0);

  const fetchHistory = (start?: string, end?: string) => {
    setLoading(true);
    let url = '/api/scan-history';
    const params = new URLSearchParams();
    if (start) params.append('startDate', start);
    if (end) params.append('endDate', end);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.history) {
          const enhanced = data.history.map((item: any) => ({
            ...item,
            brand: (() => {
              const first = item.article_code?.charAt(0) ?? '';
              if (first.toUpperCase() === 'J') return 'JOKOT';
              if (first >= '0' && first <= '9') return 'LUNAR';
              return '-'; // error / unparsed entries – no brand
            })()
          }));
          setHistory(enhanced);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setUser(data.user);
          setMenuVisibility(data.menuVisibility);
        }
      });

    fetchHistory(fromDate, toDate);
  }, [fromDate, toDate]);

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

  const handleCopy = (barcode: string, id: number) => {
    navigator.clipboard.writeText(barcode)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
      })
      .catch(err => {
        console.error('Clipboard copy failed:', err);
      });
  };

  const filteredHistory = history.filter(scan => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (scan.barcode || '').toLowerCase().includes(term) || 
      (scan.article_code || '').toLowerCase().includes(term) ||
      (scan.colour || '').toLowerCase().includes(term) ||
      (scan.size || '').toLowerCase().includes(term) ||
      (scan.operator_name || '').toLowerCase().includes(term);
    
    const matchesStatus = statusFilter === 'all' || scan.status.includes(statusFilter);
    const matchesType = scanTypeFilter === 'all' || scan.scan_type === scanTypeFilter;
    const matchesBrand = brandFilter === 'all' || scan.brand === brandFilter;
    
    return matchesSearch && matchesStatus && matchesType && matchesBrand;
  });

  const exportCSV = () => {
    const headers = ['Timestamp', 'Brand', 'Scan Type', 'Barcode', 'Article', 'Colour', 'Size', 'Carton ID', 'Operator', 'Status'];
    const rows = filteredHistory.map(s => [
      formatDate(s.created_at).replace(/,/g, ''),
      s.brand,
      s.scan_type || 'intake',
      s.barcode,
      s.article_code,
      s.colour,
      s.size,
      s.carton_id || '',
      s.operator_name || 'System',
      s.status
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `scan_history_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetClick = () => {
    fetch('/api/scan-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preview' })
    })
      .then(res => res.json())
      .then(data => {
        if (data.count !== undefined) {
          setResetCount(data.count);
          setShowResetModal(true);
        } else {
          alert(`Failed to fetch reset preview: ${data.error || JSON.stringify(data)}`);
        }
      })
      .catch(err => {
        alert('Failed to check scan history count. Network error.');
      });
  };

  const confirmReset = () => {
    setIsResetting(true);
    fetch('/api/scan-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'CONFIRM_RESET' })
    })
      .then(res => res.json())
      .then(data => {
        setIsResetting(false);
        if (data.success) {
          setShowResetModal(false);
          alert(data.message || 'Scan history reset successfully.');
          fetchHistory(fromDate, toDate);
        } else {
          alert(data.error || 'Reset failed.');
        }
      })
      .catch(err => {
        setIsResetting(false);
        alert('An error occurred while resetting.');
      });
  };

  const canReset = user && ['admin', 'pm', 'supervisor'].includes(user.role);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Scan History Audit</h1>
          <p>Operational audit trail for all scanning activities</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canReset && (
            <button className={styles.resetBtn} onClick={handleResetClick}>
              ⚠️ Reset History
            </button>
          )}
          <button className={styles.exportBtn} onClick={exportCSV}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div className={styles.filters} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Search by Article, Colour, Size, Barcode, Operator..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={styles.searchInput}
            style={{ flex: 1, minWidth: '300px' }}
          />
          <input 
            type="date" 
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className={styles.searchInput}
            title="Start Date"
          />
          <input 
            type="date" 
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className={styles.searchInput}
            title="End Date"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className={styles.pillSelector} style={{ flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginRight: '8px' }}>Scan Type:</span>
            <button 
              type="button"
              className={`${styles.pill} ${scanTypeFilter === 'all' ? styles.pillActive : ''}`}
              onClick={() => setScanTypeFilter('all')}
            >
              All Types
            </button>
            <button 
              type="button"
              className={`${styles.pill} ${scanTypeFilter === 'intake' ? styles.pillActive : ''}`}
              onClick={() => setScanTypeFilter('intake')}
            >
              Intake
            </button>
            <button 
              type="button"
              className={`${styles.pill} ${scanTypeFilter === 'outward' ? styles.pillActive : ''}`}
              onClick={() => setScanTypeFilter('outward')}
            >
              Outward
            </button>
            <button 
              type="button"
              className={`${styles.pill} ${scanTypeFilter === 'verification' ? styles.pillActive : ''}`}
              onClick={() => setScanTypeFilter('verification')}
            >
              Verification
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className={styles.pillSelector}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginRight: '8px' }}>Brand:</span>
              <button 
                type="button"
                className={`${styles.pill} ${brandFilter === 'all' ? styles.pillActive : ''}`}
                onClick={() => setBrandFilter('all')}
              >
                All
              </button>
              <button 
                type="button"
                className={`${styles.pill} ${brandFilter === 'LUNAR' ? styles.pillActive : ''}`}
                onClick={() => setBrandFilter('LUNAR')}
                style={brandFilter === 'LUNAR' ? { background: '#e0e7ff', color: '#4338ca' } : {}}
              >
                Lunar
              </button>
              <button 
                type="button"
                className={`${styles.pill} ${brandFilter === 'JOKOT' ? styles.pillActive : ''}`}
                onClick={() => setBrandFilter('JOKOT')}
                style={brandFilter === 'JOKOT' ? { background: '#fef3c7', color: '#d97706' } : {}}
              >
                Jokot
              </button>
            </div>
          
            <div className={styles.pillSelector}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginRight: '8px' }}>Status:</span>
            <button 
              type="button"
              className={`${styles.pill} ${statusFilter === 'all' ? styles.pillActive : ''}`}
              onClick={() => setStatusFilter('all')}
              >
                All
              </button>
              <button 
              type="button"
              className={`${styles.pill} ${statusFilter === 'success' ? styles.pillActive : ''}`}
              onClick={() => setStatusFilter('success')}
              >
                Success
              </button>
              <button 
              type="button"
              className={`${styles.pill} ${statusFilter === 'error' ? styles.pillActive : ''}`}
              onClick={() => setStatusFilter('error')}
              >
                Errors
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Loading history...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp (IST)</th>
                <th>Brand</th>
                <th>Type</th>
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
              {filteredHistory.map(scan => {
                const typeColor = scan.scan_type === 'intake' ? '#3b82f6' : scan.scan_type === 'outward' ? '#f59e0b' : scan.scan_type === 'verification' ? '#10b981' : '#64748b';
                return (
                <tr key={scan.id}>
                  <td>{formatDate(scan.created_at)}</td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800,
                      background: scan.brand === 'JOKOT' ? '#fef3c7' : scan.brand === 'LUNAR' ? '#e0e7ff' : '#f1f5f9',
                      color: scan.brand === 'JOKOT' ? '#d97706' : scan.brand === 'LUNAR' ? '#4338ca' : '#94a3b8'
                    }}>
                      {scan.brand === '-' ? '—' : scan.brand}
                    </span>
                  </td>
                  <td>
                    <span style={{ background: `${typeColor}20`, color: typeColor, padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                      {scan.scan_type || 'intake'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.barcodeCell}>
                      <span className={styles.mono}>{scan.barcode}</span>
                      <button 
                        type="button" 
                        onClick={() => handleCopy(scan.barcode, scan.id)}
                        className={styles.copyBtn}
                        title="Copy barcode to clipboard"
                      >
                        📋 Copy
                        {copiedId === scan.id && (
                          <span className={styles.tooltip}>Copied!</span>
                        )}
                      </button>
                    </div>
                  </td>
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
                );
              })}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={10} className={styles.empty}>No scan history found matching filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showResetModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>⚠️ Reset Scan History</h2>
            <p>
              Are you absolutely sure you want to reset the scan history? 
              This will archive <strong>{resetCount}</strong> records. 
              This action cannot be undone. Please ensure you have exported the data before proceeding.
            </p>
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmResetBtn} 
                onClick={confirmReset}
                disabled={isResetting}
              >
                {isResetting ? 'Resetting...' : 'Yes, Reset Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
