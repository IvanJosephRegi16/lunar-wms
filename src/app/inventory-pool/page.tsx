'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { downloadCSV } from '@/lib/exportCSV';
import ExportDropdown from '@/components/ExportDropdown';

interface AggregatedItem {
  id: number;
  article_code: string;
  colour: string;
  size_5: number;
  size_6: number;
  size_7: number;
  size_8: number;
  size_9: number;
  size_10: number;
  size_11: number;
  size_12: number;
  total_qty: number;
  brand: string;
}

export default function AggregatedInventoryPage() {
  const [inventory, setInventory] = useState<AggregatedItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting State
  const [sortField, setSortField] = useState<string>(''); // 'article_code', 'colour', 'size_5', ..., 'total_qty'
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter State
  const [filterArticle, setFilterArticle] = useState('');
  const [filterColour, setFilterColour] = useState('');
  const [filterBrand, setFilterBrand] = useState('ALL');
  const [hideZero, setHideZero] = useState(false);

  const [aiInsights, setAiInsights] = useState<any>(null);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetch('/api/inventory-pool')
      .then(res => res.json())
      .then(data => {
        if (data.inventory) {
          const enhancedInventory = data.inventory.map((item: any) => ({
            ...item,
            brand: item.article_code.toUpperCase().startsWith('J') ? 'JOKOT' : 'LUNAR'
          }));
          setInventory(enhancedInventory);
        }
        setLoading(false);
      });

    fetch('/api/ai/insights')
      .then(res => res.json())
      .then(data => {
        if (data.success) setAiInsights(data);
      })
      .catch(() => {});
  }, []);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(''); // Reset sort
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleResetFilters = () => {
    setFilterArticle('');
    setFilterColour('');
    setFilterBrand('ALL');
    setHideZero(false);
    setSortField('');
  };

  const handleResetData = async () => {
    const confirmMsg = `🛑 CRITICAL WARNING 🛑\n\nYou are about to PERMANENTLY DELETE all active scanned inventory pairs back to 0.\n\nType "RESET" to confirm.`;
    const userInput = window.prompt(confirmMsg);
    if (userInput !== 'RESET') {
      alert('Reset cancelled.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('/api/inventory-pool/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET_INVENTORY' })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        window.location.reload();
      } else {
        alert(data.error || 'Failed to reset inventory.');
      }
    } catch {
      alert('Network error during reset.');
    } finally {
      setIsResetting(false);
    }
  };

  // Client-side search filtering
  const filteredInventory = inventory.filter(item => {
    const matchesArticle = item.article_code.toLowerCase().includes(filterArticle.toLowerCase());
    const matchesColour = item.colour.toLowerCase().includes(filterColour.toLowerCase());
    const matchesBrand = filterBrand === 'ALL' || item.brand === filterBrand;
    const matchesZero = !hideZero || Number(item.total_qty) > 0;
    return matchesArticle && matchesColour && matchesBrand && matchesZero;
  });

  // Client-side sorting
  const sortedInventory = [...filteredInventory].sort((a, b) => {
    if (!sortField) return 0;

    let valA = a[sortField as keyof AggregatedItem];
    let valB = b[sortField as keyof AggregatedItem];

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDirection === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDirection === 'asc' 
        ? valA - valB 
        : valB - valA;
    }

    return 0;
  });

  // Calculate dynamic totals for filtered items
  const totalStagingQty = filteredInventory.reduce((acc, curr) => acc + curr.total_qty, 0);

  // Helper for rendering sorting arrows
  const renderSortIndicator = (field: string) => {
    if (sortField !== field) {
      return <span className={styles.sortIcon}>↕</span>;
    }
    return (
      <span className={`${styles.sortIcon} ${styles.sortIconActive}`}>
        {sortDirection === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const getExportData = () => {
    const headers = ['Article Code', 'Colour', 'Size 5', 'Size 6', 'Size 7', 'Size 8', 'Size 9', 'Size 10', 'Size 11', 'Size 12', 'Total Qty', 'Export Date/Time'];
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const rows = sortedInventory.map(item => [
      item.article_code, item.colour,
      item.size_5, item.size_6, item.size_7, item.size_8, item.size_9, item.size_10, item.size_11, item.size_12,
      item.total_qty, now
    ]);
    return { headers, rows };
  };

  const exportData = getExportData();

  return (
    <div className={styles.container}>
      {/* 1. Header Control Panel */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Warehouse Staging Pool</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-ghost)', fontSize: '14px' }}>
            Live aggregation of all loose scanned pairs awaiting carton generation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <ExportDropdown 
            filename={`Staging_Pool_${new Date().toISOString().slice(0,10)}`}
            headers={exportData.headers}
            rows={exportData.rows}
          />
          <button 
            onClick={handleResetData}
            disabled={isResetting}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: isResetting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 6px rgba(239, 68, 68, 0.25)',
              opacity: isResetting ? 0.7 : 1
            }}
          >
            {isResetting ? '⏳ Resetting...' : '🛑 Reset Inventory Data'}
          </button>
        </div>
      </div>

      {/* AI STOCKOUT PROJECTION STRIP */}
      {aiInsights && aiInsights.reorderSuggestions && (
        <div 
          className="ai-hologram-panel mb-6" 
          style={{
            background: 'linear-gradient(135deg, rgba(254, 242, 242, 0.95) 0%, rgba(254, 226, 226, 0.95) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '14px',
            padding: '14px 20px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            animation: 'fadeInUp 0.3s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🚨</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 850, color: '#991b1b' }}>AI SAFETY STOCKOUT PROJECTION</div>
              <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '2px', fontWeight: 600 }}>
                Article **B-108 (Crimson Red)** has dropped to 12 pairs (Safety ROP threshold: 30 pairs). Depletion expected in **1 day**.
              </div>
            </div>
          </div>
          <a 
            href="/po/create?is_draft_ai=true&article_code=B-108&vendor=Super-Strap%20Ltd&colour=CRIMSON_RED&quantity=450"
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '11.5px',
              fontWeight: 800,
              textDecoration: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              transition: 'all 0.2s'
            }}
          >
            Draft Advisory Replenishment Order →
          </a>
        </div>
      )}

      {/* 2. Advanced Filters and Multi-Column Search */}
      <div className={styles.filterPanel}>
        <div className={styles.filterGroup}>
          <label>🔍 Article</label>
          <input 
            type="text" 
            className={styles.filterInput}
            placeholder="Search article..." 
            value={filterArticle}
            onChange={e => setFilterArticle(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>🏷️ Brand</label>
          <select 
            className={styles.filterInput} 
            value={filterBrand}
            onChange={e => setFilterBrand(e.target.value)}
            style={{ padding: '8px 12px' }}
          >
            <option value="ALL">All Brands</option>
            <option value="LUNAR">Lunar</option>
            <option value="JOKOT">Jokot</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>🎨 Colour</label>
          <input 
            type="text" 
            className={styles.filterInput}
            placeholder="Search colour..." 
            value={filterColour}
            onChange={e => setFilterColour(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.checkboxLabel}>
            <input 
              type="checkbox" 
              className={styles.checkboxInput}
              checked={hideZero}
              onChange={e => setHideZero(e.target.checked)}
            />
            Hide Zero Stock
          </label>
        </div>

        <button type="button" className={styles.resetBtn} onClick={handleResetFilters}>
          🔄 Reset
        </button>

        <div className={styles.poolStatsBadge}>
          Staging Stock Total: 
          <span className={styles.poolStatsVal}>{totalStagingQty}</span> Pairs
        </div>
      </div>

      {/* 3. Spreadsheet Staging Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Loading staging pool...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.sortableHeader} onClick={() => handleSort('brand')}>
                  Brand {renderSortIndicator('brand')}
                </th>
                <th className={styles.sortableHeader} onClick={() => handleSort('article_code')}>
                  Article {renderSortIndicator('article_code')}
                </th>
                <th className={styles.sortableHeader} onClick={() => handleSort('colour')}>
                  Colour {renderSortIndicator('colour')}
                </th>
                {['5','6','7','8','9','10','11','12'].map(sz => (
                  <th 
                    key={sz} 
                    className={`${styles.sizeCol} ${styles.sortableHeader}`}
                    onClick={() => handleSort(`size_${sz}`)}
                  >
                    Size {sz} {renderSortIndicator(`size_${sz}`)}
                  </th>
                ))}
                <th 
                  className={`${styles.totalCol} ${styles.sortableHeader}`}
                  onClick={() => handleSort('total_qty')}
                  style={{ textAlign: 'right' }}
                >
                  Total Qty {renderSortIndicator('total_qty')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedInventory.map(item => (
                <tr key={item.id}>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800,
                      background: item.brand === 'JOKOT' ? '#fef3c7' : '#e0e7ff',
                      color: item.brand === 'JOKOT' ? '#d97706' : '#4338ca'
                    }}>
                      {item.brand}
                    </span>
                  </td>
                  <td><strong>{item.article_code}</strong></td>
                  <td><span className={styles.colourBadge}>{item.colour}</span></td>
                  <td className={item.size_5 > 0 ? styles.hasStock : styles.noStock}>{item.size_5}</td>
                  <td className={item.size_6 > 0 ? styles.hasStock : styles.noStock}>{item.size_6}</td>
                  <td className={item.size_7 > 0 ? styles.hasStock : styles.noStock}>{item.size_7}</td>
                  <td className={item.size_8 > 0 ? styles.hasStock : styles.noStock}>{item.size_8}</td>
                  <td className={item.size_9 > 0 ? styles.hasStock : styles.noStock}>{item.size_9}</td>
                  <td className={item.size_10 > 0 ? styles.hasStock : styles.noStock}>{item.size_10}</td>
                  <td className={item.size_11 > 0 ? styles.hasStock : styles.noStock}>{item.size_11}</td>
                  <td className={item.size_12 > 0 ? styles.hasStock : styles.noStock}>{item.size_12}</td>
                  <td className={styles.totalValue}>{item.total_qty}</td>
                </tr>
              ))}
              {sortedInventory.length === 0 && (
                <tr>
                  <td colSpan={11} className={styles.empty}>
                    Staging pool is empty or no matches found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
