'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { downloadCSV, formatIST } from '@/lib/exportCSV';
import ExportDropdown from '@/components/ExportDropdown';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';

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
  const [user, setUser] = useState<any>(null);

  // Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetCount, setResetCount] = useState(0);

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

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setUser(data.user);
        }
      })
      .catch(err => console.error('Error fetching user:', err));
  }, []);

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

  const handleResetClick = () => {
    if (!window.confirm("Are you sure you want to reset the packed inventory history?")) return;
    
    setIsResetting(true);
    fetch('/api/packed-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'CONFIRM_RESET' })
    })
      .then(res => res.json())
      .then(data => {
        setIsResetting(false);
        if (data.success) {
          alert(data.message || 'Packed inventory reset successfully.');
          fetchInventoryData(); // Refresh table
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
      Number(item.total_pairs) || 0,
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
  const totalPairs = filteredInventory.reduce((acc, curr) => acc + (Number(curr.total_pairs) || 0), 0);
  
  const uniqueModels = new Set(
    filteredInventory.map(item => `${item.article_code}-${item.colour}`)
  ).size;

  // Format Date layout cleanly
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      let parsedStr = dateStr;
      if (dateStr && !dateStr.includes('T') && !dateStr.includes('Z') && dateStr.includes(' ')) {
        parsedStr = dateStr.replace(' ', 'T') + 'Z';
      }
      const date = new Date(parsedStr);
      if (isNaN(date.getTime())) return dateStr;
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
        {viewMode === 'history' && canReset && (
          <button 
            onClick={handleResetClick}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)'
            }}
          >
            ⚠️ Reset History
          </button>
        )}
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
  
  const defaultMonthYear = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase().replace(' ', ' ');
  const [mfgMonth, setMfgMonth] = useState(defaultMonthYear);

  const [printWidth, setPrintWidth] = useState<number>(10);
  const [printHeight, setPrintHeight] = useState<number>(10);
  const [printUnit, setPrintUnit] = useState<string>('cm');

  const dimensionStr = `${printWidth}${printUnit} ${printHeight}${printUnit}`;
  const widthStr = `${printWidth}${printUnit}`;
  const heightStr = `${printHeight}${printUnit}`;

  // Design Style Toggle
  const [designStyle, setDesignStyle] = useState<'1' | '2'>('2');

  return (
    <div style={{ background: '#e2e8f0', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }} className="print-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800;900&family=Barlow+Condensed:wght@600;700;800;900&display=swap');
        @page { size: ${dimensionStr}; margin: 0; }
        @media print {
          html, body, main { 
            margin: 0 !important; 
            padding: 0 !important; 
            width: ${widthStr} !important; 
            height: ${heightStr} !important; 
            max-width: ${widthStr} !important; 
            max-height: ${heightStr} !important; 
            min-height: 0 !important;
            overflow: hidden !important; 
            box-sizing: border-box !important;
          }
          body * { visibility: hidden; }
          .print-wrapper { 
            background: white !important; 
            padding: 0 !important; 
            margin: 0 !important;
            width: ${widthStr} !important; 
            height: ${heightStr} !important; 
            min-height: 0 !important;
            max-height: ${heightStr} !important;
            overflow: hidden !important; 
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
          }
          .sticker-wrap, .sticker-wrap * { visibility: visible; }
          .sticker-wrap {
            position: absolute !important;
            left: 2mm !important;
            top: 2mm !important;
            width: calc(${widthStr} - 4mm) !important;
            height: calc(${heightStr} - 4mm) !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            border: none !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          .no-print { display: none !important; }
          .pi-sticker { box-shadow: none !important; border: 2px solid #000 !important; width: 100% !important; height: 100% !important; margin: 0 !important; overflow: hidden; }
          .jokot-sticker { border: 2px solid #000 !important; box-shadow: none !important; width: 100% !important; height: 100% !important; margin: 0 !important; overflow: hidden !important; box-sizing: border-box !important; }
        }
        
        .pi-sticker { width:${widthStr}; height:${heightStr}; background:#fff; border:2px solid #000; font-family:'Barlow',sans-serif; overflow:hidden; box-sizing:border-box; display:flex; flex-direction:column; }
        .pi-body { display:flex; flex-direction:column; flex:1; overflow:hidden; }
        .pi-row { display:flex; align-items:stretch; border-bottom:1.5px solid #000; flex:1; }
        .pi-lbl { font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:800; text-transform:uppercase; padding:4px 8px; min-width:60px; display:flex; align-items:center; border-right:1.5px solid #000; }
        .pi-val { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:900; padding:4px 8px; display:flex; align-items:center; flex:1; }
        .pi-val.art { font-size:24px; }
        .pi-val.size-roman { font-family: Georgia, 'Times New Roman', Times, serif; font-size:32px; font-weight:900; letter-spacing:0; color:#000; }
        .pi-sizes { border-bottom:1.5px solid #000; }
        .pi-sh { font-family:'Barlow Condensed',sans-serif; font-size:10px; font-weight:800; text-transform:uppercase; padding:4px 0; text-align:center; border-right:1.5px solid #000; }
        .pi-sh:first-child { text-align:left; padding-left:8px; min-width:60px; }
        .pi-sh.tc { background:#fff; color:#000; border-right:none; min-width:45px; }
        .pi-sc { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:900; text-align:center; padding:4px 0; border-right:1.5px solid #000; }
        .pi-sc.lc { font-size:11px; font-weight:800; text-transform:uppercase; text-align:left; padding-left:8px; }
        .pi-sc.tc { font-size:20px; color:#000; background:#fff; border-right:none; min-width:45px; }
        .pi-pkgs { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; border-bottom:1.5px solid #000; }
        .pi-pkgs-lbl { font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:800; text-transform:uppercase; }
        .pi-pkgs-val { font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:900; }
        .pi-pkgs-val span { font-size:10px; font-weight:800; margin-left:2px; text-transform:uppercase; }
        .pi-bc { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:6px; flex:1; }

        /* JOKOT STYLES */
        .jokot-sticker {
          width: ${widthStr};
          height: ${heightStr};
          background: #ffffff;
          border: 2px solid #000;
          font-family: Arial, Helvetica, sans-serif;
          overflow: hidden;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          color: #000;
        }
        .jk-row { display: flex; border-bottom: 1.5px solid #000; align-items: stretch; }
        .jk-label { font-size: 14px; font-weight: 900; padding: 4px 8px; border-right: 1.5px solid #000; display: flex; align-items: center; text-transform: uppercase; }
        .jk-val { font-size: 22px; font-weight: 900; padding: 4px 8px; display: flex; align-items: center; justify-content: center; text-transform: uppercase; }
        .jk-input { border: none; font-size: 13px; font-weight: 900; width: 80px; text-transform: uppercase; outline: none; background: transparent; }
      `}</style>
      <div className="no-print" style={{ 
        display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', 
        background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)',
        padding: '24px', borderRadius: '20px', boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.1), 0 10px 20px -10px rgba(0, 0, 0, 0.05)',
        border: '1px solid rgba(255,255,255,1)',
        width: '100%', maxWidth: '640px', margin: '0 auto 24px auto',
        transform: 'translateZ(0)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', padding: '6px 10px', borderRadius: '8px', fontSize: '16px', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)' }}>⚙️</span>
            Print Configuration
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} className="btn-corp" style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}>
              ← Back to Inventory
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '4px' }}>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Width</label>
            <div style={{ position: 'relative' }}>
              <input type="number" value={printWidth} onChange={e => setPrintWidth(Number(e.target.value))} style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '18px', fontWeight: 700, color: '#0f172a', outline: 'none', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)', background: '#f8fafc' }} onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'; }} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Height</label>
            <div style={{ position: 'relative' }}>
              <input type="number" value={printHeight} onChange={e => setPrintHeight(Number(e.target.value))} style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '18px', fontWeight: 700, color: '#0f172a', outline: 'none', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)', background: '#f8fafc' }} onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'; }} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '130px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unit</label>
            <select value={printUnit} onChange={e => setPrintUnit(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '16px', fontWeight: 700, color: '#0f172a', outline: 'none', appearance: 'none', background: '#f8fafc url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E") no-repeat right 14px center', backgroundSize: '12px', transition: 'all 0.2s' }} onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = '#fff url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E") no-repeat right 14px center'; e.target.style.backgroundSize = '12px'; e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E") no-repeat right 14px center'; e.target.style.backgroundSize = '12px'; e.target.style.boxShadow = 'none'; }}>
              <option value="cm">cm (Centimeters)</option>
              <option value="mm">mm (Millimeters)</option>
              <option value="in">in (Inches)</option>
            </select>
          </div>
          <div style={{ flex: '1 0 100%', marginTop: '8px', padding: '12px', background: '#f1f5f9', borderRadius: '12px', border: '1.5px solid #e2e8f0', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Design Style:</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: designStyle === '1' ? 800 : 600, color: designStyle === '1' ? '#0f172a' : '#64748b' }}>
              <input type="radio" name="designStyle_inv" value="1" checked={designStyle === '1'} onChange={() => setDesignStyle('1')} style={{ accentColor: '#3b82f6', width: '16px', height: '16px', cursor: 'pointer' }} />
              1. Vertical Grid
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: designStyle === '2' ? 800 : 600, color: designStyle === '2' ? '#0f172a' : '#64748b' }}>
              <input type="radio" name="designStyle_inv" value="2" checked={designStyle === '2'} onChange={() => setDesignStyle('2')} style={{ accentColor: '#3b82f6', width: '16px', height: '16px', cursor: 'pointer' }} />
              2. Horizontal Headers (Large Fonts)
            </label>
          </div>

          <div style={{ flex: '1 0 100%', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button onClick={() => window.print()} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '12px', fontSize: '18px', fontWeight: 800, boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4), 0 4px 6px -2px rgba(16, 185, 129, 0.2)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '10px' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 24px -5px rgba(16, 185, 129, 0.5), 0 6px 10px -2px rgba(16, 185, 129, 0.3)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(16, 185, 129, 0.4), 0 4px 6px -2px rgba(16, 185, 129, 0.2)'; }} onMouseDown={e => { e.currentTarget.style.transform = 'translateY(1px)'; e.currentTarget.style.boxShadow = '0 4px 10px -3px rgba(16, 185, 129, 0.3)'; }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              PRINT STICKER
            </button>
          </div>
        </div>
      </div>
      <div className="sticker-wrap" style={{ padding: '20px', display: 'flex', justifyContent: 'center', width: '100%', overflow: 'auto' }}>
        <div className="jokot-sticker" style={{
            display: 'grid',
            gridTemplateRows: isJokot
              ? (designStyle === '2' ? '2.5fr 1fr 1fr 2fr 1.5fr' : '1.2fr 1fr 1fr 1fr 1fr 1fr 2fr 1.5fr')
              : (designStyle === '2' ? '0.8fr 1.8fr 1fr 1fr 2fr 1.5fr' : '0.6fr 1fr 1fr 1fr 1fr 1fr 1fr 2fr 1.5fr'),
            width: widthStr,
            height: heightStr,
            border: '2.5px solid #000',
            boxSizing: 'border-box',
            overflow: 'hidden',
            background: '#fff',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
            fontFamily: 'Arial, Helvetica, sans-serif',
            color: '#000',
            margin: '0 auto',
            padding: '0'
          }}>
            {!isJokot && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0, background: '#f8fafc' }}>
                <span style={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", "Georgia", cursive', fontSize: 'clamp(16px, 4vw, 24px)', fontWeight: 700, letterSpacing: '1.5px' }}>Lunar's</span>
              </div>
            )}
            {designStyle === '1' ? (
              <>
                {/* Row 1: ART NO */}
                <div style={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
                  <div style={{ width: '28%', flexShrink: 0, borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', padding: '0 2px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', boxSizing: 'border-box', margin: 0 }}>ART NO:</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(14px,3vw,24px)', fontWeight: 900, overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>{article}</div>
                </div>
                {/* Row 2: COLOR */}
                <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
                  <div style={{ width: '28%', flexShrink: 0, borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', padding: '0 2px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', boxSizing: 'border-box', margin: 0 }}>COLOR</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(12px,2vw,18px)', fontWeight: 900, overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>{colour}</div>
                </div>
                {/* Row 3: SIZE range */}
                <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
                  <div style={{ width: '28%', flexShrink: 0, borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', padding: '0 2px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', boxSizing: 'border-box', margin: 0 }}>SIZE</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(12px,2vw,18px)', fontWeight: 900, overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>{aggregatedSizeStr.replace('x', 'X')}</div>
                </div>
                {/* Row 4: MRP */}
                <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
                  <div style={{ width: '28%', flexShrink: 0, borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', padding: '0 2px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', boxSizing: 'border-box', margin: 0 }}>MRP</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(12px,2vw,18px)', fontWeight: 900, overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>{mrp ? parseFloat(mrp).toFixed(2) : '0.00'}</div>
                </div>
              </>
            ) : (
              /* Style 2: Horizontal Headers */
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.6fr 0.8fr', borderBottom: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1.5px solid #000', padding: '2px', background: '#f8fafc', margin: 0, textAlign: 'center' }}>ART NO</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(26px, 6vw, 52px)', fontWeight: 900, textAlign: 'center', padding: '0 2px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1 }}>{article}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1.5px solid #000', padding: '2px', background: '#f8fafc', margin: 0, textAlign: 'center' }}>COLOR</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(20px, 4.5vw, 36px)', fontWeight: 900, textAlign: 'center', padding: '0 2px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1 }}>{colour}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1.5px solid #000', padding: '2px', background: '#f8fafc', margin: 0, textAlign: 'center' }}>SIZE</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(20px, 4.5vw, 36px)', fontWeight: 900, textAlign: 'center', padding: '0 2px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1 }}>{aggregatedSizeStr.replace('x', 'X')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1.5px solid #000', padding: '2px', background: '#f8fafc', margin: 0, textAlign: 'center' }}>MRP</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(20px, 4.5vw, 36px)', fontWeight: 900, textAlign: 'center', padding: '0 2px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1 }}>{mrp ? parseFloat(mrp).toFixed(2) : '0.00'}</div>
                </div>
              </div>
            )}
            {/* Row 5: SIZE headers */}
            <div style={{ display: 'grid', gridTemplateColumns: `28% repeat(${activeSizes.length}, 1fr) 14%`, borderBottom: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
              <div style={{ borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', boxSizing: 'border-box', margin: 0 }}>SIZE</div>
              {activeSizes.map((s: any) => (
                <div key={`sh-${s.size}`} style={{ borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 900, boxSizing: 'border-box', margin: 0, padding: 0 }}>{s.size}</div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, boxSizing: 'border-box', margin: 0, padding: 0 }}>Total</div>
            </div>
            {/* Row 6: QTY values */}
            <div style={{ display: 'grid', gridTemplateColumns: `28% repeat(${activeSizes.length}, 1fr) 14%`, borderBottom: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
              <div style={{ borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1, boxSizing: 'border-box', margin: 0 }}>QTY<br />(PAIR)</div>
              {activeSizes.map((s: any) => (
                <div key={`qd-${s.size}`} style={{ borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 900, boxSizing: 'border-box', margin: 0, padding: 0 }}>{Number(s.scanned)}</div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 900, boxSizing: 'border-box', margin: 0, padding: 0 }}>{totalPairs}</div>
            </div>
            {/* Row 7: NO OF PACKAGES + MADE IN INDIA + QR (nested 2-row grid, QR spans both) */}
            <div style={{ display: 'grid', gridTemplateColumns: '28% 1fr 22%', gridTemplateRows: '1fr 1fr', borderBottom: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
              <div style={{ gridRow: '1', gridColumn: '1', borderRight: '1.5px solid #000', borderBottom: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', fontSize: '10px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.3, boxSizing: 'border-box', margin: 0 }}>NO OF<br />PACKAGES</div>
              <div style={{ gridRow: '1', gridColumn: '2', borderRight: '1.5px solid #000', borderBottom: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 900, boxSizing: 'border-box', margin: 0, padding: 0 }}>{totalPairs}</div>
              <div style={{ gridRow: '1 / 3', gridColumn: '3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', boxSizing: 'border-box', overflow: 'hidden', margin: 0 }}>
                <QRCodeSVG value={barcodeValue || 'N/A'} style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', display: 'block' }} level="M" />
              </div>
              <div style={{ gridRow: '2', gridColumn: '1', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', fontSize: '10px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', boxSizing: 'border-box', margin: 0 }}>MADE IN INDIA</div>
              <div style={{ gridRow: '2', gridColumn: '2', borderRight: '1.5px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, boxSizing: 'border-box', overflow: 'hidden', margin: 0, padding: 0 }}>
                <span style={{ fontSize: '9px', fontWeight: 900, margin: 0, padding: 0 }}>Month of mF-</span>
                <input type="text" value={mfgMonth} onChange={e => setMfgMonth(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', width: '95%', textAlign: 'center', margin: 0, padding: 0 }} />
              </div>
            </div>
            {/* Row 8: Footer (Merged) */}
            <div style={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden', boxSizing: 'border-box', margin: 0, padding: 0 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 3px', borderRight: '1.5px solid #000', overflow: 'hidden', boxSizing: 'border-box' }}>
                <div style={{ fontSize: designStyle === '2' ? '11px' : '9px', fontWeight: 900, margin: 0, padding: 0, lineHeight: 1.2 }}>Mfd.&amp; Pkd. By : MATHEW RUBBERS</div>
                <div style={{ fontSize: designStyle === '2' ? '9.5px' : '8px', fontWeight: 800, margin: 0, padding: 0, lineHeight: 1.2 }}>5/37/8, K.G Chavadi, Coimbatore-105</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 3px', overflow: 'hidden', boxSizing: 'border-box' }}>
                <div style={{ fontSize: designStyle === '2' ? '11px' : '9px', fontWeight: 900, margin: 0, padding: 0, lineHeight: 1.2 }}>Mktd.By : {isJokot ? 'JOKOT INTERNATIONAL' : 'VIKING RUBBERS PVT LTD'}</div>
                <div style={{ fontSize: designStyle === '2' ? '9.5px' : '8px', fontWeight: 800, margin: 0, padding: 0, lineHeight: 1.2 }}>{isJokot ? 'Ph: +91 8867915043, Email: jokot.international@gmail.com' : 'Ph: 0485-2835222, Email: customercare@lunars.in'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

