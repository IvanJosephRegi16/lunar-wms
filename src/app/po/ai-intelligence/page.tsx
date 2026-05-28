'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function AIIntelligencePage() {
  const router = useRouter();

  // Primary API states
  const [insights, setInsights] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Interactive Filter States
  const [selectedArticle, setSelectedArticle] = useState('ALL');
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<any[]>([
    { sender: 'ai', text: "👋 Hi! I'm your Operational Intelligence Analyst. Ask me anything about live stock levels, recent dispatches, delayed orders, or vendor performances." }
  ]);
  const [askingCopilot, setAskingCopilot] = useState(false);

  // Load datasets on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        // 1. Load general insights
        const resIns = await fetch('/api/ai/insights');
        const dataIns = await resIns.json();
        if (dataIns.success) setInsights(dataIns);

        // 2. Load rolling anomalies
        const resAnom = await fetch('/api/ai/anomalies');
        const dataAnom = await resAnom.json();
        if (dataAnom.success) setAnomalies(dataAnom.anomalies);

        // 3. Load temporal forecasts
        const resFore = await fetch(`/api/ai/forecast?article_code=${selectedArticle === 'ALL' ? '' : selectedArticle}`);
        const dataFore = await resFore.json();
        if (dataFore.success) setForecast(dataFore);

      } catch (err) {
        console.error('Failed to load AI Operational intelligence data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedArticle]);

  // Send query to real ERP Copilot API
  const handleCopilotQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = copilotQuery.trim();
    if (!q) return;
    setCopilotQuery('');
    setCopilotMessages(prev => [...prev, { sender: 'user', text: q }]);
    setAskingCopilot(true);
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        setCopilotMessages(prev => [...prev, { sender: 'ai', text: data.reply }]);
      } else {
        setCopilotMessages(prev => [...prev, { sender: 'ai', text: `⚠️ ${data.error || 'Could not retrieve ERP data at this time.'}` }]);
      }
    } catch {
      setCopilotMessages(prev => [...prev, { sender: 'ai', text: '⚠️ Connection error. Please try again.' }]);
    } finally {
      setAskingCopilot(false);
    }
  };

  // Helper to trigger draft PO pre-filling link
  const handleDraftPurchaseOrder = (rec: any) => {
    // Deep-link to create PO page with draft variables as pre-loaded query parameters
    const queryParams = new URLSearchParams({
      article_code: rec.article_code,
      colour: rec.colour,
      quantity: String(rec.recommendedQty),
      vendor: rec.preferredVendor,
      is_draft_ai: 'true'
    }).toString();
    
    router.push(`/po/create?${queryParams}`);
  };

  if (loading && !insights) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column', gap: '20px' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #cbd5e1', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-ghost)', letterSpacing: '0.05em' }}>COMPILING AI TELEMETRY...</span>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      </div>
    );
  }

  // Calculate parameters for SVG chart
  const points = forecast?.points || [];
  const maxVal = Math.max(...points.map((p: any) => Math.max(p.historical || 0, p.predicted || 0, p.upperBound || 0)), 400);
  const chartHeight = 220;
  const chartWidth = 720;

  // Typed shape for SVG point objects
  type SvgPoint = {
    x: number;
    yHistorical: number | null;
    yPredicted: number | null;
    yLower: number | null;
    yUpper: number | null;
    date?: string;
    [key: string]: any;
  };
  
  // Map points to SVG coordinates
  const svgPoints: SvgPoint[] = points.map((p: any, i: number) => {
    const x = (i / (points.length - 1)) * chartWidth;
    const yHistorical = p.historical !== undefined ? chartHeight - ((p.historical / maxVal) * (chartHeight - 40)) - 20 : null;
    const yPredicted = p.predicted !== undefined ? chartHeight - ((p.predicted / maxVal) * (chartHeight - 40)) - 20 : null;
    const yLower = p.lowerBound !== undefined ? chartHeight - ((p.lowerBound / maxVal) * (chartHeight - 40)) - 20 : null;
    const yUpper = p.upperBound !== undefined ? chartHeight - ((p.upperBound / maxVal) * (chartHeight - 40)) - 20 : null;
    return { x, yHistorical, yPredicted, yLower, yUpper, date: p.date, ...p };
  });

  // Construct SVG paths
  const historicalPath = svgPoints
    .filter((p: SvgPoint) => p.yHistorical !== null)
    .map((p: SvgPoint, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yHistorical}`)
    .join(' ');

  // Prediction line starts exactly where historical ends
  const lastHistIndex = svgPoints.findLastIndex((p: SvgPoint) => p.yHistorical !== null);
  const predPoints = svgPoints.filter((p: SvgPoint, idx: number) => idx >= lastHistIndex && p.yPredicted !== null);
  const predictionPath = predPoints
    .map((p: SvgPoint, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yPredicted}`)
    .join(' ');

  // Construct Prophet confidence shaded area (Polygon coordinates)
  const lowerPoints = svgPoints.filter((p: SvgPoint) => p.yLower !== null);
  const upperPoints = [...svgPoints].filter((p: SvgPoint) => p.yUpper !== null).reverse();
  const polygonPoints = [
    ...lowerPoints.map((p: SvgPoint) => `${p.x},${p.yLower}`),
    ...upperPoints.map((p: SvgPoint) => `${p.x},${p.yUpper}`)
  ].join(' ');

  const currentAnomalyScore = anomalies.length > 0 ? (anomalies.reduce((a, b) => a + b.anomalyScore, 0) / anomalies.length) : 0.0;
  const criticalCount = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').length;

  return (
    <div className={styles.aiContainer}>
      
      {/* ── HERO COMMAND BANNER ─────────────────────────────────────────── */}
      <section className={styles.aiHero}>
        <div className={styles.heroGlow} />
        <div style={{ zIndex: 1 }}>
          <div className={styles.heroSubtitle}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#818cf8', borderRadius: '50%', boxShadow: '0 0 10px #818cf8', animation: 'pulse 1.8s infinite' }} />
            Assistive Cognitive Intelligence Layer Active
          </div>
          <h1 className={styles.heroTitle}>Operational Intelligence Center</h1>
          <p className={styles.heroDesc}>
            Non-blocking time-series demand forecasting, mathematical reorder recommendation metrics, size demand heatmap analytics, and transaction anomaly scanner.
          </p>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(129, 140, 248, 0.3)', padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🛡️ Recommendation Driven
            </span>
            <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
              Human operational control remains fully authoritative.
            </span>
          </div>
        </div>
        <div style={{ zIndex: 1, background: 'rgba(255,255,255,0.04)', padding: '20px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', minWidth: '220px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>COGNITIVE AGENT TARGET</div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: 'white', margin: '6px 0 2px 0', fontFamily: 'JetBrains Mono' }}>WMS v2.4.0</div>
          <div style={{ fontSize: '11.5px', color: '#818cf8', fontWeight: 700 }}>Telemetry Stream: Synchronized</div>
        </div>
      </section>

      {/* ── STATS WIDGETS GRID ──────────────────────────────────────────── */}
      <section className={styles.statsGrid}>
        
        <div className={styles.glassWidget}>
          <div>
            <div className={styles.widgetLabel}>
              <span>📥</span>
              <span>Inward Today</span>
            </div>
            <div className={styles.widgetValue}>{insights?.inwardToday?.txns ?? 0}</div>
          </div>
          <div className={styles.widgetTrend} style={{ color: '#64748b' }}>
            <span>{insights?.inwardToday?.qty ?? 0} pairs received</span>
          </div>
        </div>

        <div className={styles.glassWidget}>
          <div>
            <div className={styles.widgetLabel}>
              <span>📦</span>
              <span>Cartons Packed Today</span>
            </div>
            <div className={styles.widgetValue}>{insights?.cartonsToday ?? 0}</div>
          </div>
          <div className={styles.widgetTrend} style={{ color: '#64748b' }}>
            <span>{insights?.cartonsTotal ?? 0} total all time</span>
          </div>
        </div>

        <div className={styles.glassWidget}>
          <div>
            <div className={styles.widgetLabel}>
              <span>⏳</span>
              <span>Pending Approvals</span>
            </div>
            <div className={styles.widgetValue} style={{ color: (insights?.poStats?.pending_approval ?? 0) > 0 ? '#dc2626' : '#0f172a' }}>
              {insights?.poStats?.pending_approval ?? 0}
            </div>
          </div>
          <div className={styles.widgetTrend} style={{ color: '#64748b' }}>
            <span>POs awaiting admin review</span>
          </div>
        </div>

      </section>

      {/* ── COPILOT COMMAND DESK ────────────────────────────────────────── */}
      <section className={styles.copilotBox}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🧠</span>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>ERP Operations Copilot</h2>
          </div>
          <button
            onClick={() => setCopilotMessages([{ sender: 'ai', text: "👋 Hi! I'm your Operational Intelligence Analyst. Ask me anything about live stock levels, recent dispatches, delayed orders, or vendor performances." }])}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '8px',
              transition: 'all 0.2s',
            }}
            title="Clear conversation history"
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            🗑️ Clear Chat
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
          Ask questions about live warehouse data. For example: <i>"Show upperstock inventory"</i>, <i>"Show low stock"</i>, <i>"Pending approvals"</i>, <i>"Which vendor delayed most?"</i>.
        </p>

        {/* Conversation Thread */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: '320px',
          overflowY: 'auto',
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '16px',
          margin: '8px 0'
        }}>
          {copilotMessages.map((msg, index) => (
            <div
              key={index}
              style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                background: msg.sender === 'user' ? 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)' : '#f8fafc',
                color: msg.sender === 'user' ? 'white' : '#1e293b',
                padding: '10px 14px',
                borderRadius: '12px',
                borderTopRightRadius: msg.sender === 'user' ? '2px' : '12px',
                borderTopLeftRadius: msg.sender === 'ai' ? '2px' : '12px',
                maxWidth: '85%',
                fontSize: '13px',
                lineHeight: 1.5,
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                border: msg.sender === 'ai' ? '1px solid #e2e8f0' : 'none',
                whiteSpace: 'pre-line'
              }}
            >
              {msg.text}
            </div>
          ))}
          {askingCopilot && (
            <div style={{
              alignSelf: 'flex-start',
              background: '#f8fafc',
              color: '#64748b',
              padding: '10px 14px',
              borderRadius: '12px',
              borderTopLeftRadius: '2px',
              fontSize: '12.5px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ display: 'inline-flex', gap: 2 }}>
                <span style={{ animation: 'dotPulse 1.2s infinite', animationDelay: '0s' }}>●</span>
                <span style={{ animation: 'dotPulse 1.2s infinite', animationDelay: '0.2s' }}>●</span>
                <span style={{ animation: 'dotPulse 1.2s infinite', animationDelay: '0.4s' }}>●</span>
              </span>
              Analyzing real-time database ledger...
            </div>
          )}
        </div>

        <form onSubmit={handleCopilotQuery} className={styles.copilotInputArea}>
          <input
            type="text"
            className={styles.copilotInput}
            placeholder="Ask about inventory, orders, vendors, scans..."
            value={copilotQuery}
            onChange={e => setCopilotQuery(e.target.value)}
          />
          <button type="submit" className={styles.copilotButton} disabled={askingCopilot}>
            Ask ➔
          </button>
        </form>
      </section>

      {/* ── INTERACTIVE PREDICTION & SIZE HEATMAPS SECTION ──────────────── */}
      <section className={styles.analyticsSection}>
        
        {/* Temporal Demand Forecast Curve Widget */}
        <div className={styles.aiCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>30-Day Prophet Temporal Demand Forecast</div>
            <select 
              className={styles.aiSelect}
              value={selectedArticle}
              onChange={e => setSelectedArticle(e.target.value)}
            >
              <option value="ALL">All Article Codes</option>
              {(insights?.uniqueArticles || []).map((art: string) => (
                <option key={art} value={art}>Article {art}</option>
              ))}
            </select>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '240px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px 20px', overflow: 'hidden' }}>
            
            {/* SVG Interactive Graph */}
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              width="100%" 
              height="100%" 
              preserveAspectRatio="none" 
              style={{ overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="prophetGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="predLineGlow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>

              {/* Horizontal Reference Grid lines */}
              <line x1="0" y1={chartHeight * 0.25} x2={chartWidth} y2={chartHeight * 0.25} stroke="#e2e8f0" strokeDasharray="4 4" />
              <line x1="0" y1={chartHeight * 0.5} x2={chartWidth} y2={chartHeight * 0.5} stroke="#e2e8f0" strokeDasharray="4 4" />
              <line x1="0" y1={chartHeight * 0.75} x2={chartWidth} y2={chartHeight * 0.75} stroke="#e2e8f0" strokeDasharray="4 4" />

              {/* Shaded Prophet Confidence Band */}
              {polygonPoints && (
                <polygon points={polygonPoints} fill="url(#prophetGlow)" />
              )}

              {/* Historical Trend Line (Solid Royal Slate) */}
              {historicalPath && (
                <path d={historicalPath} fill="none" stroke="#334155" strokeWidth="3.5" strokeLinecap="round" />
              )}

              {/* Prophet Predictive Trend line (Dashed Royal Blue) */}
              {predictionPath && (
                <path d={predictionPath} fill="none" stroke="url(#predLineGlow)" strokeWidth="3.5" strokeDasharray="6 4" strokeLinecap="round" />
              )}

              {/* Historical data dots */}
              {svgPoints.map((p, idx) => {
                if (p.yHistorical === null) return null;
                // Render every 3rd dot to keep visualization pristine
                if (idx % 3 !== 0) return null;
                return (
                  <g key={`hist-dot-${idx}`}>
                    <circle cx={p.x} cy={p.yHistorical} r="5" fill="#334155" />
                    <circle cx={p.x} cy={p.yHistorical} r="9" fill="none" stroke="#334155" strokeWidth="1.5" opacity="0.4" />
                  </g>
                );
              })}

              {/* Forecast projection dots */}
              {svgPoints.map((p, idx) => {
                if (p.yHistorical !== null || p.yPredicted === null) return null;
                if (idx % 3 !== 0) return null;
                return (
                  <g key={`pred-dot-${idx}`}>
                    <circle cx={p.x} cy={p.yPredicted} r="5" fill="#6366f1" />
                    <circle cx={p.x} cy={p.yPredicted} r="10" fill="none" stroke="#6366f1" strokeWidth="1.5" opacity="0.4" />
                  </g>
                );
              })}
            </svg>

            {/* Float Markers */}
            <div style={{ position: 'absolute', top: '15px', right: '20px', display: 'flex', gap: '16px', background: 'rgba(255,255,255,0.95)', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 800 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '3px', background: '#334155', borderRadius: '2px' }} />
                <span>Historical Outward</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '3px', background: '#6366f1', borderStyle: 'dashed', border: '1.5px dashed #6366f1' }} />
                <span style={{ color: '#4f46e5' }}>Prophet AI Forecast</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '8px', background: 'rgba(99, 102, 241, 0.12)', borderRadius: '2px' }} />
                <span style={{ color: '#6366f1', opacity: 0.8 }}>Prophet 80% CI</span>
              </div>
            </div>

            {/* Bottom Timeline Date Markers */}
            <div style={{ position: 'absolute', bottom: '8px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', fontWeight: 800, fontFamily: 'JetBrains Mono' }}>
              <span>{points[0]?.date}</span>
              <span style={{ color: '#6366f1' }}>Current Time Boundary (Telemetry Cutoff)</span>
              <span>{points[points.length - 1]?.date}</span>
            </div>

          </div>
        </div>

        {/* Interactive Size Demand Heatmap */}
        <div className={styles.aiCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Dynamic Size Demand Distribution</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
              Proportions of sizes dispatched historically. AI recommends matching future order structures to these ratios to avoid dead-stock buildup.
            </p>
            
            {/* 3D-feel Vertical bar matrix */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-end', height: '140px', padding: '10px 0' }}>
              {Object.keys(insights?.sizeDistribution?.distribution || {}).map((sizeKey: any) => {
                const percentage = insights.sizeDistribution.distribution[sizeKey];
                const heightVal = Math.max(12, Math.round(percentage * 3));
                const isTopSize = sizeKey === String(insights?.sizeDistribution?.topSize);

                return (
                  <div key={sizeKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{ 
                        width: '100%', 
                        height: `${heightVal}px`, 
                        background: isTopSize 
                          ? 'linear-gradient(to top, #4f46e5, #818cf8)' 
                          : 'linear-gradient(to top, #94a3b8, #cbd5e1)', 
                        borderRadius: '6px',
                        boxShadow: isTopSize ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none',
                        transition: 'all 0.3s',
                        cursor: 'help',
                        position: 'relative'
                      }}
                      title={`Size ${sizeKey}: ${percentage}% Demand Ratio`}
                      className="size-bar"
                    >
                      <span style={{ position: 'absolute', top: '-18px', left: 0, right: 0, textAlign: 'center', fontSize: '9.5px', fontWeight: 800, color: isTopSize ? '#4f46e5' : '#475569' }}>
                        {percentage}%
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: isTopSize ? '#4f46e5' : '#64748b' }}>
                      Sz {sizeKey}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>💡</span>
              <span style={{ color: '#475569', lineHeight: 1.4 }}>
                AI Recommended Allocation: <b>Size {insights?.sizeDistribution?.topSize}</b> exhibits the highest packing velocity. Secure a <b>{insights?.sizeDistribution?.distribution[insights?.sizeDistribution?.topSize]}% share</b> in your draft drafts.
              </span>
            </div>
          </div>
        </div>

      </section>

      {/* ── DYNAMIC REORDER ADVICE (ADVISORY DRAFT TRIGGER PANEL) ────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className={styles.cardTitle}>Dynamic Procurement Recommendations</div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 4px 0', lineHeight: 1.5 }}>
          Rolling reorder indicators generated mathematically using dynamic lead times, consumption velocity indexes, and safety margin calculations. 
          To preserve human authority, clicking <b>"Draft Advisory PO"</b> will not submit the order automatically, but will deep-link and auto-populate a draft sheet for your final review.
        </p>

        <div className={styles.adviceGrid}>
          {insights?.reorderSuggestions?.map((rec: any, idx: number) => {
            const isCritical = rec.status === 'CRITICAL_SHORTAGE';
            
            return (
              <div 
                key={`${rec.article_code}-${rec.colour}-${idx}`} 
                className={`${styles.adviceCard} ${isCritical ? styles.critical : styles.warning}`}
              >
                <div className={styles.adviceHeader}>
                  <div className={styles.adviceMeta}>
                    <div className={styles.articleTitle}>{rec.description} ({rec.article_code})</div>
                    <div className={styles.articleColor}>Colour: {rec.colour}</div>
                  </div>
                  <span className={`${styles.badge} ${isCritical ? styles.critical : styles.high}`}>
                    {isCritical ? '🚨 Critical out' : '⚠️ Suggest reorder'}
                  </span>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Current Stock</span>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{rec.currentStock} pairs</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Safety Stock Threshold</span>
                    <strong style={{ fontSize: '14px', color: '#334155' }}>{rec.safetyStock} pairs</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Calculated ROP</span>
                    <strong style={{ fontSize: '14px', color: '#334155' }}>{rec.reorderPoint} pairs</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Days to Stockout</span>
                    <strong style={{ fontSize: '14px', color: isCritical ? '#dc2626' : '#ea580c' }}>
                      {rec.daysToStockout} {rec.daysToStockout === 1 ? 'day' : 'days'}
                    </strong>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11.5px' }}>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '3px' }}>Preferred Supplier (OTD: 94%)</span>
                  <strong>{rec.preferredVendor}</strong>
                </div>

                <button 
                  onClick={() => handleDraftPurchaseOrder(rec)}
                  className={styles.adviceTrigger}
                >
                  <span>✍️ Draft Advisory PO ({rec.recommendedQty} pairs)</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── TRANSACTION ANOMALY ALERTS ───────────────────────────────────── */}
      <section className={styles.tableCard}>
        <div className={styles.cardTitle}>Transaction Anomaly Alerts</div>
        <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
          Detects out-of-hours ledger entries and negative stock balances from real transaction records.
        </p>

        {anomalies.length === 0 ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 20px', color: '#15803d', fontSize: 13, marginTop: 12 }}>
            ✅ No anomalies detected in recent transaction records.
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.intelTable}>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Module</th>
                  <th>Description</th>
                  <th>Score</th>
                  <th>Detected</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((anom: any) => (
                  <tr key={anom.id || anom.description}>
                    <td>
                      <span className={`${styles.badge} ${styles[anom.severity]}`}>
                        {anom.severity}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#4f46e5' }}>{anom.module?.toUpperCase()}</td>
                    <td style={{ fontSize: '13px' }}>{anom.description}</td>
                    <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                      {(anom.anomalyScore * 100).toFixed(0)}%
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {anom.createdAt ? new Date(anom.createdAt).toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── VENDOR RELIABILITY SCORECARDS ────────────────────────────────── */}
      <section className={styles.tableCard}>
        <div className={styles.cardTitle}>Vendor Reliability Scorecard</div>
        <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
          Computed from actual purchase order records — completion ratios, average lead times, and pricing stability derived from your ERP data.
        </p>

        {(!insights?.vendorScorecards?.length) ? (
          <div style={{ background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: 12, padding: '16px 20px', color: '#94a3b8', fontSize: 13, marginTop: 12, textAlign: 'center' }}>
            No vendor scorecard data yet. Complete purchase order workflows to generate performance metrics.
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.intelTable}>
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Grade</th>
                  <th>Reliability</th>
                  <th>Avg Lead Time</th>
                  <th>Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {insights.vendorScorecards.map((v: any, idx: number) => (
                  <tr key={`${v.vendorName}-${idx}`}>
                    <td style={{ fontWeight: 700 }}>{v.vendorName}</td>
                    <td>
                      <span
                        className={styles.badge}
                        style={{
                          background: v.overallGrade === 'A' ? '#dcfce7' : v.overallGrade === 'B' ? '#dbeafe' : v.overallGrade === 'C' ? '#fef9c3' : '#fee2e2',
                          color: v.overallGrade === 'A' ? '#166534' : v.overallGrade === 'B' ? '#1d4ed8' : v.overallGrade === 'C' ? '#854d0e' : '#991b1b'
                        }}
                      >
                        Grade {v.overallGrade}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{v.reliabilityScore}%</td>
                    <td>{v.averageLeadTimeHours}h avg</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${v.completionEfficiency}%`, height: '100%', background: '#16a34a' }} />
                        </div>
                        <span>{v.completionEfficiency}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
