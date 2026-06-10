'use client';

import { useState } from 'react';
import ExportDropdown from '@/components/ExportDropdown';

interface POResetExportPanelProps {
  /** Current user role */
  userRole: string;
  /** Export data */
  exportFilename: string;
  exportHeaders: string[];
  exportRows: any[][];
  /** Optional callback after reset completes */
  onResetComplete?: () => void;
}

export default function POResetExportPanel({
  userRole,
  exportFilename,
  exportHeaders,
  exportRows,
  onResetComplete
}: POResetExportPanelProps) {
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPreview, setResetPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<any>(null);

  const canReset = userRole === 'pm' || userRole === 'admin';

  const handleOpenReset = async () => {
    setShowResetModal(true);
    setResetResult(null);
    setLoadingPreview(true);
    try {
      const res = await fetch('/api/po/reset');
      if (res.ok) {
        const data = await res.json();
        setResetPreview(data);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to load reset preview');
        setShowResetModal(false);
      }
    } catch {
      alert('Network error loading reset preview');
      setShowResetModal(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteReset = async () => {
    const confirmMsg = `🛑 CRITICAL WARNING 🛑\n\nYou are about to PERMANENTLY DELETE all Purchase Order data.\nThis includes all POs, items, activity logs, notifications, and approval history.\n\nThis action CANNOT BE UNDONE.\n\nType "CONFIRM" to proceed.`;
    const userInput = window.prompt(confirmMsg);
    if (userInput !== 'CONFIRM') {
      alert('PO Reset cancelled.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('/api/po/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'CONFIRM_RESET' })
      });
      const data = await res.json();
      if (res.ok) {
        setResetResult(data);
        if (onResetComplete) onResetComplete();
      } else {
        alert('Reset failed: ' + (data.error || 'Unknown error'));
      }
    } catch {
      alert('Network error during reset.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      {/* Action Buttons Row */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Export - available to everyone */}
        <ExportDropdown
          filename={exportFilename}
          headers={exportHeaders}
          rows={exportRows}
        />

        {/* Reset - only PM and Admin */}
        {canReset && (
          <button
            onClick={handleOpenReset}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 6px rgba(239, 68, 68, 0.25)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(239, 68, 68, 0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(239, 68, 68, 0.25)'; }}
          >
            🗑️ Reset All PO Data
          </button>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '20px', width: '100%', maxWidth: '600px',
            maxHeight: '85vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 28px', borderBottom: '1px solid #fee2e2',
              background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
              borderRadius: '20px 20px 0 0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🛑 PO Factory Reset
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
                  Download your data before proceeding with the permanent purge.
                </p>
              </div>
              <button
                onClick={() => { setShowResetModal(false); setResetResult(null); }}
                style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#dc2626', fontWeight: 900 }}
              >×</button>
            </div>

            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Step 1: Download Data First */}
              <div style={{
                background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '20px',
                display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📥</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e40af' }}>Step 1: Download Data Before Reset</span>
                </div>
                <p style={{ fontSize: '12px', color: '#1e3a5f', lineHeight: 1.6, margin: 0 }}>
                  It is strongly recommended to export all PO data before resetting. Use the buttons below to download in your preferred format.
                </p>
                <ExportDropdown
                  filename={`PO_Full_Backup_${new Date().toISOString().slice(0, 10)}`}
                  headers={exportHeaders}
                  rows={exportRows}
                />
              </div>

              {/* Step 2: Preview what will be deleted */}
              <div style={{
                background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '14px', padding: '20px',
                display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#991b1b' }}>Step 2: Review Data to be Permanently Deleted</span>
                </div>

                {loadingPreview ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#b91c1c', fontWeight: 600 }}>
                    <div className="loading-dot" /> Loading preview...
                  </div>
                ) : resetResult ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#15803d', marginBottom: '8px' }}>✅ Reset Complete</div>
                    <p style={{ fontSize: '13px', color: '#166534', margin: 0 }}>{resetResult.message}</p>
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(resetResult.results || []).map((r: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: r.status === 'cleared' ? '#16a34a' : '#dc2626' }}>
                          <span style={{ fontFamily: 'monospace' }}>{r.table}</span>
                          <span>{r.status} ({r.rows_deleted} rows)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : resetPreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, color: '#991b1b', padding: '8px 0', borderBottom: '1px solid #fecaca' }}>
                      <span>Table</span>
                      <span>Records to Delete</span>
                    </div>
                    {(resetPreview.counts || []).map((c: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#7f1d1d', padding: '6px 0' }}>
                        <span style={{ fontFamily: 'monospace' }}>{c.table}</span>
                        <span style={{ fontWeight: 800, color: c.rows > 0 ? '#dc2626' : '#94a3b8' }}>{c.rows.toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 900, color: '#991b1b', padding: '10px 0', borderTop: '2px solid #fecaca', marginTop: '4px' }}>
                      <span>Total Records</span>
                      <span>{(resetPreview.totalRecords || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Execute Reset Button */}
              {!resetResult && (
                <button
                  onClick={handleExecuteReset}
                  disabled={isResetting}
                  style={{
                    width: '100%', padding: '14px',
                    background: isResetting ? '#94a3b8' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                    color: 'white', border: 'none', borderRadius: '12px',
                    fontSize: '14px', fontWeight: 900, cursor: isResetting ? 'wait' : 'pointer',
                    boxShadow: isResetting ? 'none' : '0 4px 14px rgba(220, 38, 38, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  {isResetting ? '⏳ Resetting...' : '🛑 EXECUTE PERMANENT RESET'}
                </button>
              )}

              {resetResult && (
                <button
                  onClick={() => { setShowResetModal(false); setResetResult(null); window.location.reload(); }}
                  style={{
                    width: '100%', padding: '14px',
                    background: 'linear-gradient(135deg, #16a34a, #15803d)',
                    color: 'white', border: 'none', borderRadius: '12px',
                    fontSize: '14px', fontWeight: 900, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  ✅ Close & Reload Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
