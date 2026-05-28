'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ── Severity colours ──────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#22c55e',
};

// ── Small helper components ───────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent = '#6366f1' }: {
  icon: string; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      padding: '20px 22px',
      border: '1px solid rgba(99,102,241,0.10)',
      boxShadow: '0 2px 12px rgba(99,102,241,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      transition: 'box-shadow 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.13)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(99,102,241,0.06)')}
    >
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af' }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#6366f1',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: 12,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ width: 3, height: 14, background: '#6366f1', borderRadius: 4 }} />
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: 12,
      padding: '18px 20px', color: '#94a3b8', fontSize: 13, textAlign: 'center',
    }}>
      {message}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OperationsCenter() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/insights');
      if (res.status === 403) {
        setError('This page is restricted to administrators.');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const d = await res.json();
      setData(d);
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString('en-IN'));
    } catch (e: any) {
      setError('Unable to load operational data. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(t);
  }, [fetchData]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid #e0e7ff',
        borderTop: '3px solid #6366f1',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ color: '#6b7280', fontSize: 14 }}>Loading operational data...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{
      background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 14,
      padding: '24px 28px', color: '#b91c1c', fontSize: 14, maxWidth: 480,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ Data Unavailable</div>
      <div>{error}</div>
    </div>
  );

  const {
    inventorySummary, lowStockItems, poStats,
    cartonsToday, cartonsTotal, scanActivityToday,
    topOperatorToday, inwardToday, outwardToday,
    vendorScorecards, delayedPOs, efficiencyScore, vstrapSummary,
  } = data || {};

  const poValue = Number(poStats?.total_value || 0).toLocaleString('en-IN');

  return (
    <div style={{ padding: '0 0 40px 0', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        borderRadius: 18,
        padding: '28px 32px',
        marginBottom: 28,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        color: 'white',
        boxShadow: '0 8px 32px rgba(99,102,241,0.25)',
      }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Admin · Operational Intelligence
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Operations Center
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            Live warehouse analytics from your ERP database
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.7 }}>
          <div>Last refreshed</div>
          <div style={{ fontWeight: 600 }}>{lastUpdated}</div>
          <button
            onClick={fetchData}
            style={{
              marginTop: 8, background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white', borderRadius: 8, padding: '5px 14px',
              fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard icon="📦" label="Total Articles" value={inventorySummary?.total_articles || 0} sub="in inventory pool" />
        <StatCard icon="🔢" label="Total Pairs" value={(inventorySummary?.total_pairs || 0).toLocaleString('en-IN')} sub="loose stock" />
        <StatCard icon="📋" label="Total POs" value={poStats?.total || 0} sub={`₹${poValue} value`} />
        <StatCard icon="⏳" label="Pending Approval" value={poStats?.pending_approval || 0} accent="#f59e0b" sub="POs awaiting admin" />
        <StatCard icon="📦" label="Cartons Today" value={cartonsToday || 0} accent="#10b981" sub={`${cartonsTotal || 0} total all time`} />
        <StatCard icon="📥" label="Scans Today" value={scanActivityToday || 0} sub="inward scan count" />
        <StatCard icon="⚡" label="Flow Efficiency" value={`${efficiencyScore || 0}%`} accent={efficiencyScore >= 70 ? '#10b981' : '#f97316'} sub="outward / inward ratio" />
      </div>

      {/* ── Row: Inward/Outward + V-Strap ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 24 }}>

        {/* Today's Movement */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(99,102,241,0.1)', padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <SectionTitle>Today's Warehouse Movement</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '14px 16px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>📥 Inward</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#15803d' }}>{inwardToday?.txns || 0}</div>
              <div style={{ fontSize: 11, color: '#4ade80' }}>transactions · {(inwardToday?.qty || 0)} pairs</div>
            </div>
            <div style={{ background: '#eff6ff', borderRadius: 10, padding: '14px 16px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>🚚 Outward</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1d4ed8' }}>{outwardToday?.txns || 0}</div>
              <div style={{ fontSize: 11, color: '#60a5fa' }}>transactions · {(outwardToday?.qty || 0)} pairs</div>
            </div>
          </div>
          {topOperatorToday?.full_name && (
            <div style={{ marginTop: 12, background: '#faf5ff', borderRadius: 10, padding: '10px 14px', border: '1px solid #e9d5ff', fontSize: 12, color: '#7c3aed' }}>
              🏆 <strong>Top scanner today:</strong> {topOperatorToday.full_name} ({topOperatorToday.scans} scans)
            </div>
          )}
        </div>

        {/* V-Strap + PO Breakdown */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(99,102,241,0.1)', padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <SectionTitle>Purchase Order Breakdown</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Completed', value: poStats?.completed || 0, color: '#10b981' },
              { label: 'Approved (Active)', value: poStats?.approved || 0, color: '#6366f1' },
              { label: 'Pending Admin Approval', value: poStats?.pending_approval || 0, color: '#f59e0b' },
              { label: 'Rejected', value: poStats?.rejected || 0, color: '#ef4444' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: '#374151', flex: 1 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
          {vstrapSummary?.entries > 0 && (
            <div style={{ marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
              <SectionTitle>V-Strap Stock</SectionTitle>
              <div style={{ fontSize: 13, color: '#374151' }}>
                <strong>{vstrapSummary.entries}</strong> entries · <strong>{vstrapSummary.total_qty}</strong> total units
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row: Low Stock Alerts + Vendor Scorecards ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 24 }}>

        {/* Low Stock Alerts */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(99,102,241,0.1)', padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <SectionTitle>Low Stock Alerts (below 50 pairs)</SectionTitle>
          {!lowStockItems?.length
            ? <EmptyState message="✅ All inventory items are above the safety threshold." />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lowStockItems.map((item: any, i: number) => {
                  const severity = item.total_qty < 20 ? 'critical' : item.total_qty < 35 ? 'high' : 'medium';
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: '#fafafa', borderRadius: 10, padding: '10px 14px',
                      border: `1px solid ${SEV_COLOR[severity]}22`,
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.article_code}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{item.colour}</div>
                      </div>
                      <div style={{
                        background: SEV_COLOR[severity] + '18',
                        color: SEV_COLOR[severity],
                        fontWeight: 700, fontSize: 13,
                        borderRadius: 8, padding: '4px 12px',
                        border: `1px solid ${SEV_COLOR[severity]}33`,
                      }}>
                        {item.total_qty} pairs
                      </div>
                    </div>
                  );
                })}
                <Link href="/po/create" style={{
                  marginTop: 6, background: '#6366f1', color: 'white',
                  borderRadius: 10, padding: '10px 16px', fontSize: 12,
                  fontWeight: 700, textDecoration: 'none', textAlign: 'center',
                  display: 'block',
                }}>
                  + Create Replenishment PO
                </Link>
              </div>
            )}
        </div>

        {/* Vendor Scorecards */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(99,102,241,0.1)', padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <SectionTitle>Vendor Performance Scorecard</SectionTitle>
          {!vendorScorecards?.length
            ? <EmptyState message="No vendor data yet. Complete purchase order workflows to generate scorecards." />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {vendorScorecards.slice(0, 5).map((v: any, i: number) => {
                  const gradeColor = v.overallGrade === 'A' ? '#10b981' : v.overallGrade === 'B' ? '#6366f1' : v.overallGrade === 'C' ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: '#fafafa', borderRadius: 10, padding: '10px 14px', gap: 10,
                      border: '1px solid #f1f5f9',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.vendorName}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Lead time: {v.averageLeadTimeHours}h</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: '#374151', marginBottom: 2 }}>{v.reliabilityScore}% reliable</div>
                        <div style={{
                          background: gradeColor + '18', color: gradeColor,
                          fontWeight: 800, fontSize: 13, borderRadius: 8,
                          padding: '2px 10px', border: `1px solid ${gradeColor}33`,
                        }}>
                          Grade {v.overallGrade}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* ── Delayed POs ──────────────────────────────────────────────────── */}
      {delayedPOs?.length > 0 && (
        <div style={{ background: '#fffbeb', borderRadius: 14, border: '1px solid #fde68a', padding: '20px 22px', boxShadow: '0 2px 12px rgba(245,158,11,0.08)', marginBottom: 24 }}>
          <SectionTitle>⚠️ Delayed Purchase Orders (&gt;3 days since approval)</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            {delayedPOs.map((po: any, i: number) => (
              <div key={i} style={{ background: 'white', borderRadius: 10, padding: '12px 16px', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{po.po_number}</div>
                <div style={{ fontSize: 12, color: '#78350f', marginTop: 2 }}>{po.vendor}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#a16207' }}>
                  <span>₹{Number(po.grand_total || 0).toLocaleString('en-IN')}</span>
                  <span>Ordered: {new Date(po.created_at).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Links ───────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(99,102,241,0.1)', padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <SectionTitle>Quick Actions</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: '+ Create Purchase Order', href: '/po/create', color: '#6366f1' },
            { label: 'Review Pending POs', href: '/po/pending', color: '#f59e0b' },
            { label: 'View Inventory Pool', href: '/inventory-pool', color: '#10b981' },
            { label: 'Carton Generation', href: '/carton-generation', color: '#8b5cf6' },
            { label: 'Scan History', href: '/scan-history', color: '#06b6d4' },
            { label: 'AI Intelligence', href: '/po/ai-intelligence', color: '#ec4899' },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                background: link.color + '10',
                border: `1px solid ${link.color}30`,
                color: link.color,
                borderRadius: 10,
                padding: '8px 18px',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = link.color + '20')}
              onMouseLeave={e => (e.currentTarget.style.background = link.color + '10')}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
