'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

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
  const [hideZero, setHideZero] = useState(false);

  useEffect(() => {
    fetch('/api/inventory-pool')
      .then(res => res.json())
      .then(data => {
        if (data.inventory) setInventory(data.inventory);
        setLoading(false);
      });
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
    setHideZero(false);
    setSortField('');
  };

  // Client-side search filtering
  const filteredInventory = inventory.filter(item => {
    const matchesArticle = item.article_code.toLowerCase().includes(filterArticle.toLowerCase());
    const matchesColour = item.colour.toLowerCase().includes(filterColour.toLowerCase());
    const matchesZero = !hideZero || item.total_qty > 0;
    return matchesArticle && matchesColour && matchesZero;
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
      </div>

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

        <button className={styles.resetBtn} onClick={handleResetFilters}>
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
