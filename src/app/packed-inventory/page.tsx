'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { downloadCSV, formatIST } from '@/lib/exportCSV';
import ExportDropdown from '@/components/ExportDropdown';
import Barcode from 'react-barcode';

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
  brand: string;
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterBrand, setFilterBrand] = useState('ALL');

  // Scanning State
  const [scanBarcode, setScanBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<{text: string, isError: boolean} | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [selectedCarton, setSelectedCarton] = useState<PackedCarton | null>(null);

  // Auto-focus input continuously with a tighter interval for fast barcode scanners
  useEffect(() => {
    const focusInterval = setInterval(() => {
      // Only focus if modal isn't open or user isn't clicking on other inputs like filters
      if (
        document.activeElement !== inputRef.current && 
        document.activeElement?.tagName !== 'INPUT' && 
        !selectedCarton
      ) {
        inputRef.current?.focus();
      }
    }, 250); 
    return () => clearInterval(focusInterval);
  }, [selectedCarton]);

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
        const enhanced = data.inventory.map((item: any) => ({
          ...item,
          brand: item.article_code.toUpperCase().startsWith('J') ? 'JOKOT' : 'LUNAR'
        }));
        setInventory(enhanced);
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
    setStatusFilter('all');
    setFilterBrand('ALL');
  };

  const handleScanCarton = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const barcode = e.currentTarget.value.trim();
      e.currentTarget.value = '';
      if (!barcode || isScanning) return;
      
      setIsScanning(true);
      setScanMessage(null);
      try {
        const res = await fetch('/api/packed-inventory/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ carton_id: barcode })
        });
        const data = await res.json();
        if (res.ok) {
          setScanMessage({ text: 'Carton delivered successfully! (' + barcode + ')', isError: false });
          fetchInventoryData(); // refresh the list
        } else {
          setScanMessage({ text: data.error || 'Failed to verify carton', isError: true });
        }
      } catch (err: any) {
        setScanMessage({ text: err.message || 'Error scanning carton', isError: true });
      } finally {
        setIsScanning(false);
      }
    }
  };

  // Real-time Client-side Search filter over the fetched date list
  const filteredInventory = inventory.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      item.carton_id.toLowerCase().includes(term) ||
      item.article_code.toLowerCase().includes(term) ||
      item.colour.toLowerCase().includes(term) ||
      item.config_name.toLowerCase().includes(term);
      
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesBrand = filterBrand === 'ALL' || item.brand === filterBrand;
    
    return matchesSearch && matchesStatus && matchesBrand;
  });

  const getExportData = () => {
    const headers = ['Brand', 'Carton ID', 'Article Code', 'Colour', 'Configuration Rule', 'Total Pairs', 'Packed Date & Time (IST)', 'Delivered Date & Time (IST)', 'Status', 'Export Date/Time'];
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const rows = filteredInventory.map(item => [
      item.brand,
      item.carton_id,
      item.article_code,
      item.colour,
      item.config_name,
      item.total_pairs,
      formatIST(item.created_at),
      item.scanned_at ? formatIST(item.scanned_at) : 'Pending Verification',
      item.status === 'completed' ? 'Completed' : 'Pending',
      now
    ]);
    const label = viewMode === 'today' ? 'Today' : 'History';
    const statusLabel = statusFilter === 'all' ? '' : `_${statusFilter}`;
    const filename = `Packed_Inventory_${label}${statusLabel}_${new Date().toISOString().slice(0,10)}`;
    return { headers, rows, filename };
  };

  const exportData = getExportData();

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

  // Full-screen sticker view when a carton is selected
  if (selectedCarton) {
    const sizesArr: any[] = selectedCarton.sizes || [];
    const totalFromSizes = sizesArr.reduce((acc: number, s: any) => acc + (Number(s.quantity) || 0), 0);
    const progressForSticker = sizesArr.map((s: any) => ({
      size: String(s.size),
      scanned: Number(s.quantity) || 0,
      required: Number(s.quantity) || 0,
      remaining: 0
    }));
    const cartonData = {
      article: selectedCarton.article_code,
      colour: selectedCarton.colour,
      mrp: selectedCarton.mrp ? String(selectedCarton.mrp) : null,
      progress: progressForSticker,
      carton: selectedCarton.carton_id
    };
    return <PackedStickerView cartonData={cartonData} totalPairs={totalFromSizes} onClose={() => setSelectedCarton(null)} />;
  }

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
        <ExportDropdown 
          filename={exportData.filename}
          headers={exportData.headers}
          rows={exportData.rows}
        />
      </div>

      {/* 1.5. Master Carton Verification Scanner */}
      <div className={styles.filterPanel} style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '2px dashed #cbd5e1' }}>
        <h3 className={styles.filterHeader} style={{ color: '#0f172a' }}>📦 Scanning Master Carton Verification</h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b' }}>Scan a newly packed Master Carton ID to verify and mark it as delivered/completed.</p>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '24px' }}>⚡</span>
          <input 
            ref={inputRef}
            type="text" 
            placeholder={isScanning ? "Verifying..." : "Awaiting scanner input (e.g. CRT-...)"} 
            onKeyDown={handleScanCarton}
            className="corporate-input"
            style={{ flex: 1, padding: '14px 20px', fontSize: '16px', borderRadius: '12px', border: '2px solid #cbd5e1', fontWeight: 700 }}
            disabled={isScanning}
            autoFocus
          />
        </div>
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

          <div className={styles.filterGroup}>
            <label>Brand</label>
            <select 
              className={styles.filterInput}
              value={filterBrand}
              onChange={e => setFilterBrand(e.target.value)}
            >
              <option value="ALL">All Brands</option>
              <option value="LUNAR">Lunar</option>
              <option value="JOKOT">Jokot</option>
            </select>
          </div>
          
          <div className={styles.filterGroup}>
            <label>Verification Status</label>
            <select 
              className={styles.filterInput}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed (Verified)</option>
              <option value="pending">Pending (Unverified)</option>
            </select>
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
                <th>Brand</th>
                <th>Carton ID</th>
                <th>Article</th>
                <th>Colour</th>
                <th>Configuration Rule</th>
                <th>Total Pairs</th>
                <th>Packed Date & Time</th>
                <th>Delivered Date & Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className={styles.loadingCell}>
                    Fetching packed carton database register...
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.emptyCell}>
                    {viewMode === 'today' 
                      ? "No cartons packed today yet. Use Carton Generation to prepare dispatch orders!" 
                      : "No cartons match your historical filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id} onClick={() => setSelectedCarton(item)} style={{ cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800,
                        background: item.brand === 'JOKOT' ? '#fef3c7' : '#e0e7ff',
                        color: item.brand === 'JOKOT' ? '#d97706' : '#4338ca'
                      }}>
                        {item.brand}
                      </span>
                    </td>
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

// ==========================================
// PACKED STICKER COMPONENT (10x10cm)
// Works for both LUNAR and JOKOT brands
// ==========================================
// ==========================================
function getAggregatedSizeStr(progress: any[]) {
  const nums = progress.filter((p: any) => p.scanned > 0).map((p: any) => parseInt(p.size)).sort((a: any, b: any) => a - b);
  if (nums.length === 0) return 'N/A';
  let consecutive = true;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) { consecutive = false; break; }
  }
  return consecutive && nums.length > 1 ? `${nums[0]} \u00d7 ${nums[nums.length - 1]}` : nums.join(', ');
}

function PackedStickerView({ cartonData, totalPairs, onClose }: { cartonData: any, totalPairs: number, onClose: () => void }) {
  const { article, colour, mrp, progress, carton } = cartonData;
  const activeSizes = progress.filter((p: any) => p.scanned > 0).sort((a: any, b: any) => parseInt(a.size) - parseInt(b.size));
  const aggregatedSizeStr = getAggregatedSizeStr(progress);
  const barcodeValue = carton || 'UNKNOWN';
  const isJokot = article && article.toUpperCase().startsWith('J');
  const brandName = isJokot ? 'JOKOT WMS' : 'LUNAR WMS';
  const mfdBy = isJokot ? 'Jokot Footwear' : 'Lunar Rubbers Pvt Ltd - Thodupuzha, Kerala';
  const mktdBy = isJokot ? 'Jokot Footwear' : 'Lunar Footwear - Customer Care: 1800-123-456';
  const mfgDate = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  return (
    <div style={{ background: '#e2e8f0', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }} className="print-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800;900&family=Barlow+Condensed:wght@600;700;800;900&display=swap');
        @media print { body * { visibility: hidden; } .print-wrapper { background: white !important; padding: 0 !important; } .sticker-wrap, .sticker-wrap * { visibility: visible; } .sticker-wrap { position: absolute; left: 0; top: 0; } .no-print { display: none !important; } }
        .pi-sticker { width:10cm; height:10cm; background:#fff; border:2px solid #000; font-family:'Barlow',sans-serif; overflow:hidden; box-sizing:border-box; display:flex; flex-direction:column; }
        .pi-hdr { background:#000; color:#fff; display:flex; align-items:center; justify-content:space-between; padding:4px 8px; flex-shrink:0; }
        .pi-hdr .brand { font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:900; letter-spacing:2px; text-transform:uppercase; }
        .pi-hdr .badge { font-family:'Barlow Condensed',sans-serif; font-size:9px; font-weight:800; background:#fff; color:#000; padding:2px 6px; border-radius:2px; text-transform:uppercase; }
        .pi-hdr .atag { font-family:'Barlow Condensed',sans-serif; font-size:9px; font-weight:900; background:#fff; color:#000; padding:1px 6px; border-radius:2px; text-transform:uppercase; }
        .pi-body { display:flex; flex-direction:column; flex:1; overflow:hidden; }
        .pi-row { display:flex; align-items:stretch; border-bottom:1.5px solid #000; }
        .pi-lbl { font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:800; text-transform:uppercase; padding:3px 8px; min-width:60px; display:flex; align-items:center; border-right:1.5px solid #000; }
        .pi-val { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:900; padding:3px 8px; display:flex; align-items:center; flex:1; }
        .pi-val.art { font-size:22px; }
        .pi-sizes { border-bottom:1.5px solid #000; flex-shrink:0; }
        .pi-sh { font-family:'Barlow Condensed',sans-serif; font-size:10px; font-weight:800; text-transform:uppercase; padding:3px 0; text-align:center; border-right:1.5px solid #000; }
        .pi-sh:first-child { text-align:left; padding-left:8px; min-width:60px; }
        .pi-sh.tc { background:#000; color:#fff; border-right:none; min-width:45px; }
        .pi-sc { font-family:'Barlow Condensed',sans-serif; font-size:17px; font-weight:900; text-align:center; padding:3px 0; border-right:1.5px solid #000; }
        .pi-sc.lc { font-size:10px; font-weight:800; text-transform:uppercase; text-align:left; padding-left:8px; }
        .pi-sc.tc { font-size:18px; color:#fff; background:#000; border-right:none; min-width:45px; }
        .pi-pkgs { display:flex; align-items:center; justify-content:space-between; padding:4px 8px; border-bottom:1.5px solid #000; flex-shrink:0; }
        .pi-pkgs-lbl { font-family:'Barlow Condensed',sans-serif; font-size:10px; font-weight:800; text-transform:uppercase; }
        .pi-pkgs-val { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:900; }
        .pi-pkgs-val span { font-size:10px; font-weight:800; margin-left:2px; text-transform:uppercase; }
        .pi-bot { display:flex; align-items:stretch; border-bottom:1.5px solid #000; flex:1; }
        .pi-origin { flex:1; display:flex; flex-direction:column; justify-content:center; padding:4px 8px; border-right:1.5px solid #000; gap:1px; }
        .pi-origin .mil { font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:900; text-transform:uppercase; }
        .pi-origin .mfg { font-family:'Barlow Condensed',sans-serif; font-size:9px; font-weight:700; text-transform:uppercase; }
        .pi-origin .fw { font-family:'Barlow Condensed',sans-serif; font-size:10px; font-weight:900; text-transform:uppercase; }
        .pi-bc { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px; }
        .pi-footer { padding:3px 8px; display:flex; flex-direction:column; gap:1px; flex-shrink:0; }
        .pi-fl { font-family:'Barlow Condensed',sans-serif; font-size:9px; font-weight:700; line-height:1.2; text-transform:uppercase; }
        .pi-fl strong { font-weight:900; }
      `}</style>
      <div className="no-print" style={{ display:'flex', gap:'12px', marginBottom:'24px' }}>
        <button onClick={onClose} className="btn-corp" style={{ background:'#fff', color:'#475569', border:'1px solid #cbd5e1', padding:'12px 24px', borderRadius:'8px', fontWeight:700 }}>&larr; Back to Inventory</button>
        <button onClick={() => window.print()} className="btn-corp" style={{ background:'#10b981', color:'white', border:'none', padding:'12px 24px', borderRadius:'8px', fontWeight:800 }}>Print Sticker</button>
      </div>
      <div className="sticker-wrap">
        <div className="pi-sticker">
          <div className="pi-hdr">
            <div className="brand">{brandName}</div>
            <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
              <span className="atag">Assortment</span>
              <span className="badge">Master Carton</span>
            </div>
          </div>
          <div className="pi-body">
            <div className="pi-row"><div className="pi-lbl">Art No.</div><div className="pi-val art">{article}</div></div>
            <div className="pi-row"><div className="pi-lbl">Colour</div><div className="pi-val">{colour}</div></div>
            <div className="pi-row"><div className="pi-lbl">Size</div><div className="pi-val" style={{ fontSize:'20px' }}>{aggregatedSizeStr}</div></div>
            {mrp && (<div className="pi-row"><div className="pi-lbl">MRP</div><div className="pi-val">&#8377;{parseFloat(mrp).toFixed(2)}</div></div>)}
            <div className="pi-sizes">
              <div style={{ display:'grid', gridTemplateColumns:`60px repeat(${activeSizes.length}, 1fr) 45px`, borderBottom:'1px solid #000' }}>
                <div className="pi-sh">Size</div>
                {activeSizes.map((s) => <div key={s.size} className="pi-sh">{s.size}</div>)}
                <div className="pi-sh tc">Total</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:`60px repeat(${activeSizes.length}, 1fr) 45px` }}>
                <div className="pi-sc lc">Qty(pr)</div>
                {activeSizes.map((s) => <div key={s.size} className="pi-sc">{s.scanned}</div>)}
                <div className="pi-sc tc">{totalPairs}</div>
              </div>
            </div>
            <div className="pi-pkgs">
              <span className="pi-pkgs-lbl">No. of Packages</span>
              <span className="pi-pkgs-val">{totalPairs} <span>Pairs</span></span>
            </div>
            <div className="pi-bot">
              <div className="pi-origin">
                <div className="mil">Made in India</div>
                <div className="mfg">Mfg: {mfgDate}</div>
                <div className="fw">Footwear</div>
              </div>
              <div className="pi-bc">
                <Barcode value={barcodeValue} format="CODE128" width={1.6} height={22} displayValue={false} margin={0} background="#ffffff" />
              </div>
            </div>
          </div>
          <div className="pi-footer">
            <div className="pi-fl"><strong>Mfd. &amp; Pkd. By:</strong> {mfdBy}</div>
            <div className="pi-fl"><strong>Mktd. By:</strong> {mktdBy}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
