'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import POResetExportPanel from '@/components/POResetExportPanel';

interface POItem {
  id: number;
  po_number: string;
  vendor: string;
  status: string;
  grand_total: number;
  amount_paid: number;
  balance_amount: number;
  po_date: string;
  created_at: string;
  updated_at: string;
}

export default function PODashboard() {
  const [user, setUser] = useState<any>(null);
  const [pos, setPos] = useState<POItem[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPointSpend, setHoveredPointSpend] = useState<number | null>(null);
  const [hoveredPointPayment, setHoveredPointPayment] = useState<number | null>(null);
  const [hoveredMaterialIdx, setHoveredMaterialIdx] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch authenticated user
      const userRes = await fetch('/api/auth/me');
      const userData = await userRes.json();
      if (!userRes.ok || !userData.user) {
        setError('Failed to authenticate');
        return;
      }
      setUser(userData.user);

      // Fetch all POs
      const poRes = await fetch('/api/po');
      const poData = await poRes.json();
      setPos(poData.pos || []);

      // Fetch strictly PO-only dashboard data
      const dashRes = await fetch('/api/dashboard');
      const dashData = await dashRes.json();
      setDashboardData(dashData);

      // Fetch notifications
      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData.notifications || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load PO details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {}
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px' }}>
        <div className="loading-dot" />
        <span style={{ color: 'var(--text-ghost)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Initializing Procurement Pipeline...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-clean" style={{ borderLeft: '4px solid var(--danger)', padding: '24px', margin: '20px auto', maxWidth: '600px', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
        <h3 style={{ color: 'var(--danger)', fontWeight: 800 }}>System Authorization Error</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>{error}</p>
        <button className="btn-corp" style={{ marginTop: '16px' }} onClick={loadData}>Retry Connection</button>
      </div>
    );
  }

  // PO-specific pipeline grouping
  const drafts = pos.filter(p => p.status === 'draft');
  const pending = pos.filter(p => p.status === 'pending_admin_approval');
  const returned = pos.filter(p => p.status === 'returned_for_edit');
  const rejected = pos.filter(p => p.status === 'rejected');
  const processing = pos.filter(p => p.status === 'accountant_processing');
  const completed = pos.filter(p => p.status === 'completed');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return { label: 'Draft Pipeline', bg: 'rgba(100, 116, 139, 0.12)', color: '#94a3b8' };
      case 'pending_admin_approval':
        return { label: 'Awaiting Sign-off', bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' };
      case 'returned_for_edit':
        return { label: 'Revision Required', bg: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' };
      case 'rejected':
        return { label: 'Audited & Rejected', bg: 'rgba(239, 68, 68, 0.12)', color: '#f87171' };
      case 'accountant_processing':
        return { label: 'Treasury Clearing', bg: 'rgba(16, 185, 129, 0.12)', color: '#34d399' };
      case 'completed':
        return { label: 'Closed Ledger', bg: 'rgba(167, 139, 250, 0.12)', color: '#c084fc' };
      default:
        return { label: status, bg: 'rgba(255, 255, 255, 0.08)', color: '#f1f5f9' };
    }
  };

  // Safe destructuring of strict PO backend metrics
  const poFinance = dashboardData?.poFinance || {
    total_procurement_capital: 0,
    total_paid: 0,
    total_outstanding: 0,
    total_po_count: 0,
    draft_count: 0,
    pending_approval_count: 0,
    returned_count: 0,
    rejected_count: 0,
    active_po_count: 0,
    completed_po_count: 0,
    pending_approval_capital: 0,
    returned_capital: 0,
    rejected_capital: 0
  };

  const materialsCount = dashboardData?.materialsCount || 0;
  const vendorsCount = dashboardData?.vendorsCount || 0;
  const highlyPurchasePO = dashboardData?.highlyPurchasePO || null;
  const targetMonth = dashboardData?.targetMonth || '';
  const dateToDateSpend = dashboardData?.dateToDateSpend || [];
  const topOrderedMaterials = dashboardData?.topOrderedMaterials || [];
  const vendorsSatisfaction = dashboardData?.vendorsSatisfaction || [];
  const dailyCashflows = dashboardData?.dailyCashflows || [];
  const stageCounts = dashboardData?.stageCounts || { drafts: 0, pending: 0, returned: 0, rejected: 0, processing: 0, completed: 0 };

  // --- Graph A: Cumulative Date-to-Date Monthly Spend Curve ---
  const maxSpendVal = Math.max(...dateToDateSpend.map((d: any) => d.cumulative), 10000);
  const spendPoints = dateToDateSpend.map((d: any, idx: number) => {
    const x = 50 + idx * (400 / Math.max(dateToDateSpend.length - 1, 1));
    const y = 180 - (d.cumulative / maxSpendVal) * 130;
    return { x, y, date: d.date, value: d.day_total, cumulative: d.cumulative };
  });
  const spendLinePath = spendPoints.map((p: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const spendAreaPath = spendPoints.length > 0 
    ? `${spendLinePath} L ${spendPoints[spendPoints.length - 1].x} 180 L ${spendPoints[0].x} 180 Z` 
    : '';

  // --- Graph B: Top Ordered Materials (Power BI Bar Chart comparing Qty vs Spend Value) ---
  const maxMaterialSpend = Math.max(...topOrderedMaterials.map((m: any) => m.total_spend), 1);
  const maxMaterialQty = Math.max(...topOrderedMaterials.map((m: any) => m.total_qty), 1);

  // --- Graph C: Vendor Concentric Rings (Settlement Index % vs. Order Fulfillment) ---
  const maxVendorSpend = Math.max(...vendorsSatisfaction.map((v: any) => v.total_spend), 1);

  // --- Graph D: Treasury Daily Cashflows (Last 7 active days, 3 connections) ---
  const maxCashflowVal = Math.max(...dailyCashflows.map((d: any) => Math.max(d.spend, d.pending, d.unpaid)), 1000);
  const xTimelineStep = dailyCashflows.length > 1 ? 400 / (dailyCashflows.length - 1) : 400;

  const pointsTimelineSpend = dailyCashflows.map((d: any, idx: number) => ({
    x: 50 + idx * xTimelineStep,
    y: 200 - (d.spend / maxCashflowVal) * 150
  }));
  const pointsTimelinePending = dailyCashflows.map((d: any, idx: number) => ({
    x: 50 + idx * xTimelineStep,
    y: 200 - (d.pending / maxCashflowVal) * 150
  }));
  const pointsTimelineUnpaid = dailyCashflows.map((d: any, idx: number) => ({
    x: 50 + idx * xTimelineStep,
    y: 200 - (d.unpaid / maxCashflowVal) * 150
  }));

  const pathTimelineSpend = pointsTimelineSpend.map((p: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const pathTimelinePending = pointsTimelinePending.map((p: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const pathTimelineUnpaid = pointsTimelineUnpaid.map((p: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const formatPaymentLabel = (lbl: string) => {
    if (!lbl) return '';
    const parts = lbl.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(parts[1]) - 1;
      return `${parts[2]} ${months[mIdx] || parts[1]}`;
    }
    return lbl;
  };

  return (
    <div className={styles.vortexPo}>
      
      {/* 1. Cinematic Hero Procurement Header */}
      <div className={styles.heroBanner}>
        <div style={{ zIndex: 2, flex: 1 }}>
          <span style={{ fontSize: '11px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', padding: '6px 14px', borderRadius: '30px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#818cf8' }}>
            Enterprise Procurement Suite
          </span>
          <h1 className={styles.headerTitle}>Purchase Order Executive Intelligence</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px', maxWidth: '600px', lineHeight: '1.6' }}>
            Highly-focused Power BI analytics and structured financial flows tracking for raw materials procurement, vendor liquidity, and treasury ledger audits.
          </p>
        </div>
        
        {/* Top Header stats summary */}
        <div style={{ display: 'flex', gap: '16px', zIndex: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ padding: '16px 24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>PRO LEDGER STATUS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>ONLINE & SYNCED</span>
            </div>
          </div>
          <POResetExportPanel
            userRole={user?.role || ''}
            exportFilename={`PO_Dashboard_${new Date().toISOString().slice(0,10)}`}
            exportHeaders={['PO Number', 'Vendor', 'Status', 'Grand Total (Rs)', 'Amount Paid (Rs)', 'Balance (Rs)', 'PO Date']}
            exportRows={pos.map((po: any) => [
              po.po_number,
              po.vendor || '',
              po.status?.replace(/_/g, ' ') || '',
              po.grand_total ?? 0,
              po.amount_paid ?? 0,
              po.balance_amount ?? 0,
              po.po_date || ''
            ])}
            onResetComplete={loadData}
          />
          {(user?.role === 'pm' || user?.role === 'admin') && (
            <Link href="/po/create" className="btn-corp btn-primary-corp" style={{ textDecoration: 'none', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(37, 99, 235, 0.3)', border: 'none', borderRadius: '16px', padding: '16px 28px', transition: 'all 0.3s' }}>
              + Create Executive PO
            </Link>
          )}
        </div>
        <div style={{ position: 'absolute', right: '-30px', bottom: '-40px', fontSize: '200px', opacity: 0.02, pointerEvents: 'none', userSelect: 'none' }}>💸</div>
      </div>

      {/* 2. Glassmorphic Analytics Metric Cards (strictly Purchase Order Details Only) */}
      <div className={styles.analyticsGrid}>
        {[
          { 
            label: 'Total Procurement Capital', 
            value: `₹${poFinance.total_procurement_capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 
            trend: `${poFinance.total_po_count} Registered POs`, 
            desc: 'Overall registered procurement spend', 
            color: '#3b82f6',
            progress: 100,
            progressLabel: 'Active material commitments'
          },
          { 
            label: 'Treasury Cleared Spend', 
            value: `₹${poFinance.total_paid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 
            trend: `${poFinance.total_procurement_capital > 0 ? Math.round((poFinance.total_paid / poFinance.total_procurement_capital) * 100) : 0}% Paid`, 
            desc: 'Completed payouts made to vendors', 
            color: '#10b981',
            progress: poFinance.total_procurement_capital > 0 ? Math.round((poFinance.total_paid / poFinance.total_procurement_capital) * 100) : 0,
            progressLabel: 'Settled bank payouts out of account'
          },
          { 
            label: 'Outstanding PO Liabilities', 
            value: `₹${poFinance.total_outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 
            trend: `${poFinance.active_po_count} Awaiting Clearing`, 
            desc: 'Outstanding balance pending payment', 
            color: '#fbbf24',
            progress: poFinance.total_procurement_capital > 0 ? Math.round((poFinance.total_outstanding / poFinance.total_procurement_capital) * 100) : 0,
            progressLabel: 'Unpaid / pending bank settlements'
          },
          { 
            label: 'Total Materials Registered', 
            value: `${materialsCount} Item Codes`, 
            trend: 'Materials Hub', 
            desc: 'Total materials saved in database', 
            color: '#8b5cf6',
            progress: Math.min(100, Math.round((materialsCount / 30) * 100)),
            progressLabel: 'Materials specification registry'
          },
          { 
            label: 'Total Saved Vendors', 
            value: `${vendorsCount} Partners`, 
            trend: 'Vendor Directory', 
            desc: 'Total suppliers in materials database', 
            color: '#06b6d4',
            progress: Math.min(100, Math.round((vendorsCount / 20) * 100)),
            progressLabel: 'Vendor compliance records'
          },
          { 
            label: 'Awaiting Admin Auth', 
            value: `₹${poFinance.pending_approval_capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 
            trend: `${poFinance.pending_approval_count} POs Pending`, 
            desc: 'POs waiting for executive sign-off', 
            color: '#ec4899',
            progress: Math.min(100, poFinance.pending_approval_count * 20),
            progressLabel: 'Sign-off approval authorization bottleneck'
          },
          { 
            label: 'Revision Required Pipeline', 
            value: `₹${poFinance.returned_capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 
            trend: `${poFinance.returned_count} POs Returned`, 
            desc: 'Returned by admin for editor revision', 
            color: '#60a5fa',
            progress: Math.min(100, poFinance.returned_count * 20),
            progressLabel: 'Correction or price negotiations required'
          },
          { 
            label: 'Audited & Rejected POs', 
            value: `₹${poFinance.rejected_capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 
            trend: `${poFinance.rejected_count} POs Rejected`, 
            desc: 'Purchase requests audited & rejected', 
            color: '#ef4444',
            progress: Math.min(100, poFinance.rejected_count * 20),
            progressLabel: 'Declined transactions audit trail'
          }
        ].map((card, idx) => (
          <div key={idx} className={styles.glassCard}>
            <div className={styles.cardGlow} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
              <span style={{ fontSize: '11px', color: card.color, fontWeight: 900, background: `${card.color}15`, padding: '4px 8px', borderRadius: '8px' }}>{card.trend}</span>
            </div>
            <div>
              <div className={styles.metricValue}>{card.value}</div>
              <p style={{ fontSize: '12px', color: '#334155', marginTop: '6px', fontWeight: 500 }}>{card.desc}</p>
            </div>
            
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800, color: card.color }}>
                <span>{card.progressLabel}</span>
                <span>{card.progress}%</span>
              </div>
              <div style={{ height: '6px', borderRadius: '4px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${card.progress}%`, 
                    backgroundColor: card.color,
                    borderRadius: '4px',
                    boxShadow: `0 0 8px ${card.color}`
                  }} 
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Luxury Graphs & Distribution Visualizers (Strict PO Focus) */}
      <div className={styles.chartsSection}>
        
        {/* Graph A: Date-to-Date Cumulative Spend Curve */}
        <div className={styles.chartCard}>
          <div>
            <h3 className={styles.chartTitle}>Date-to-Date Monthly Spend Curve</h3>
            <p style={{ fontSize: '12px', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
              Cumulative date-to-date PO capital commitments during the active cycle **{formatPaymentLabel(targetMonth) || targetMonth}**.
            </p>
          </div>
          
          <div style={{ width: '100%', height: '230px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {spendPoints.length === 0 ? (
              <div style={{ color: 'var(--text-ghost)', fontSize: '13px', fontWeight: 600 }}>No active billing registered this cycle</div>
            ) : (
              <svg width="100%" height="220" viewBox="0 0 480 220" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                
                {/* Grid Lines */}
                <line x1="50" y1="50" x2="450" y2="50" stroke="#f1f5f9" strokeWidth="1.5" />
                <line x1="50" y1="100" x2="450" y2="100" stroke="#f1f5f9" strokeWidth="1.5" />
                <line x1="50" y1="150" x2="450" y2="150" stroke="#f1f5f9" strokeWidth="1.5" />
                <line x1="50" y1="180" x2="450" y2="180" stroke="#cbd5e1" strokeWidth="2" />
                
                {/* Gradient Area */}
                {spendAreaPath && <path d={spendAreaPath} fill="url(#areaGlow)" />}
                
                {/* Dotted guidline */}
                {hoveredPointSpend !== null && spendPoints[hoveredPointSpend] && (
                  <line 
                    x1={spendPoints[hoveredPointSpend].x} 
                    y1={spendPoints[hoveredPointSpend].y} 
                    x2={spendPoints[hoveredPointSpend].x} 
                    y2="180" 
                    stroke="#3b82f6" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,4" 
                  />
                )}

                {/* Trend line */}
                {spendLinePath && (
                  <path 
                    className={styles.chartLine}
                    d={spendLinePath} 
                    fill="none" 
                    stroke="url(#lineGlow)" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                  />
                )}
                
                {/* Node Anchors */}
                {spendPoints.map((p: any, i: number) => (
                  <g 
                    key={i} 
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPointSpend(i)}
                    onMouseLeave={() => setHoveredPointSpend(null)}
                  >
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r={hoveredPointSpend === i ? "9" : "6"} 
                      fill="#ffffff" 
                      stroke={hoveredPointSpend === i ? "#6366f1" : "#3b82f6"} 
                      strokeWidth="3" 
                      style={{ transition: 'all 0.2s' }}
                    />
                    {hoveredPointSpend === i && (
                      <g>
                        <rect x={p.x - 70} y={p.y - 65} width="140" height="48" rx="8" fill="#0f172a" opacity="0.95" />
                        <text x={p.x} y={p.y - 50} fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle">
                          📅 {formatPaymentLabel(p.date)}
                        </text>
                        <text x={p.x} y={p.y - 36} fill="#34d399" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="monospace">
                          ₹{p.cumulative.toLocaleString('en-IN')}
                        </text>
                        <text x={p.x} y={p.y - 24} fill="#94a3b8" fontSize="8" fontWeight="600" textAnchor="middle">
                          Cumulative Total Spend
                        </text>
                      </g>
                    )}
                    {/* X Axis Label (staggered for readability) */}
                    {(i % Math.max(1, Math.round(spendPoints.length / 5)) === 0 || i === spendPoints.length - 1) && (
                      <text x={p.x} y="196" fill="#475569" fontSize="9" fontWeight="800" textAnchor="middle">
                        {formatPaymentLabel(p.date).substring(0, 6)}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            )}
          </div>
          
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
            📈 <strong>Date-to-Date Spend Curve:</strong> Plots the cumulative growth in capital spend day-by-day. Highlights prompt liquidity expansions in active months.
          </div>
        </div>

        {/* Graph B: Top Ordered Materials by Quantity & Spend (Power BI Clustered Bar) */}
        <div className={styles.chartCard}>
          <div>
            <h3 className={styles.chartTitle}>Material Hub Order Allocation</h3>
            <p style={{ fontSize: '12px', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
              Top materials ordered from the registered database, comparing quantity vs total capital allocation.
            </p>
          </div>
          
          <div style={{ width: '100%', height: '230px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {topOrderedMaterials.length === 0 ? (
              <div style={{ color: 'var(--text-ghost)', fontSize: '13px', fontWeight: 600 }}>No material order transactions logged yet</div>
            ) : (
              <svg width="100%" height="220" viewBox="0 0 480 220" style={{ overflow: 'visible' }}>
                <line x1="50" y1="50" x2="450" y2="50" stroke="#f1f5f9" strokeWidth="1.5" />
                <line x1="50" y1="100" x2="450" y2="100" stroke="#f1f5f9" strokeWidth="1.5" />
                <line x1="50" y1="150" x2="450" y2="150" stroke="#f1f5f9" strokeWidth="1.5" />
                <line x1="50" y1="180" x2="450" y2="180" stroke="#cbd5e1" strokeWidth="2" />

                {topOrderedMaterials.map((m: any, i: number) => {
                  const xBase = 65 + i * 78;
                  const barWidth = 18;
                  
                  const hSpend = (m.total_spend / maxMaterialSpend) * 110;
                  const hQty = (m.total_qty / maxMaterialQty) * 110;

                  const ySpend = 180 - hSpend;
                  const yQty = 180 - hQty;

                  return (
                    <g 
                      key={m.material_code}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredMaterialIdx(i)}
                      onMouseLeave={() => setHoveredMaterialIdx(null)}
                    >
                      {/* Spend Bar (Green gradient) */}
                      <rect 
                        x={xBase} 
                        y={ySpend} 
                        width={barWidth} 
                        height={hSpend} 
                        fill="url(#spendBarGrad)"
                        rx="3"
                      />
                      {m.total_spend > 0 && hoveredMaterialIdx === i && (
                        <text x={xBase + 9} y={ySpend - 6} fill="#10b981" fontSize="8" fontWeight="950" textAnchor="middle">
                          ₹{Math.round(m.total_spend / 1000)}k
                        </text>
                      )}

                      {/* Quantity Bar (Purple gradient) */}
                      <rect 
                        x={xBase + barWidth + 4} 
                        y={yQty} 
                        width={barWidth} 
                        height={hQty} 
                        fill="url(#qtyBarGrad)"
                        rx="3"
                      />
                      {m.total_qty > 0 && hoveredMaterialIdx === i && (
                        <text x={xBase + barWidth + 13} y={yQty - 6} fill="#a855f7" fontSize="8" fontWeight="950" textAnchor="middle">
                          {m.total_qty}
                        </text>
                      )}

                      {/* Material Code Label */}
                      <text x={xBase + barWidth + 2} y="196" fill="#475569" fontSize="9" fontWeight="900" textAnchor="middle">
                        {m.material_code}
                      </text>
                      <text x={xBase + barWidth + 2} y="208" fill="#64748b" fontSize="8" fontWeight="600" textAnchor="middle">
                        {m.material_name.substring(0, 10)}
                      </text>
                    </g>
                  );
                })}

                <defs>
                  <linearGradient id="spendBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="qtyBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
              </svg>
            )}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '11px', fontWeight: 800, marginTop: '8px' }}>
            <span style={{ color: '#10b981' }}>● Order Capital (INR)</span>
            <span style={{ color: '#a855f7' }}>● Ordered Quantity (Pairs/Units)</span>
          </div>
        </div>

        {/* Graph C: Vendor Concentric Rings (Settlement Index % and Satisfaction rating) */}
        <div className={styles.chartCard} style={{ gridColumn: 'span 2' }}>
          <div>
            <h3 className={styles.chartTitle}>Vendor Settlement Index & Payout Satisfaction</h3>
            <p style={{ fontSize: '12px', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
              Radial settlement ratio mapping prompt cleared payments and completed order fulfillment ratios for key partners.
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', minHeight: '230px', flexWrap: 'wrap', gap: '24px' }}>
            <div style={{ position: 'relative', width: '165px', height: '165px' }}>
              <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" fill="transparent" stroke="#f1f5f9" strokeWidth="5.5" />
                {vendorsSatisfaction.slice(0, 4).map((v: any, idx: number) => {
                  const radius = 42 - idx * 7.5;
                  const circumference = 2 * Math.PI * radius;
                  const ratio = v.satisfaction_score / 100;
                  const strokeOffset = circumference * (1 - ratio);
                  
                  const colors = ['#3b82f6', '#10b981', '#fb923c', '#ec4899'];
                  const color = colors[idx % colors.length];

                  return (
                    <g key={v.vendor}>
                      <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="5.5" />
                      <circle 
                        cx="50" cy="50" r={radius} 
                        fill="transparent" 
                        stroke={color} 
                        strokeWidth="5.5" 
                        strokeDasharray={`${circumference}`}
                        strokeDashoffset={`${strokeOffset}`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s' }}
                      />
                    </g>
                  );
                })}
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>{vendorsSatisfaction.length}</span>
                <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>KEY VENDORS</span>
              </div>
            </div>

            {/* Concentric Legend Mapping */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px', flex: 1 }}>
              {vendorsSatisfaction.slice(0, 4).map((v: any, idx: number) => {
                const colors = ['#3b82f6', '#10b981', '#fb923c', '#ec4899'];
                const color = colors[idx % colors.length];
                return (
                  <div key={v.vendor} style={{ padding: '8px 12px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                        <span style={{ color: '#0f172a' }}>{v.vendor}</span>
                      </div>
                      <span style={{ color: color }}>Satisfaction: {v.satisfaction_score}%</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#475569', fontFamily: 'monospace' }}>
                      <span>Spend: ₹{v.total_spend.toLocaleString('en-IN')}</span>
                      <span>Settled: {v.settlement_index}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
            🍩 <strong>Fulfillment composite score:</strong> Tracks liquidity settlement (60% weight) and order completion rate (40% weight) for each supplier.
          </div>
        </div>

        {/* 4. Timeline Workflow Stage Navigator Matrix */}
        <div className={styles.chartCard} style={{ gridColumn: 'span 1' }}>
          <div>
            <h3 className={styles.chartTitle}>PO Stage Navigator</h3>
            <p style={{ fontSize: '12px', color: '#475569', marginTop: '4px', fontWeight: 500 }}>Direct portal jumps to active PO states.</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', height: '100%', alignContent: 'center' }}>
            {[
              { label: 'Draft Pipeline', count: stageCounts.drafts, status: 'draft', icon: '📝', bg: '#94a3b8' },
              { label: 'Awaiting Auth', count: stageCounts.pending, status: 'pending_admin_approval', icon: '🔑', bg: '#fbbf24' },
              { label: 'Revision Queue', count: stageCounts.returned, status: 'returned_for_edit', icon: '🔄', bg: '#60a5fa' },
              { label: 'Audited Rejected', count: stageCounts.rejected, status: 'rejected', icon: '❌', bg: '#f87171' },
              { label: 'Treasury Desk', count: stageCounts.processing, status: 'accountant_processing', icon: '💸', bg: '#34d399' },
              { label: 'Closed Ledger', count: stageCounts.completed, status: 'completed', icon: '📁', bg: '#c084fc' }
            ].map((stage, idx) => (
              <div 
                key={idx} 
                style={{ 
                  padding: '16px', 
                  borderRadius: '16px', 
                  border: '1.5px solid #e2e8f0', 
                  background: '#f8fafc', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between', 
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = stage.bg;
                  e.currentTarget.style.background = 'rgba(255,255,255,0.85)';
                  e.currentTarget.style.boxShadow = `0 4px 12px ${stage.bg}15`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onClick={() => {
                  const pathMap: Record<string, string> = {
                    'draft': '/po/create',
                    'pending_admin_approval': '/po/pending',
                    'returned_for_edit': '/po/create',
                    'rejected': '/po/rejected',
                    'accountant_processing': '/po/accountant',
                    'completed': '/po/completed'
                  };
                  window.location.href = pathMap[stage.status];
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px' }}>{stage.icon}</span>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>{stage.count}</span>
                </div>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#475569', marginTop: '12px' }}>{stage.label}</h4>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 5. TREASURY CASHFLOW & PAYMENTS OPERATIONS TIMELINE (Graph D - 3 connections) */}
      <div className={styles.chartCard} style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginTop: '12px' }}>
        
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🏦</span>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Treasury Cashflow & Payments Operations</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px', fontWeight: 500 }}>
              Live institutional cash settlement tracking across active payment dates.
            </p>
          </div>
          
          {/* Chart Legend */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', background: '#f8fafc', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            {[
              { label: 'Completed Payouts (INR)', color: '#10b981' },
              { label: 'Pending Settlement (INR)', color: '#fbbf24' },
              { label: 'Unpaid / Draft Capital (INR)', color: '#ef4444' }
            ].map((lg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#334155' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: lg.color }} />
                <span>{lg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Clustered Line Graph */}
        <div style={{ padding: '24px', border: '1.5px solid #e2e8f0', borderRadius: '24px', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Treasury Ledger Settlement Trends</h4>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Multi-line curves charting settled, pending partial, and zero-paid capital streams.</p>
            </div>
          </div>

          <div style={{ width: '100%', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {dailyCashflows.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                📭 No transaction logs found in the active cycle.
              </div>
            ) : (
              <svg width="100%" height="240" viewBox="0 0 480 240" style={{ overflow: 'visible' }}>
                <line x1="50" y1="50" x2="450" y2="50" stroke="#f1f5f9" strokeWidth="1.5" />
                <line x1="50" y1="100" x2="450" y2="100" stroke="#f1f5f9" strokeWidth="1.5" />
                <line x1="50" y1="150" x2="450" y2="150" stroke="#f1f5f9" strokeWidth="1.5" />
                <line x1="50" y1="200" x2="450" y2="200" stroke="#cbd5e1" strokeWidth="2" />

                {hoveredPointPayment !== null && dailyCashflows[hoveredPointPayment] && (
                  <line 
                    x1={50 + hoveredPointPayment * xTimelineStep} 
                    y1="50" 
                    x2={50 + hoveredPointPayment * xTimelineStep} 
                    y2="200" 
                    stroke="#2563eb" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,4" 
                  />
                )}

                {/* 1. Completed Payments Line (Green) */}
                {pathTimelineSpend && (
                  <path 
                    d={pathTimelineSpend} 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                    className={styles.chartLine}
                  />
                )}

                {/* 2. Pending Payments Line (Yellow) */}
                {pathTimelinePending && (
                  <path 
                    d={pathTimelinePending} 
                    fill="none" 
                    stroke="#fbbf24" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                    className={styles.chartLine}
                  />
                )}

                {/* 3. Unpaid/Draft Line (Red) */}
                {pathTimelineUnpaid && (
                  <path 
                    d={pathTimelineUnpaid} 
                    fill="none" 
                    stroke="#ef4444" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                    className={styles.chartLine}
                  />
                )}

                {/* Interactive Anchors */}
                {dailyCashflows.map((d: any, i: number) => {
                  const x = 50 + i * xTimelineStep;
                  return (
                    <g 
                      key={i} 
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPointPayment(i)}
                      onMouseLeave={() => setHoveredPointPayment(null)}
                    >
                      {/* Completed dot */}
                      {pointsTimelineSpend[i] && <circle cx={x} cy={pointsTimelineSpend[i].y} r={hoveredPointPayment === i ? "6" : "4"} fill="#ffffff" stroke="#10b981" strokeWidth="2.5" />}
                      
                      {/* Pending dot */}
                      {pointsTimelinePending[i] && <circle cx={x} cy={pointsTimelinePending[i].y} r={hoveredPointPayment === i ? "6" : "4"} fill="#ffffff" stroke="#fbbf24" strokeWidth="2.5" />}
                      
                      {/* Unpaid dot */}
                      {pointsTimelineUnpaid[i] && <circle cx={x} cy={pointsTimelineUnpaid[i].y} r={hoveredPointPayment === i ? "6" : "4"} fill="#ffffff" stroke="#ef4444" strokeWidth="2.5" />}

                      {/* X Axis label */}
                      <text 
                        x={x} 
                        y="218" 
                        fill="#475569" 
                        fontSize="10" 
                        fontWeight="800" 
                        textAnchor="middle"
                      >
                        {formatPaymentLabel(d.date)}
                      </text>

                      {/* Tooltip detail */}
                      {hoveredPointPayment === i && pointsTimelineSpend[i] && pointsTimelinePending[i] && pointsTimelineUnpaid[i] && (
                        <g>
                          <rect 
                            x={x - 90} 
                            y={Math.min(pointsTimelineSpend[i].y, pointsTimelinePending[i].y, pointsTimelineUnpaid[i].y) - 85} 
                            width="180" 
                            height="75" 
                            rx="10" 
                            fill="#0f172a" 
                            opacity="0.95" 
                            filter="drop-shadow(0px 8px 16px rgba(0,0,0,0.15))"
                          />
                          <text x={x - 80} y={Math.min(pointsTimelineSpend[i].y, pointsTimelinePending[i].y, pointsTimelineUnpaid[i].y) - 68} fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="start">
                            📅 {formatPaymentLabel(d.date)} Payouts
                          </text>
                          <text x={x - 80} y={Math.min(pointsTimelineSpend[i].y, pointsTimelinePending[i].y, pointsTimelineUnpaid[i].y) - 52} fill="#34d399" fontSize="10" fontWeight="700" textAnchor="start" fontFamily="monospace">
                            ● Completed: ₹{d.spend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </text>
                          <text x={x - 80} y={Math.min(pointsTimelineSpend[i].y, pointsTimelinePending[i].y, pointsTimelineUnpaid[i].y) - 38} fill="#fbbf24" fontSize="10" fontWeight="700" textAnchor="start" fontFamily="monospace">
                            ● Pending: ₹{d.pending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </text>
                          <text x={x - 80} y={Math.min(pointsTimelineSpend[i].y, pointsTimelinePending[i].y, pointsTimelineUnpaid[i].y) - 24} fill="#f87171" fontSize="10" fontWeight="700" textAnchor="start" fontFamily="monospace">
                            ● Unpaid: ₹{d.unpaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* English Operational explanation */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 20px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
          💡 <strong>Multi-Connection Correlation Analysis:</strong> 
          <ul>
            <li style={{ marginBottom: '6px' }}><strong>Completed Payouts (Green Line):</strong> Total cash successfully cleared to suppliers out of bank accounts.</li>
            <li style={{ marginBottom: '6px' }}><strong>Pending Settlement (Yellow Line):</strong> Outstanding partial invoice balance for approved materials.</li>
            <li><strong>Unpaid Capital (Red Line):</strong> Total funds tied up in draft POs awaiting admin sign-off.</li>
          </ul>
        </div>

      </div>

      {/* 6. HIGHLY PURCHASE PO DETAILS (MASSIVE MNC DESK CARD) */}
      {highlyPurchasePO && (
        <div style={{ marginTop: '24px', padding: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
          <div style={{ position: 'absolute', right: '10px', top: '-10px', fontSize: '120px', opacity: 0.03, color: 'white', pointerEvents: 'none', userSelect: 'none' }}>👑</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Highest Capital Value Purchase Order</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>{highlyPurchasePO.po_number}</h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                  Issued to Supplier <strong style={{ color: '#f8fafc' }}>{highlyPurchasePO.vendor}</strong> on {highlyPurchasePO.po_date}
                </p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
                    ₹{highlyPurchasePO.grand_total.toLocaleString('en-IN')}
                  </div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>MNC Maximum Payout Value</span>
                </div>
                
                <span 
                  style={{ 
                    padding: '8px 16px', 
                    borderRadius: '12px', 
                    fontSize: '11px', 
                    fontWeight: 900, 
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: getStatusBadge(highlyPurchasePO.status).bg,
                    color: getStatusBadge(highlyPurchasePO.status).color
                  }}
                >
                  {getStatusBadge(highlyPurchasePO.status).label}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* 8. Command Center Quick Actions */}

      <div style={{ marginTop: '24px' }}>
        <h3 className={styles.chartTitle} style={{ marginBottom: '16px' }}>Procurement Command Console</h3>
        <div className={styles.commandGrid}>
          {[
            { label: 'Create Purchase Order', desc: 'Initialize draft material PO', icon: '📝', link: '/po/create' },
            { label: 'Sign-off Queue', desc: 'Executive verification stream', icon: '🔑', link: '/po/pending' },
            { label: 'Treasury Desk', desc: 'Auditor review & clearing portal', icon: '💸', link: '/po/accountant' },
            { label: 'Procurement Ledgers', desc: 'Historical audit log archive', icon: '📁', link: '/po/history' }
          ].map((act, i) => (
            <Link key={i} href={act.link} className={styles.commandButton}>
              <div className={styles.commandIcon}>{act.icon}</div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{act.label}</h4>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{act.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* PM Notifications Popup */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 9999,
        maxWidth: '350px'
      }}>
        {notifications.filter(n => !n.is_read && n.type === 'completed').map(n => (
          <div key={n.id} style={{
            background: 'white',
            border: '1px solid #10b981',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.3)',
            animation: 'slide-up 0.3s ease-out forwards',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>✅</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#065f46' }}>PO Fully Verified</span>
              </div>
              <button 
                onClick={() => markAsRead(n.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }}
              >×</button>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.4' }}>
              {n.message}
            </p>
            <Link 
              href="/po/history" 
              onClick={() => markAsRead(n.id)}
              style={{
                marginTop: '8px',
                background: '#ecfdf5',
                color: '#10b981',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                textAlign: 'center',
                textDecoration: 'none',
                border: '1px solid #a7f3d0',
                transition: 'all 0.2s'
              }}
            >
              View in PO History
            </Link>
          </div>
        ))}
      </div>

    </div>
  );
}
