'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<'staging' | 'dispatched'>('staging');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(d => {
        setStats(d);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading-dot" style={{ margin: '100px auto', display: 'table' }}>Establishing System Parity...</div>;

  // Formatting IST dates inside list
  const formatISTDateTime = (dateStr: string) => {
    try {
      let parsed = dateStr;
      if (dateStr && !dateStr.includes('T') && !dateStr.includes('Z') && dateStr.includes(' ')) {
        parsed = dateStr.replace(' ', 'T') + 'Z';
      }
      return new Date(parsed).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Helper for generating custom SVG points for Area/Curve Graph
  const generateCurvePoints = (data: { size: string; total_qty: number }[]) => {
    if (!data || data.length === 0) return { path: '', areaPath: '', coords: [], maxQty: 1 };
    const width = 600;
    const height = 220;
    const leftPadding = 50;
    const rightPadding = 20;
    const topPadding = 20;
    const bottomPadding = 30;

    const chartW = width - leftPadding - rightPadding;
    const chartH = height - topPadding - bottomPadding;

    const maxQty = Math.max(...data.map(d => d.total_qty), 1);
    const xStep = chartW / (data.length - 1 || 1);

    const coords = data.map((d, index) => {
      const x = leftPadding + index * xStep;
      const y = height - bottomPadding - (d.total_qty / maxQty) * chartH;
      return { x, y, value: d.total_qty, size: d.size };
    });

    // Generate Bezier path string
    let path = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const cpX1 = curr.x + xStep / 2;
      const cpY1 = curr.y;
      const cpX2 = next.x - xStep / 2;
      const cpY2 = next.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
    }

    const areaPath = `${path} L ${coords[coords.length - 1].x} ${height - bottomPadding} L ${coords[0].x} ${height - bottomPadding} Z`;

    return { path, areaPath, coords, maxQty, height, bottomPadding, leftPadding, width };
  };

  // Helper for generating Column Coordinates
  const generateColumnCoordinates = (data: { size: string; total_qty: number }[]) => {
    if (!data || data.length === 0) return { columns: [], maxQty: 1 };
    const width = 600;
    const height = 220;
    const leftPadding = 50;
    const rightPadding = 20;
    const topPadding = 20;
    const bottomPadding = 30;

    const chartW = width - leftPadding - rightPadding;
    const chartH = height - topPadding - bottomPadding;

    const maxQty = Math.max(...data.map(d => d.total_qty), 1);
    const colWidth = 28;
    const xStep = chartW / (data.length || 1);

    const columns = data.map((d, index) => {
      const colHeight = (d.total_qty / maxQty) * chartH;
      const x = leftPadding + index * xStep + (xStep - colWidth) / 2;
      const y = height - bottomPadding - colHeight;
      return { x, y, width: colWidth, height: colHeight, value: d.total_qty, size: d.size };
    });

    return { columns, maxQty, height, bottomPadding, leftPadding, width };
  };

  // Compute active graphs
  const stagingData = stats?.stagingPoolDistribution || [];
  const dispatchedData = stats?.packedDistributionToday || [];
  const dispersionData = stats?.sizeDistribution || [];

  // Generate curves explicitly for both separate rows
  const stagingCurve = generateCurvePoints(stagingData);
  const dispersionCurve = generateCurvePoints(dispersionData);
  const dispatchedColumns = generateColumnCoordinates(dispatchedData);

  // Compute active packaging rules percentage values
  const activeRules = stats?.activeRulesDistribution || [];
  const maxCartonsInRule = Math.max(...activeRules.map((r: any) => r.carton_count), 1);

  return (
    <div className={styles.container}>

      {/* SECTION 1: GENERAL WAREHOUSE INVENTORY (OUTSTOCK) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', margin: 0 }}>
          <span>🏢</span> Outstock (General Warehouse) Statistics
        </h2>

        {/* METRICS ROW (OUTSTOCK) */}
        <div className={styles.metricsGrid}>
          <div className={`${styles.metricCard} ${styles.cardTotalStock}`}>
            <span className={styles.metricLabel}>Total Warehouse Stock</span>
            <span className={`${styles.metricValue} num-mono`}>
              {(stats?.totals?.warehouse_total || 0).toLocaleString()}
            </span>
            <span className={styles.metricSubText} style={{ color: '#6366f1' }}>Overall Net Warehouse Stock</span>
          </div>

          <div className={`${styles.metricCard} ${styles.cardInward}`}>
            <span className={styles.metricLabel}>Today's Total Inward</span>
            <span className={`${styles.metricValue} num-mono`}>
              +{(stats?.totals?.today_production || 0).toLocaleString()}
            </span>
            <span className={styles.metricSubText} style={{ color: '#a855f7' }}>Production Stock Added</span>
          </div>

          <div className={`${styles.metricCard} ${styles.cardOutward}`}>
            <span className={styles.metricLabel}>Today's Total Outward</span>
            <span className={`${styles.metricValue} num-mono`}>
              {(stats?.totals?.today_dispatch || 0).toLocaleString()}
            </span>
            <span className={styles.metricSubText} style={{ color: '#ef4444' }}>Ledger Stock Dispatched</span>
          </div>
        </div>

        {/* GRAPHS ROW (OUTSTOCK) */}
        <div className={styles.chartsGrid}>
          {/* GENERAL DISPERSION CURVE CHART */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>🏢 General Stock size dispersion</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Warehouse Equity Matrix</span>
            </div>

            <div className={styles.svgContainer}>
              <svg className={styles.svgFrame} viewBox="0 0 600 220" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartIndigoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                {[0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const yVal = 220 - 30 - ratio * 170;
                  return (
                    <line key={i} x1="50" y1={yVal} x2="580" y2={yVal} className={styles.chartGridLine} />
                  );
                })}

                {/* Translucent Area Gradient */}
                {dispersionCurve.areaPath && (
                  <path d={dispersionCurve.areaPath} className={styles.chartAreaFill} style={{ fill: 'url(#chartIndigoGradient)' }} />
                )}

                {/* Solid Stroke Line */}
                {dispersionCurve.path && (
                  <path d={dispersionCurve.path} className={styles.chartLinePath} style={{ stroke: '#6366f1' }} />
                )}

                {/* Coordinates dots */}
                {dispersionCurve.coords?.map((pt: any, index: number) => (
                  <g key={index}>
                    {pt.value > 0 && (
                      <text x={pt.x} y={pt.y - 10} className={styles.chartValLabel}>
                        {pt.value}
                      </text>
                    )}
                    <circle cx={pt.x} cy={pt.y} r="5" className={styles.chartPointCircle} style={{ stroke: '#6366f1' }} />
                    <text x={pt.x} y="210" textAnchor="middle" className={styles.chartAxisText}>
                      SZ {pt.size}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* TOP ARTICLES LEDGER SIDEBAR */}
          <div className={styles.chartCard}>
            <div className="flex-between mb-6">
               <h3 className={styles.chartTitle}>📊 Top Stock Allocation</h3>
               <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Warehouse Equity</span>
            </div>

            <div className={styles.statsList}>
              {stats?.topArticles?.map((art: any, i: number) => {
                const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
                const totalW = stats?.totals?.warehouse_total || 1;
                const fillPct = (art.total_qty / totalW) * 100;
                return (
                  <div key={i} className={styles.statRowItem}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '4px', background: `${colors[i % colors.length]}15`, color: colors[i % colors.length], fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {i + 1}
                      </span>
                      <strong style={{ fontSize: '14px', color: '#334155' }}>{art.article_code}</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className="num-mono" style={{ fontWeight: 800, fontSize: '13px' }}>
                        {(art.total_qty || 0).toLocaleString()}{' '}
                        <span style={{ color: 'var(--text-ghost)', fontSize: '10px', fontWeight: 400 }}>Pairs</span>
                      </span>
                      <div className={styles.statProgressBarBg}>
                        <div 
                          className={styles.statProgressBarFill} 
                          style={{ width: `${Math.max(fillPct, 2)}%`, background: colors[i % colors.length] }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {(!stats?.topArticles || stats.topArticles.length === 0) && (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '13px' }}>
                  No active stock levels in staging or inventory ledger.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: PACKING & CARTON OPERATIONS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', margin: 0 }}>
          <span>📦</span> Packing & Carton Operations Statistics
        </h2>

        {/* METRICS ROW (PACKING) */}
        <div className={styles.metricsGrid}>
          <div className={`${styles.metricCard} ${styles.cardStaging}`}>
            <span className={styles.metricLabel}>Warehouse Staging Pool</span>
            <span className={`${styles.metricValue} num-mono`}>
              {(stats?.totals?.staging_pool_total || 0).toLocaleString()}
            </span>
            <span className={styles.metricSubText} style={{ color: '#2563eb' }}>Loose Staged Pairs Waiting</span>
          </div>

          <div className={`${styles.metricCard} ${styles.cardCartons}`}>
            <span className={styles.metricLabel}>Cartons Packed Today</span>
            <span className={`${styles.metricValue} num-mono`}>
              {(stats?.totals?.packed_cartons_today || 0).toLocaleString()}
            </span>
            <span className={styles.metricSubText} style={{ color: '#10b981' }}>Outward Carton Deliveries</span>
          </div>

          <div className={`${styles.metricCard} ${styles.cardVstrap}`}>
            <span className={styles.metricLabel}>V-Strap Count</span>
            <span className={`${styles.metricValue} num-mono`}>
              {(stats?.totals?.vstrap_balance || 0).toLocaleString()}
            </span>
            <span className={styles.metricSubText} style={{ color: '#d97706' }}>Raw Material Balance</span>
          </div>
        </div>

        {/* GRAPHS ROW (PACKING) */}
        <div className={styles.chartsGrid}>
          {/* TABBED STAGING AND PACKED SVG GRAPH CARD */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>📦 Packing Operations Matrix</h3>
              
              <div className={styles.chartToggleGroup}>
                <button 
                  className={`${styles.toggleBtn} ${activeChart === 'staging' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setActiveChart('staging')}
                >
                  📈 Staging Pool Load
                </button>
                <button 
                  className={`${styles.toggleBtn} ${activeChart === 'dispatched' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setActiveChart('dispatched')}
                >
                  📊 Carton Size Dispatch
                </button>
              </div>
            </div>

            <div className={styles.svgContainer}>
              {activeChart === 'dispatched' ? (
                // Rounded Column Chart for Carton Dispatch Pairs
                <svg className={styles.svgFrame} viewBox="0 0 600 220" preserveAspectRatio="none">
                  {[0.25, 0.5, 0.75, 1].map((ratio, i) => {
                    const yVal = 220 - 30 - ratio * 170;
                    return (
                      <line key={i} x1="50" y1={yVal} x2="580" y2={yVal} className={styles.chartGridLine} />
                    );
                  })}

                  {dispatchedColumns.columns.map((col: any, index: number) => (
                    <g key={index}>
                      {col.value > 0 && (
                        <text x={col.x + col.width / 2} y={col.y - 6} className={styles.chartValLabel}>
                          {col.value}
                        </text>
                      )}
                      <rect 
                        x={col.x} 
                        y={col.y} 
                        width={col.width} 
                        height={Math.max(col.height, 4)} 
                        rx="4" 
                        ry="4" 
                        className={styles.barCol}
                      />
                      <text x={col.x + col.width / 2} y="210" textAnchor="middle" className={styles.chartAxisText}>
                        SZ {col.size}
                      </text>
                    </g>
                  ))}
                </svg>
              ) : (
                // Bezier Curve Area Chart for loose staging pool quantities
                <svg className={styles.svgFrame} viewBox="0 0 600 220" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartBlueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {[0.25, 0.5, 0.75, 1].map((ratio, i) => {
                    const yVal = 220 - 30 - ratio * 170;
                    return (
                      <line key={i} x1="50" y1={yVal} x2="580" y2={yVal} className={styles.chartGridLine} />
                    );
                  })}

                  {stagingCurve.areaPath && (
                    <path d={stagingCurve.areaPath} className={styles.chartAreaFill} />
                  )}

                  {stagingCurve.path && (
                    <path d={stagingCurve.path} className={styles.chartLinePath} />
                  )}

                  {stagingCurve.coords?.map((pt: any, index: number) => (
                    <g key={index}>
                      {pt.value > 0 && (
                        <text x={pt.x} y={pt.y - 10} className={styles.chartValLabel}>
                          {pt.value}
                        </text>
                      )}
                      <circle cx={pt.x} cy={pt.y} r="5" className={styles.chartPointCircle} />
                      <text x={pt.x} y="210" textAnchor="middle" className={styles.chartAxisText}>
                        SZ {pt.size}
                      </text>
                    </g>
                  ))}
                </svg>
              )}
            </div>
          </div>

          {/* ACTIVE PACKAGING MASTER RULES SIDE BLOCK */}
          <div className={styles.chartCard}>
            <div className="flex-between mb-4">
               <h3 className={styles.chartTitle}>📋 Packaging templates</h3>
               <span style={{ fontSize: '11px', color: 'var(--text-ghost)', fontWeight: 700, textTransform: 'uppercase' }}>Cartons Today</span>
            </div>

            <div className={styles.rulesDistributionList}>
              {activeRules.map((rule: any, i: number) => {
                const fillPct = (rule.carton_count / maxCartonsInRule) * 100;
                const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
                return (
                  <div key={i} className={styles.ruleDistRow}>
                    <div className={styles.ruleDistLabel}>
                      <span style={{ color: '#334155' }}>{rule.rule_name}</span>
                      <span className="num-mono" style={{ color: '#0f172a', fontWeight: 800 }}>
                        {rule.carton_count} <span style={{ color: 'var(--text-ghost)', fontSize: '10px', fontWeight: 600 }}>Ctn</span>
                      </span>
                    </div>
                    <div className={styles.ruleProgressBarBg}>
                      <div 
                        className={styles.ruleProgressBarFill} 
                        style={{ width: `${fillPct}%`, background: colors[i % colors.length] }}
                      />
                    </div>
                  </div>
                );
              })}
              {activeRules.length === 0 && (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '13px' }}>
                  No active packaging dispatches generated today.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: RECENT WAREHOUSE ACTIVITY LEDGER (Unified widescreen feed) */}
      <div className={styles.ledgerCard} style={{ marginTop: '12px' }}>
        <div className={styles.ledgerTitleRow}>
           <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
             <span>🕒</span> Recent Movement Activity Logs
           </h2>
           <Link href="/scan-history" className={styles.ledgerViewAllBtn}>
             Open scan-history audit
           </Link>
        </div>

        <div style={{ overflowX: 'auto', marginTop: '20px' }}>
          <table className="table-corporate">
             <thead>
                <tr>
                   <th>Timestamp (IST)</th>
                   <th>Operator / Carton</th>
                   <th>Category</th>
                   <th className="num-mono" style={{ textAlign: 'right' }}>Transaction</th>
                   <th style={{ textAlign: 'right' }}>Flow State</th>
                </tr>
             </thead>
             <tbody>
                {stats?.recentActivity?.map((act: any, i: number) => {
                  const isCarton = act.type.includes('Carton');
                  const isInward = act.type === 'Inward';
                  return (
                    <tr key={i} className="tr-hover">
                       <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                         {formatISTDateTime(act.sheet_date)}
                       </td>
                       <td style={{ fontWeight: 700 }}>
                         {act.article_code}
                       </td>
                       <td style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
                         {act.colour}
                       </td>
                       <td className="num-mono" style={{ fontWeight: 900, textAlign: 'right', fontSize: '15px', color: isCarton ? '#7c3aed' : (isInward ? '#059669' : '#dc2626') }}>
                         {act.qty > 0 ? '+' : ''}{act.qty}
                       </td>
                       <td style={{ textAlign: 'right' }}>
                          <span className={`${styles.activityTypeBadge} ${isCarton ? styles.badgeCarton : (isInward ? styles.badgeInward : styles.badgeOutward)}`}>
                             {act.type}
                          </span>
                       </td>
                    </tr>
                  );
                })}
                {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-ghost)' }}>
                      No warehouse transaction records registered yet.
                    </td>
                  </tr>
                )}
             </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
