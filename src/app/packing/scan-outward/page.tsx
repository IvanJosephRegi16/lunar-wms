'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';

export default function ScanOutwardPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return <ScanOutwardHistoryDashboard />;
  }

  return <ActiveScanSession sessionId={sessionId} />;
}

function ScanOutwardHistoryDashboard() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetch('/api/packing/outward/history')
      .then(r => r.json())
      .then(data => {
        if (data.history) setHistory(data.history);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const exportCSV = () => {
    if (history.length === 0) return;
    const headers = ['Session ID', 'Article', 'Colour', 'Master Rule', 'Total Pairs', 'Operator', 'Status', 'Started At', 'Completed At'];
    const rows = history.map(h => [
      h.session_id,
      h.article_code,
      h.colour,
      h.rule_name,
      h.total_pairs,
      h.operator_name || 'System',
      h.status,
      h.created_at ? new Date(h.created_at).toLocaleString() : '',
      h.completed_at ? new Date(h.completed_at).toLocaleString() : ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Scan_Outward_History_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetHistory = async () => {
    const confirmMsg = `🛑 CRITICAL WARNING 🛑\n\nYou are about to PERMANENTLY DELETE all Outward Scanning History.\n\nType "RESET" to confirm.`;
    const userInput = window.prompt(confirmMsg);
    if (userInput !== 'RESET') {
      alert('Reset cancelled.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('/api/packing/outward/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET_HISTORY' })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        window.location.reload();
      } else {
        alert(data.error || 'Failed to reset history.');
      }
    } catch {
      alert('Network error during reset.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fade-up" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Scanning Outward History</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-ghost)', fontSize: '14px' }}>
            View completed and active outward packing sessions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleResetHistory}
            disabled={isResetting}
            className="btn-corp"
            style={{ background: '#ef4444', color: 'white', border: 'none', opacity: isResetting ? 0.7 : 1, cursor: isResetting ? 'wait' : 'pointer' }}
          >
            {isResetting ? '⏳ Resetting...' : '🛑 Reset History'}
          </button>
          <button onClick={exportCSV} className="btn-corp" style={{ background: '#10b981', color: 'white', border: 'none' }}>
            📊 Export CSV
          </button>
          <button onClick={() => router.push('/packing/verify')} className="btn-corp" style={{ background: '#3b82f6', color: 'white', border: 'none' }}>
            🔍 Verify Barcode
          </button>
          <button onClick={() => router.push('/carton-generation')} className="btn-corp" style={{ background: 'var(--neon-violet)', color: 'white', border: 'none' }}>
            ➕ New Scan Session
          </button>
        </div>
      </div>

      <style>{`
        .scan-history-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #1e293b;
          font-family: 'Inter', system-ui, sans-serif;
          background: white;
          margin: 0;
        }
        .scan-history-table th {
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 800;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 12px 16px;
          border: 1px solid #cbd5e1;
          border-bottom: 2px solid #1e293b;
          text-align: left;
        }
        .scan-history-table td {
          padding: 14px 16px;
          font-size: 14px;
          color: #334155;
          border: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .scan-history-table tbody tr:hover td {
          background-color: #f8fafc;
        }
      `}</style>

      <div className="card-clean" style={{ padding: '24px', overflowX: 'auto', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-ghost)' }}>Loading history...</div>
        ) : (
          <table className="scan-history-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Article Code</th>
                <th>Colour</th>
                <th>Master Rule</th>
                <th>Pairs</th>
                <th>Operator</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map(session => (
                <tr key={session.session_id}>
                  <td>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800,
                      background: session.article_code?.toUpperCase().startsWith('J') ? '#fef3c7' : '#e0e7ff',
                      color: session.article_code?.toUpperCase().startsWith('J') ? '#d97706' : '#4338ca'
                    }}>
                      {session.article_code?.toUpperCase().startsWith('J') ? 'JOKOT' : 'LUNAR'}
                    </span>
                  </td>
                  <td>{session.article_code}</td>
                  <td>{session.colour}</td>
                  <td>{session.rule_name}</td>
                  <td>{session.total_pairs}</td>
                  <td>{session.operator_name || 'System'}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700,
                      background: session.status === 'completed' ? '#dcfce7' : session.status === 'in_progress' ? '#fef3c7' : '#fee2e2',
                      color: session.status === 'completed' ? '#16a34a' : session.status === 'in_progress' ? '#d97706' : '#ef4444'
                    }}>
                      {session.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text-ghost)' }}>
                    {new Date(session.created_at).toLocaleString()}
                  </td>
                  <td>
                    {session.status === 'in_progress' && (
                      <button
                        onClick={() => router.push(`/packing/scan-outward?session_id=${session.session_id}`)}
                        style={{ padding: '4px 12px', background: 'var(--neon-violet)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                      >
                        Resume
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-ghost)' }}>
                    No outward scan history found.
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

function ActiveScanSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [barcode, setBarcode] = useState('');
  // Use a REF lock (not state) so the UI is never blocked between scans
  const isScanningRef = useRef(false);
  const scanQueue = useRef<string[]>([]);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; data?: any; isDuplicate?: boolean } | null>(null);

  // Custom Approval Modal State
  const [approvalModal, setApprovalModal] = useState<{ isOpen: boolean; message: string; pendingBarcode: string } | null>(null);

  // MRP Warning Modal State
  const [mrpWarningModal, setMrpWarningModal] = useState<{ isOpen: boolean; reason: string; barcode: string; lastScanData: any } | null>(null);

  // Sticker & MRP State
  const [mrpPopup, setMrpPopup] = useState(false);
  const [earlySealWarning, setEarlySealWarning] = useState(false);
  const [enteredMrp, setEnteredMrp] = useState('');
  const [sealedCartonData, setSealedCartonData] = useState<any>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetchSessionData();
  }, [sessionId]);

  // Focus once on mount — do NOT re-run on every render (causes re-render storms during scanning)
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const fetchSessionData = async () => {
    try {
      const res = await fetch(`/api/packing/outward/session/${sessionId}`);
      const data = await res.json();
      if (res.ok) {
        setSession(data.session);
        setProgress(data.progress);

        if (data.session.status === 'completed') {
          alert('This session is already completed!');
          router.push('/packed-inventory');
        } else if (data.session.status === 'cancelled') {
          alert('This session was cancelled.');
          router.push('/carton-generation');
        }
      } else {
        alert(data.error);
        router.push('/carton-generation');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ─── SUPER-FAST SCAN ENGINE ──────────────────────────────────────────────────
  // Uses a ref-lock + queue so the input is NEVER blocked. Workers can scan as
  // fast as the hardware allows; queued barcodes are processed sequentially.
  const processScanQueue = async () => {
    if (isScanningRef.current) return; // already running
    while (scanQueue.current.length > 0) {
      const codeToScan = scanQueue.current.shift()!;
      isScanningRef.current = true;
      try {
        const res = await fetch('/api/packing/outward/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, barcode: codeToScan, force: false })
        });
        const data = await res.json();

        if (res.status === 200 && data.requireApproval) {
          setApprovalModal({
            isOpen: true,
            message: data.message,
            pendingBarcode: codeToScan
          });
          setScanResult(null);
          // Pause queue until user responds to approval modal
          isScanningRef.current = false;
          return;
        } else if (res.ok) {
          const artMrp = data.article?.mrp;
          const sessMrp = session?.mrp;
          let mrpIssueReason = '';
          if (!artMrp || artMrp === '' || artMrp === null) {
            mrpIssueReason = `The scanned barcode has NO MRP set. Article: ${data.article?.article_code || ''}, Size: ${data.article?.size || ''}. Please verify before proceeding.`;
          } else if (sessMrp && Number(sessMrp) !== Number(artMrp)) {
            mrpIssueReason = `MRP Mismatch Detected!\n\nSession MRP: ₹${Number(sessMrp).toFixed(2)}\nScanned MRP: ₹${Number(artMrp).toFixed(2)}\n\nArticle: ${data.article?.article_code || ''}, Size: ${data.article?.size || ''}. This may be a wrong article or incorrect data entry.`;
          }
          setScanResult({ success: true, message: data.message, data: data.article });
          // Optimistic UI update — zero perceived lag
          setProgress(prev => {
            const next = [...prev];
            const idx = next.findIndex(p => p.size === data.article.size);
            if (idx >= 0) {
              next[idx] = { ...next[idx], scanned: Number(next[idx].scanned) + 1, remaining: Math.max(0, Number(next[idx].remaining) - 1) };
            } else {
              next.push({ size: data.article.size, required: 0, scanned: 1, remaining: 0 });
              next.sort((a, b) => parseInt(a.size) - parseInt(b.size));
            }
            return next;
          });
          if (mrpIssueReason) {
            setMrpWarningModal({ isOpen: true, reason: mrpIssueReason, barcode: codeToScan, lastScanData: data.article });
            isScanningRef.current = false;
            return;
          }
        } else if (res.status === 409 && data.isDuplicate) {
          setScanResult({ success: false, message: data.error, isDuplicate: true });
        } else {
          setScanResult({ success: false, message: data.error });
        }
      } catch (err: any) {
        setScanResult({ success: false, message: err.message || 'Network error' });
      } finally {
        isScanningRef.current = false;
      }
    }
    // Re-focus after queue drains
    barcodeInputRef.current?.focus();
  };

  const handleScan = (e?: React.FormEvent, force: boolean = false, overrideBarcode?: string) => {
    if (e) e.preventDefault();
    const codeToScan = overrideBarcode || barcode.trim();
    if (!overrideBarcode) setBarcode('');
    if (!codeToScan) return;

    if (force) {
      // Force-scan (approval confirmed) — runs immediately and re-opens queue
      setApprovalModal(null);
      fetch('/api/packing/outward/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, barcode: codeToScan, force: true })
      }).then(async forceRes => {
        const data = await forceRes.json();
        if (forceRes.ok) {
          const artMrp2 = data.article?.mrp;
          const sessMrp2 = session?.mrp;
          let mrpIssueReason2 = '';
          if (!artMrp2 || artMrp2 === '' || artMrp2 === null) {
            mrpIssueReason2 = `The scanned barcode has NO MRP set. Article: ${data.article?.article_code || ''}, Size: ${data.article?.size || ''}. Please verify before proceeding.`;
          } else if (sessMrp2 && Number(sessMrp2) !== Number(artMrp2)) {
            mrpIssueReason2 = `MRP Mismatch Detected!\n\nSession MRP: ₹${Number(sessMrp2).toFixed(2)}\nScanned MRP: ₹${Number(artMrp2).toFixed(2)}\n\nArticle: ${data.article?.article_code || ''}, Size: ${data.article?.size || ''}. This may be a wrong article or incorrect data entry.`;
          }
          setScanResult({ success: true, message: data.message, data: data.article });
          setProgress(prev => {
            const next = [...prev];
            const idx = next.findIndex(p => p.size === data.article.size);
            if (idx >= 0) {
              next[idx] = { ...next[idx], scanned: Number(next[idx].scanned) + 1, remaining: Math.max(0, Number(next[idx].remaining) - 1) };
            } else {
              next.push({ size: data.article.size, required: 0, scanned: 1, remaining: 0 });
              next.sort((a, b) => parseInt(a.size) - parseInt(b.size));
            }
            return next;
          });
          if (mrpIssueReason2) {
            setMrpWarningModal({ isOpen: true, reason: mrpIssueReason2, barcode: codeToScan, lastScanData: data.article });
          } else {
            processScanQueue();
            barcodeInputRef.current?.focus();
          }
        } else {
          setScanResult({ success: false, message: data.error });
          processScanQueue();
          barcodeInputRef.current?.focus();
        }
      }).catch(err => {
        setScanResult({ success: false, message: err.message || 'Network error' });
        processScanQueue();
      });
      return;
    }

    // Normal path: push to queue and process
    scanQueue.current.push(codeToScan);
    processScanQueue();
  };

  const confirmApproval = () => {
    if (approvalModal) {
      const code = approvalModal.pendingBarcode;
      setApprovalModal(null);
      handleScan(undefined, true, code);
    }
  };

  const cancelApproval = () => {
    setApprovalModal(null);
    setScanResult({ success: false, message: 'Extra size variation rejected by user.' });
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  // MRP Warning Modal handlers
  const approveMrpWarning = () => {
    setMrpWarningModal(null);
    processScanQueue();
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  const rejectMrpWarning = async () => {
    if (!mrpWarningModal) return;
    const barcodeToUndo = mrpWarningModal.barcode;
    setMrpWarningModal(null);
    try {
      const res = await fetch('/api/packing/outward/scan/unscan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, barcode: barcodeToUndo })
      });
      const data = await res.json();
      if (res.ok) {
        setScanResult({ success: false, message: `⚠️ MRP issue: Barcode rejected and returned to Scan Intake. (${barcodeToUndo})` });
      } else {
        setScanResult({ success: false, message: `⚠️ Reject failed: ${data.error}` });
      }
    } catch {
      setScanResult({ success: false, message: '⚠️ Network error while rejecting scan.' });
    }
    await fetchSessionData();
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  const handleManualSealClick = () => {
    const totalPairsScanned = progress.reduce((acc, curr) => acc + Number(curr.scanned), 0);
    const totalPairsRequired = progress.reduce((acc, curr) => acc + Number(curr.required), 0);

    if (totalPairsScanned < totalPairsRequired) {
      setEarlySealWarning(true);
      return;
    }
    proceedToSeal();
  };

  const proceedToSeal = () => {
    setEarlySealWarning(false);
    if (session?.mrp) {
      // Show the MRP for 1 pair only, not multiplied by total pairs
      const computedMrp = Number(session.mrp).toFixed(2);
      setEnteredMrp(computedMrp);
    } else {
      setEnteredMrp('');
    }
    setMrpPopup(true);
  };

  const confirmManualSeal = async (mrpValue: string | null) => {
    setMrpPopup(false);
    if (!confirm('Seal carton now?')) return;
    try {
      const res = await fetch(`/api/packing/outward/session/seal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      if (res.ok) {
        setSealedCartonData({
          carton: data.carton || 'SEALED',
          article: session.article_code,
          colour: session.colour,
          mrp: mrpValue,
          progress: progress
        });
      } else {
        alert(data.error || 'Failed to seal carton');
      }
    } catch (err) {
      console.error(err);
      alert('Error sealing carton');
    }
  };

  const handleCancelSession = async () => {
    if (!confirm('Are you sure you want to cancel? Any scanned items will be returned to the inventory pool.')) return;

    try {
      const res = await fetch('/api/packing/outward/session/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Session cancelled successfully.');
        router.push('/carton-generation');
      } else {
        alert(data.error || 'Failed to cancel session');
      }
    } catch (err) {
      console.error(err);
      alert('Error cancelling session');
    }
  };

  if (loading || !session) {
    return <div className="fade-up" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-ghost)' }}>Loading Session...</div>;
  }

  const totalRequired = progress.reduce((acc, curr) => acc + Number(curr.required), 0);
  const totalScanned = progress.reduce((acc, curr) => acc + Number(curr.scanned), 0);
  const canSeal = progress.length > 0 && progress.every(p => Number(p.scanned) >= Number(p.required) - 1);

  if (sealedCartonData) {
    const handleStickerCancel = async () => {
      if (!confirm('⚠️ Cancel this carton? All scanned barcodes will be returned to Scan Intake.')) return;
      try {
        const res = await fetch('/api/packing/outward/session/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId })
        });
        const data = await res.json();
        if (res.ok) {
          alert('✅ Carton cancelled. All barcodes returned to Scan Intake.');
          router.push('/carton-generation');
        } else {
          alert(data.error || 'Failed to cancel carton.');
        }
      } catch {
        alert('Network error cancelling carton.');
      }
    };
    return <MasterCartonSticker cartonData={sealedCartonData} onClose={() => router.push('/packed-inventory')} onCancel={handleStickerCancel} />;
  }

  return (
    <div className="fade-up" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', position: 'relative' }}>

      {/* MRP POPUP */}
      {mrpPopup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card-clean" style={{ background: '#ffffff', padding: '40px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', borderRadius: '24px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 16px 0', color: '#0f172a', letterSpacing: '-0.5px' }}>Enter MRP</h2>
            <p style={{ margin: '0 0 24px 0', color: '#475569', fontSize: '15px' }}>
              Enter the TOTAL MRP for this Master Carton. Skip to hide MRP from the sticker.
            </p>
            <div style={{ position: 'relative', width: '100%', marginBottom: '24px' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '24px', fontWeight: 'bold', color: '#333' }}>₹</span>
              <input
                type="number"
                placeholder="e.g. 499.00"
                value={enteredMrp}
                onChange={e => setEnteredMrp(e.target.value)}
                className="corporate-input"
                style={{ width: '100%', fontSize: '24px', padding: '16px 16px 16px 48px', textAlign: 'center', borderRadius: '12px', border: '2px solid #cbd5e1' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button onClick={() => confirmManualSeal(null)} className="btn-corp" style={{ flex: 1, padding: '16px', background: '#f1f5f9', color: '#475569', borderRadius: '12px', border: 'none', fontWeight: 700 }}>
                Skip MRP
              </button>
              <button onClick={() => confirmManualSeal(enteredMrp || null)} className="btn-corp" style={{ flex: 1, padding: '16px', background: '#10b981', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 800 }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MRP WARNING MODAL */}
      {mrpWarningModal?.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card-clean" style={{ background: '#ffffff', padding: '40px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)', borderRadius: '24px', border: '3px solid #fbbf24' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 8px 0', color: '#92400e' }}>MRP Warning</h2>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px', margin: '16px 0 24px 0', textAlign: 'left' }}>
              {mrpWarningModal.reason.split('\n').map((line, i) => (
                <p key={i} style={{ margin: '4px 0', fontSize: '14px', color: '#78350f', fontWeight: line.includes('₹') || line.includes('MRP') ? 700 : 500 }}>{line}</p>
              ))}
            </div>
            <p style={{ margin: '0 0 24px 0', color: '#475569', fontSize: '14px' }}>Do you want to <strong>approve</strong> this scan anyway, or <strong>reject</strong> and remove it?</p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button onClick={rejectMrpWarning} className="btn-corp" style={{ background: '#fef2f2', color: '#ef4444', border: '2px solid #fecaca', flex: 1, padding: '14px', fontSize: '15px', borderRadius: '12px', fontWeight: 800 }}>
                ✕ Reject Scan
              </button>
              <button onClick={approveMrpWarning} className="btn-corp" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', border: 'none', flex: 1, padding: '14px', fontSize: '15px', borderRadius: '12px', fontWeight: 800, boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.4)' }}>
                ✓ Approve Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROFESSIONAL APPROVAL MODAL */}
      {approvalModal?.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card-clean" style={{ background: '#ffffff', padding: '40px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '56px', marginBottom: '20px', animation: 'bounce 2s infinite' }}>⚠️</div>
            <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 16px 0', color: '#0f172a', letterSpacing: '-0.5px' }}>Variation Detected</h2>
            <p style={{ margin: '0 0 32px 0', color: '#475569', fontSize: '16px', lineHeight: '1.6', fontWeight: 500 }}>
              {approvalModal.message}
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button onClick={cancelApproval} className="btn-corp" style={{ background: '#fef2f2', color: '#ef4444', border: '2px solid #fecaca', flex: 1, padding: '16px', fontSize: '16px', borderRadius: '12px' }}>
                Reject
              </button>
              <button onClick={confirmApproval} className="btn-corp" style={{ background: 'var(--neon-violet)', color: 'white', border: 'none', flex: 1, padding: '16px', fontSize: '16px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.4)' }}>
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EARLY SEAL WARNING MODAL */}
      {earlySealWarning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card-clean" style={{ background: '#ffffff', padding: '40px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '56px', marginBottom: '20px', animation: 'bounce 2s infinite' }}>⚠️</div>
            <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 16px 0', color: '#0f172a', letterSpacing: '-0.5px' }}>Warning: Incomplete Carton</h2>
            <p style={{ margin: '0 0 32px 0', color: '#475569', fontSize: '16px', lineHeight: '1.6', fontWeight: 500 }}>
              You have only scanned <strong>{progress.reduce((acc, curr) => acc + Number(curr.scanned), 0)}</strong> pairs (Rule requires {progress.reduce((acc, curr) => acc + Number(curr.required), 0)} pairs).<br />Are you sure you want to process and seal this carton early?
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button onClick={() => setEarlySealWarning(false)} className="btn-corp" style={{ background: '#fef2f2', color: '#ef4444', border: '2px solid #fecaca', flex: 1, padding: '16px', fontSize: '16px', borderRadius: '12px' }}>
                Go Back
              </button>
              <button onClick={proceedToSeal} className="btn-corp" style={{ background: '#f59e0b', color: 'white', border: 'none', flex: 1, padding: '16px', fontSize: '16px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.4)' }}>
                Yes, Seal Early
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ background: 'var(--neon-violet)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, letterSpacing: '1px' }}>SESSION #{sessionId}</span>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>Scan Outward</h1>
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: '16px', fontWeight: 500 }}>
            Article: <span style={{ color: '#0f172a', fontWeight: 800 }}>{session.article_code}</span> &nbsp;•&nbsp;
            Colour: <span style={{ color: '#0f172a', fontWeight: 800 }}>{session.colour}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canSeal && (
            <button
              onClick={handleManualSealClick}
              className="btn-corp"
              style={{ background: '#10b981', color: 'white', border: 'none', padding: '14px 24px', fontSize: '15px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}
            >
              📦 Finalize & Seal Carton
            </button>
          )}
          <button
            onClick={handleCancelSession}
            className="btn-corp"
            style={{ background: '#ffffff', color: '#ef4444', border: '2px solid #fecaca', padding: '14px 24px', fontSize: '15px', borderRadius: '12px' }}
          >
            Cancel Session
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>

        {/* LEFT PANEL: CONFIG REQUIREMENTS GRID */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Packaging Requirements</h2>
            <div style={{ background: '#f1f5f9', padding: '8px 16px', borderRadius: '20px', fontWeight: 800, color: 'var(--neon-violet)', fontSize: '15px' }}>
              Total Progress: {totalScanned} / {totalRequired} Pairs
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
            {progress.map(row => {
              const req = Number(row.required);
              const scan = Number(row.scanned);
              const rem = Number(row.remaining);
              const isCustom = req === 0;
              const isComplete = rem === 0 && !isCustom;
              const isOver = scan > req && !isCustom;

              let cardBg = '#ffffff';
              let borderColor = '#e2e8f0';
              let accentColor = '#3b82f6'; // default blue

              if (isCustom) {
                cardBg = '#fdf4ff';
                borderColor = '#e879f9';
                accentColor = '#a855f7'; // purple for custom
              } else if (isComplete) {
                cardBg = '#f0fdf4';
                borderColor = '#bbf7d0';
                accentColor = '#22c55e'; // green
              } else if (isOver) {
                cardBg = '#fffbeb';
                borderColor = '#fde68a';
                accentColor = '#f59e0b'; // amber
              } else if (scan > 0) {
                cardBg = '#f8fafc';
                borderColor = '#cbd5e1';
                accentColor = 'var(--neon-violet)';
              }

              return (
                <div key={row.size} style={{
                  background: cardBg,
                  border: `2px solid ${borderColor}`,
                  borderRadius: '20px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                    {isCustom ? <span style={{ color: '#a855f7', fontWeight: 800 }}>⚡ CUSTOM SIZE</span> : 'SIZE'}
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', lineHeight: '1', marginBottom: '16px' }}>
                    {row.size}
                  </div>

                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginBottom: '16px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      background: accentColor,
                      width: req > 0 ? `${Math.min(100, (scan / req) * 100)}%` : '100%',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '14px', fontWeight: 700 }}>
                    <div style={{ color: '#64748b' }}>Scanned</div>
                    <div style={{ color: accentColor, fontSize: '16px', fontWeight: 900 }}>
                      {scan} {isCustom ? <span style={{ color: '#a855f7', fontSize: '12px' }}>Custom</span> : <span style={{ color: '#94a3b8', fontSize: '12px' }}>/ {req}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL: SCAN INPUT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card-clean" style={{ padding: '32px', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)', border: '1px solid #f1f5f9' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>Live Scanning Engine</h2>
            <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '14px', fontWeight: 500 }}>
              Scan the article barcode to seamlessly deduct from the inventory pool and pack into this carton.
            </p>

            <form onSubmit={handleScan} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder='Scan barcode (e.g. 2222|GREEN|5|499.00)'
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                autoFocus
                autoComplete="off"
                className="corporate-input"
                style={{
                  width: '100%',
                  fontSize: '18px',
                  padding: '20px 24px',
                  fontWeight: 700,
                  border: '2px solid #cbd5e1',
                  borderRadius: '16px',
                  backgroundColor: '#f8fafc',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
                  boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--neon-violet)';
                  e.target.style.boxShadow = '0 0 0 4px rgba(124, 58, 237, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)';
                }}
              />
              <button
                type="submit"
                className="btn-corp"
                disabled={!barcode.trim()}
                style={{
                  background: 'var(--neon-violet)',
                  color: 'white',
                  border: 'none',
                  padding: '18px',
                  fontSize: '18px',
                  fontWeight: 800,
                  borderRadius: '16px',
                  boxShadow: '0 10px 15px -3px rgba(124, 58, 237, 0.3)',
                  opacity: !barcode.trim() ? 0.7 : 1,
                  cursor: !barcode.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Process Scan
              </button>
            </form>

            {/* SCAN RESULT FEEDBACK */}
            <div style={{
              background: scanResult?.success ? '#f0fdf4' : scanResult?.isDuplicate ? '#fffbeb' : scanResult ? '#fef2f2' : '#f8fafc',
              border: `2px dashed ${scanResult?.success ? '#86efac' : scanResult?.isDuplicate ? '#fcd34d' : scanResult ? '#fca5a5' : '#cbd5e1'}`,
              borderRadius: '20px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px',
              transition: 'all 0.3s ease'
            }}>
              {!scanResult ? (
                <>
                  <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📠</div>
                  <div style={{ color: '#64748b', fontSize: '16px', fontWeight: 600 }}>Waiting for next scan...</div>
                </>
              ) : scanResult.success ? (
                <>
                  <div style={{ fontSize: '56px', marginBottom: '16px', animation: 'scale-up 0.3s ease' }}>✅</div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', color: '#16a34a', fontWeight: 900 }}>Scan Successful</h3>
                  <p style={{ margin: 0, fontWeight: 600, color: '#15803d', fontSize: '15px' }}>{scanResult.message}</p>
                </>
              ) : scanResult.isDuplicate ? (
                <>
                  <div style={{ fontSize: '56px', marginBottom: '16px' }}>⚠️</div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', color: '#d97706', fontWeight: 900 }}>Duplicate Scan Blocked</h3>
                  <p style={{ margin: 0, fontWeight: 600, color: '#92400e', fontSize: '15px', textAlign: 'center' }}>{scanResult.message}</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '56px', marginBottom: '16px', animation: 'shake 0.4s ease' }}>❌</div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', color: '#dc2626', fontWeight: 900 }}>Scan Rejected</h3>
                  <p style={{ margin: 0, fontWeight: 600, color: '#b91c1c', fontSize: '15px', textAlign: 'center' }}>{scanResult.message}</p>
                </>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// MASTER CARTON STICKER COMPONENT
// ==========================================

function getAggregatedSizes(progress: any[]) {
  const activeSizes = progress.filter(p => p.scanned > 0).map(p => parseInt(p.size)).sort((a, b) => a - b);
  if (activeSizes.length === 0) return 'N/A';

  let isConsecutive = true;
  for (let i = 1; i < activeSizes.length; i++) {
    if (activeSizes[i] !== activeSizes[i - 1] + 1) {
      isConsecutive = false;
      break;
    }
  }

  if (isConsecutive && activeSizes.length > 1) {
    return `${activeSizes[0]}x${activeSizes[activeSizes.length - 1]}`;
  } else {
    return activeSizes.join(', ');
  }
}

function MasterCartonSticker({ cartonData, onClose, onCancel }: { cartonData: any, onClose: () => void, onCancel?: () => void }) {
  const { article, colour, mrp, progress, carton } = cartonData;
  const activeSizes = progress.filter((p: any) => p.scanned > 0).sort((a: any, b: any) => parseInt(a.size) - parseInt(b.size));
  const aggregatedSizeStr = getAggregatedSizes(progress);
  const totalPairs = activeSizes.reduce((acc: number, curr: any) => acc + Number(curr.scanned), 0);

  const barcodeValue = carton || '';

  const isJokot = article && article.toUpperCase().startsWith('J');

  // State for editable month/year
  const defaultMonthYear = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase().replace(' ', ' ');
  const [mfgMonth, setMfgMonth] = useState(defaultMonthYear);

  const [printWidth, setPrintWidth] = useState<number>(10);
  const [printHeight, setPrintHeight] = useState<number>(10);
  const [printUnit, setPrintUnit] = useState<string>('cm');

  const dimensionStr = `${printWidth}${printUnit} ${printHeight}${printUnit}`;
  const widthStr = `${printWidth}${printUnit}`;
  const heightStr = `${printHeight}${printUnit}`;

  // Design Style Toggle
  const [designStyle, setDesignStyle] = useState<'1' | '2'>('1');

  return (
    <div style={{ background: '#e2e8f0', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }} className="print-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800;900&family=Barlow+Condensed:wght@600;700;800;900&display=swap');

        @page {
          size: ${dimensionStr};
          margin: 0 !important;
        }

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
          .sticker {
            box-shadow: none !important;
            border: 2px solid #000 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .jokot-sticker {
            border: 2px solid #000 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
        }

        .sticker {
          width: ${widthStr};
          height: ${heightStr};
          max-width: 100%;
          background: #ffffff;
          border: 2px solid #000;
          font-family: 'Barlow', sans-serif;
          overflow: hidden;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }

        /* LUNAR STYLES */
        .info-row { display: flex; align-items: stretch; border-bottom: 1.5px solid #000; flex: 1; }
        .info-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #000; background: #fff; padding: 4px 8px; min-width: 60px; display: flex; align-items: center; border-right: 1.5px solid #000; }
        .info-value { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 900; color: #000; padding: 4px 8px; display: flex; align-items: center; letter-spacing: 1px; flex: 1; }
        .info-value.art { font-size: 24px; font-weight: 900; letter-spacing: 1px; }
        .info-value.mrp-val { font-size: 20px; font-weight: 900; }
        .info-value.mrp-val .rupee { font-size: 16px; margin-right: 2px; font-weight: 800; color: #000; }
        .info-value.size-roman { font-family: Georgia, 'Times New Roman', Times, serif; font-size: 32px; font-weight: 900; letter-spacing: 2px; color: #000; }
        .size-section { border-bottom: 1.5px solid #000; }
        .size-col-header { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #000; background: #fff; padding: 4px 0; text-align: center; border-right: 1.5px solid #000; }
        .size-col-header:first-child { text-align: left; padding-left: 8px; min-width: 60px; }
        .size-col-header.total-col { background: #fff; color: #000; border-right: none; font-size: 10px; min-width: 45px;}
        .size-cell { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 900; color: #000; text-align: center; padding: 4px 0; border-right: 1.5px solid #000; }
        .size-cell.label-cell { font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #000; background: #fff; text-align: left; padding-left: 8px; }
        .size-cell.total-cell { font-size: 20px; font-weight: 900; color: #000; background: #fff; border-right: none; min-width: 45px;}
        .packages-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-bottom: 1.5px solid #000; }
        .packages-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #000; }
        .packages-value { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 900; color: #000; letter-spacing: 1px; }
        .packages-value span { font-size: 10px; font-weight: 800; color: #000; margin-left: 2px; letter-spacing: 1px; text-transform: uppercase; }
        .barcode-area { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; flex: 1; }

        /* JOKOT STYLES - layout handled inline */
        .jokot-sticker {
          overflow: hidden;
          box-sizing: border-box;
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
              ← Back
            </button>
            {onCancel && (
              <button onClick={onCancel} className="btn-corp" style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', padding: '8px 16px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} onMouseOver={e => e.currentTarget.style.background = '#ffe4e6'} onMouseOut={e => e.currentTarget.style.background = '#fff1f2'}>
                ✕ Cancel Carton
              </button>
            )}
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
              <input type="radio" name="designStyle" value="1" checked={designStyle === '1'} onChange={() => setDesignStyle('1')} style={{ accentColor: '#3b82f6', width: '16px', height: '16px', cursor: 'pointer' }} />
              1. Vertical Grid (Default)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: designStyle === '2' ? 800 : 600, color: designStyle === '2' ? '#0f172a' : '#64748b' }}>
              <input type="radio" name="designStyle" value="2" checked={designStyle === '2'} onChange={() => setDesignStyle('2')} style={{ accentColor: '#3b82f6', width: '16px', height: '16px', cursor: 'pointer' }} />
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
        {isJokot ? (
          <div className="jokot-sticker" style={{
            display: 'grid',
            gridTemplateRows: designStyle === '2' ? '2.5fr 1fr 1fr 2fr 1.5fr' : '1.2fr 1fr 1fr 1fr 1fr 1fr 2fr 1.5fr',
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
                <div style={{ fontSize: designStyle === '2' ? '11px' : '9px', fontWeight: 900, margin: 0, padding: 0, lineHeight: 1.2 }}>Mktd.By : JOKOT INTERNATIONAL</div>
                <div style={{ fontSize: designStyle === '2' ? '9.5px' : '8px', fontWeight: 800, margin: 0, padding: 0, lineHeight: 1.2 }}>Ph: +91 8867915043, Email: jokot.international@gmail.com</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="sticker">
            {/* Compact header: Article + Master Carton badge */}
            <div style={{ background: '#fff', color: '#000', borderBottom: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px' }}>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 900, letterSpacing: '2px' }}>{article}</span>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '9px', fontWeight: 800, letterSpacing: '1px', background: '#fff', color: '#000', padding: '2px 6px', borderRadius: '2px', border: '1px solid #000', textTransform: 'uppercase' }}>Master Carton</span>
            </div>

            <div className="sticker-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="info-row">
                <div className="info-label">Colour</div>
                <div className="info-value" style={{ fontSize: '18px' }}>{colour}</div>
              </div>

              <div className="info-row">
                <div className="info-label">Size</div>
                <div className="info-value size-roman">{aggregatedSizeStr.replace('x', ' × ')}</div>
              </div>

              {mrp && (
                <div className="info-row">
                  <div className="info-label">MRP</div>
                  <div className="info-value mrp-val"><span className="rupee">₹</span>{parseFloat(mrp).toFixed(2)}</div>
                </div>
              )}

              <div className="size-section">
                <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${activeSizes.length}, 1fr) 45px`, borderBottom: '1px solid #000' }}>
                  <div className="size-col-header" style={{ textAlign: 'left', paddingLeft: '8px' }}>Size</div>
                  {activeSizes.map((s: any) => <div key={s.size} className="size-col-header">{s.size}</div>)}
                  <div className="size-col-header total-col">Total</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${activeSizes.length}, 1fr) 45px` }}>
                  <div className="size-cell label-cell">Qty(pr)</div>
                  {activeSizes.map((s: any) => <div key={s.size} className="size-cell">{s.scanned}</div>)}
                  <div className="size-cell total-cell">{totalPairs}</div>
                </div>
              </div>

              <div className="packages-row">
                <div className="packages-label">No. of Packages</div>
                <div className="packages-value">{totalPairs} <span>Pairs</span></div>
              </div>

              {/* Barcode only — no branding text */}
              <div className="barcode-area">
                <Barcode value={barcodeValue} format="CODE128" width={1.8} height={30} displayValue={false} margin={0} background="#ffffff" />
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
