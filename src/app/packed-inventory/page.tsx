'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { downloadCSV, formatIST } from '@/lib/exportCSV';

interface PackedCarton {
  id: number;
  carton_id: string;
  status: string;
  created_at: string;
  article_code: string;
  colour: string;
  config_name: string;
  total_pairs: number;
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className={styles.loadingCell}>
                    Fetching packed carton database register...
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    {viewMode === 'today' 
                      ? "No cartons packed today yet. Use Carton Generation to prepare dispatch orders!" 
                      : "No cartons match your historical filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id}>
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
                    <td>
                      <span className={styles.statusCompleted}>
                        Completed
                      </span>
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
