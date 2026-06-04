'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { downloadCSV, formatIST } from '@/lib/exportCSV';

interface PackedCarton {
  id: number;
  carton_id: string;
  status: string;
  created_at: string;
  scanned_at?: string;
  article_code: string;
  colour: string;
  config_name: string;
  total_pairs: number;
  mrp?: number;
  sizes?: { size: string, quantity: number }[];
}

export default function PackedInventoryPage() {
  const [viewMode, setViewMode] = useState<'today' | 'history'>('today');
  const [inventory, setInventory] = useState<PackedCarton[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [singleDate, setSingleDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Scanning State
  const [scanBarcode, setScanBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<{text: string, isError: boolean} | null>(null);

  // Modal State
  const [selectedCarton, setSelectedCarton] = useState<PackedCarton | null>(null);

  // Fetch Inventory based on viewMode and active date pickers
  const fetchInventoryData = async () => {
    setLoading(true);
    let url = '/api/packed-inventory';
    const params = new URLSearchParams();

    if (viewMode === 'today') {
      const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
      params.append('startDate', todayStr);
      params.append('endDate', todayStr);
    } else {
      // In History mode, attach date ranges or single dates if picked
      if (fromDate && toDate) {
        params.append('startDate', fromDate);
        params.append('endDate', toDate);
      } else if (singleDate) {
        params.append('startDate', singleDate);
      }
    }

    const queryStr = params.toString();
    if (queryStr) {
      url += `?${queryStr}`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.inventory) {
        setInventory(data.inventory);
      }
    } catch (err) {
      console.error('Error loading packed cartons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, [viewMode, singleDate, fromDate, toDate]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSingleDate('');
    setFromDate('');
    setToDate('');
  };

  const handleScanCarton = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanBarcode.trim() || isScanning) return;
    setIsScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch('/api/packed-inventory/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carton_id: scanBarcode.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setScanMessage({ text: 'Carton verified successfully!', isError: false });
        setScanBarcode('');
        fetchInventoryData(); // refresh the list
      } else {
        setScanMessage({ text: data.error || 'Failed to verify carton', isError: true });
      }
    } catch (err: any) {
      setScanMessage({ text: err.message || 'Error scanning carton', isError: true });
    } finally {
      setIsScanning(false);
    }
  };

  // Real-time Client-side Search filter over the fetched date list
  const filteredInventory = inventory.filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      item.carton_id.toLowerCase().includes(term) ||
      item.article_code.toLowerCase().includes(term) ||
      item.colour.toLowerCase().includes(term) ||
      item.config_name.toLowerCase().includes(term)
    );
  });

  const handleExportCSV = () => {
    const headers = ['Carton ID', 'Article Code', 'Colour', 'Configuration Rule', 'Total Pairs', 'Packed Date & Time (IST)', 'Status', 'Export Date/Time'];
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const rows = filteredInventory.map(item => [
      item.carton_id,
      item.article_code,
      item.colour,
      item.config_name,
      item.total_pairs,
      formatIST(item.created_at),
      'Completed',
      now
    ]);
    const label = viewMode === 'today' ? 'Today' : 'History';
    downloadCSV(`Packed_Inventory_${label}_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
  };

  // Calculate live stats based on search
  const totalCartons = filteredInventory.length;
  const totalPairs = filteredInventory.reduce((acc, curr) => acc + curr.total_pairs, 0);
  
  const uniqueModels = new Set(
    filteredInventory.map(item => `${item.article_code}-${item.colour}`)
  ).size;

  // Format Date layout cleanly
  const formatDateTime = (dateStr: string) => {
    try {
      let parsedStr = dateStr;
      if (dateStr && !dateStr.includes('T') && !dateStr.includes('Z') && dateStr.includes(' ')) {
        parsedStr = dateStr.replace(' ', 'T') + 'Z';
      }
      const date = new Date(parsedStr);
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateStr;
    }
  };

  const todayStrFormatted = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className={styles.container}>
      
      {/* Click-to-View Modal */}
      {selectedCarton && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card-clean" style={{ background: '#ffffff', padding: '32px', maxWidth: '600px', width: '100%', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '2px solid #f1f5f9', paddingBottom: '16px' }}>
              <div>
                <span style={{ background: 'var(--neon-violet)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, letterSpacing: '1px' }}>
                  {selectedCarton.carton_id}
                </span>
                <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '8px 0 0 0', color: '#0f172a' }}>Master Carton Details</h2>
              </div>
              <button onClick={() => setSelectedCarton(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div><strong style={{ color: '#64748b' }}>Article:</strong> <span style={{ fontWeight: 800 }}>{selectedCarton.article_code}</span></div>
              <div><strong style={{ color: '#64748b' }}>Colour:</strong> <span style={{ fontWeight: 800 }}>{selectedCarton.colour}</span></div>
              <div><strong style={{ color: '#64748b' }}>Total Pairs:</strong> <span style={{ fontWeight: 800 }}>{selectedCarton.total_pairs}</span></div>
              <div><strong style={{ color: '#64748b' }}>MRP:</strong> <span style={{ fontWeight: 800 }}>{selectedCarton.mrp ? `₹${selectedCarton.mrp}` : 'N/A'}</span></div>
              <div><strong style={{ color: '#64748b' }}>Packed At:</strong> <span style={{ fontWeight: 600 }}>{formatDateTime(selectedCarton.created_at)}</span></div>
              <div><strong style={{ color: '#64748b' }}>Verified At:</strong> <span style={{ fontWeight: 600 }}>{selectedCarton.scanned_at ? formatDateTime(selectedCarton.scanned_at) : 'Pending Verification'}</span></div>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>Size-wise Distribution</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '32px' }}>
              {selectedCarton.sizes && selectedCarton.sizes.length > 0 ? (
                selectedCarton.sizes.map((sz: any) => (
                  <div key={sz.size} style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px', padding: '12px 20px', textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 800, marginBottom: '4px' }}>SIZE {sz.size}</div>
                    <div style={{ fontSize: '20px', color: '#0f172a', fontWeight: 900 }}>{sz.quantity}</div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#64748b', fontStyle: 'italic' }}>No size data available</div>
              )}
            </div>
            
            <button onClick={() => setSelectedCarton(null)} className="btn-corp" style={{ width: '100%', padding: '16px', background: '#f1f5f9', color: '#0f172a', borderRadius: '12px', border: 'none', fontWeight: 800 }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* 1. Header with View Toggle Buttons */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1>Packed Inventory Storage</h1>
          <p>Spreadsheet view of completed outward dispatch cartons</p>
          {viewMode === 'today' ? (
            <div className={styles.realtimeBadge}>
              <span className={styles.pulseDot}></span>
              Today's Packing: {todayStrFormatted}
            </div>
          ) : (
            <div className={styles.historyBadge}>
              📋 Historical Packed Ledger
            </div>
          )}
        </div>

        <button 
          className={`${styles.toggleBtn} ${viewMode === 'today' ? '' : styles.toggleBtnToday}`}
          onClick={() => {
            setViewMode(prev => prev === 'today' ? 'history' : 'today');
            handleClearFilters();
          }}
        >
          {viewMode === 'today' ? '📅 View Full History' : '⚡ View Today\'s Packing'}
        </button>
        <button
          onClick={handleExportCSV}
          style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 18px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          📥 Export CSV
        </button>
      </div>

      {/* 1.5. Master Carton Verification Scanner */}
      <div className={styles.filterPanel} style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '2px dashed #cbd5e1' }}>
        <h3 className={styles.filterHeader} style={{ color: '#0f172a' }}>📦 Scanning Master Carton Verification</h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b' }}>Scan a newly packed Master Carton ID to verify and mark it as delivered/completed.</p>
        <form onSubmit={handleScanCarton} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Scan Carton ID (e.g. CRT-...)" 
            value={scanBarcode}
            onChange={e => setScanBarcode(e.target.value)}
            className="corporate-input"
            style={{ flex: 1, padding: '14px 20px', fontSize: '16px', borderRadius: '12px', border: '2px solid #cbd5e1', fontWeight: 700 }}
            disabled={isScanning}
          />
          <button type="submit" className="btn-corp" disabled={isScanning || !scanBarcode.trim()} style={{ background: '#10b981', color: 'white', border: 'none', padding: '14px 32px', borderRadius: '12px', fontWeight: 800, fontSize: '16px', opacity: (isScanning || !scanBarcode.trim()) ? 0.7 : 1 }}>
            {isScanning ? 'Verifying...' : 'Verify Carton'}
          </button>
        </form>
        {scanMessage && (
          <div style={{ marginTop: '12px', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, background: scanMessage.isError ? '#fef2f2' : '#f0fdf4', color: scanMessage.isError ? '#ef4444' : '#16a34a' }}>
            {scanMessage.text}
          </div>
        )}
      </div>

      {/* 2. Advanced Filters Panel (Always rich, expanded in History) */}
      <div className={styles.filterPanel}>
        <h3 className={styles.filterHeader}>🔍 Multi-Criteria Search & Date Filters</h3>
        <div className={styles.filterGrid}>
          
          <div className={styles.filterGroup}>
            <label>Search Text</label>
            <input 
              type="text" 
              className={styles.filterInput}
              placeholder="Search Carton ID, Article, Colour, Rule..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {viewMode === 'history' ? (
            <>
              <div className={styles.filterGroup}>
                <label>Single Date Pickup</label>
                <input 
                  type="date" 
                  className={styles.filterInput}
                  value={singleDate}
                  onChange={e => {
                    setSingleDate(e.target.value);
                    setFromDate('');
                    setToDate('');
                  }}
                />
              </div>

              <div className={styles.filterGroup}>
                <label>Date Range (From → To)</label>
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <input 
                    type="date" 
                    className={styles.filterInput}
                    value={fromDate}
                    onChange={e => {
                      setFromDate(e.target.value);
                      setSingleDate('');
                    }}
                  />
                  <input 
                    type="date" 
                    className={styles.filterInput}
                    value={toDate}
                    onChange={e => {
                      setToDate(e.target.value);
                      setSingleDate('');
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', color: 'var(--text-ghost)', fontSize: '13px', fontWeight: 600 }}>
              💡 Historical date pickers are locked inside Today's view. Click "View Full History" to unlock range picks!
            </div>
          )}

          <div className={styles.clearBtnRow} style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className={styles.clearBtn} onClick={handleClearFilters}>
              🔄 Reset Filters
            </button>
          </div>

        </div>
      </div>

      {/* 3. Aggregated Stats Cards */}
      <div className={styles.statsSummaryRow}>
        <div className={styles.statBox}>
          <div className={`${styles.statIcon} ${styles.blueIcon}`}>📦</div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Total Cartons</span>
            <span className={styles.statValue}>{totalCartons}</span>
          </div>
        </div>
        <div className={styles.statBox}>
          <div className={`${styles.statIcon} ${styles.emeraldIcon}`}>👟</div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Total Pairs Packed</span>
            <span className={styles.statValue}>{totalPairs}</span>
          </div>
        </div>
        <div className={styles.statBox}>
          <div className={`${styles.statIcon} ${styles.amberIcon}`}>🎨</div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Unique Articles</span>
            <span className={styles.statValue}>{uniqueModels}</span>
          </div>
        </div>
      </div>

      {/* 4. Complete Spreadsheet Matrix Ledger */}
      <div className={styles.tableCard}>
        <div className={styles.tableCardHeader}>
          <h2>
            {viewMode === 'today' ? "Today's Packed Carton Register" : 'Historical Packed Carton Register'}
          </h2>
          <span className={styles.countBadge}>
            Showing {filteredInventory.length} of {inventory.length} total
          </span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.tableSpreadsheet}>
            <thead>
              <tr>
                <th>Carton ID</th>
                <th>Article</th>
                <th>Colour</th>
                <th>Configuration Rule</th>
                <th>Total Pairs</th>
                <th>Packed Date & Time</th>
                <th>Verified Date & Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className={styles.loadingCell}>
                    Fetching packed carton database register...
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    {viewMode === 'today' 
                      ? "No cartons packed today yet. Use Carton Generation to prepare dispatch orders!" 
                      : "No cartons match your historical filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id} onClick={() => setSelectedCarton(item)} style={{ cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <td>
                      <span className={styles.cartonPill}>
                        📟 {item.carton_id}
                      </span>
                    </td>
                    <td>
                      <span className={styles.articleCodeText}>
                        {item.article_code}
                      </span>
                    </td>
                    <td>
                      <span className={styles.colourBadge}>
                        {item.colour}
                      </span>
                    </td>
                    <td>
                      <span className={styles.configNamePill}>
                        {item.config_name}
                      </span>
                    </td>
                    <td>
                      <span className={styles.pairsText}>
                        {item.total_pairs} pairs
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-ghost)', fontWeight: 600 }}>
                      {formatDateTime(item.created_at)}
                    </td>
                    <td style={{ color: 'var(--text-ghost)', fontWeight: 600 }}>
                      {item.scanned_at ? formatDateTime(item.scanned_at) : '-'}
                    </td>
                    <td>
                      {item.status === 'completed' ? (
                        <span style={{ background: '#dcfce7', color: '#16a34a', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 800 }}>
                          Completed
                        </span>
                      ) : (
                        <span style={{ background: '#fef3c7', color: '#d97706', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 800 }}>
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
