'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
          <button onClick={exportCSV} className="btn-corp" style={{ background: '#10b981', color: 'white', border: 'none' }}>
            📊 Export CSV
          </button>
          <button onClick={() => router.push('/carton-generation')} className="btn-corp" style={{ background: 'var(--neon-violet)', color: 'white', border: 'none' }}>
            ➕ New Scan Session
          </button>
        </div>
      </div>

      <div className="card-clean" style={{ padding: '24px', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-ghost)' }}>Loading history...</div>
        ) : (
          <table className="corporate-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Session ID</th>
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
                  <td><strong>#{session.session_id}</strong></td>
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
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  
  // Custom Approval Modal State
  const [approvalModal, setApprovalModal] = useState<{ isOpen: boolean; message: string; pendingBarcode: string } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetchSessionData();
  }, [sessionId]);

  // Keep input focused for scanner
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  });

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

  const handleScan = async (e?: React.FormEvent, force: boolean = false, overrideBarcode?: string) => {
    if (e) e.preventDefault();
    const codeToScan = overrideBarcode || barcode.trim();
    if (!codeToScan || isScanning) return;

    setIsScanning(true);
    if (!overrideBarcode) setBarcode(''); // clear immediately if not forced

    try {
      const res = await fetch('/api/packing/outward/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, barcode: codeToScan, force })
      });
      const data = await res.json();
      
      if (res.status === 200 && data.requireApproval) {
        // Show our professional custom modal
        setApprovalModal({
          isOpen: true,
          message: data.message,
          pendingBarcode: codeToScan
        });
        setScanResult(null);
      } else if (res.ok) {
        setScanResult({ success: true, message: data.message, data: data.article });
        
        // Refresh grid
        await fetchSessionData();
      } else {
        setScanResult({ success: false, message: data.error });
      }
    } catch (err: any) {
      setScanResult({ success: false, message: err.message || 'Error scanning barcode' });
    } finally {
      setIsScanning(false);
      if (!approvalModal?.isOpen) {
        barcodeInputRef.current?.focus();
      }
    }
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

  const handleManualSeal = async () => {
    if (!confirm('Seal carton now?')) return;
    try {
      const res = await fetch(`/api/packing/outward/session/seal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Carton ${data.carton || 'Sealed'} and added to Packed Inventory!`);
        router.push('/packed-inventory');
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

  const totalRequired = progress.reduce((acc, curr) => acc + curr.required, 0);
  const totalScanned = progress.reduce((acc, curr) => acc + curr.scanned, 0);
  const canSeal = progress.length > 0 && progress.every(p => p.scanned >= p.required - 1);

  return (
    <div className="fade-up" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      
      {/* PROFESSIONAL APPROVAL MODAL */}
      {approvalModal?.isOpen && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card-clean" style={{ background: 'white', padding: '32px', maxWidth: '400px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 12px 0', color: '#1e293b' }}>Variation Detected</h2>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-ghost)', fontSize: '15px', lineHeight: '1.5' }}>
              {approvalModal.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={cancelApproval} className="btn-corp" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', flex: 1 }}>
                Reject
              </button>
              <button onClick={confirmApproval} className="btn-corp" style={{ background: 'var(--neon-violet)', color: 'white', border: 'none', flex: 1 }}>
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Scan Outward Session</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-ghost)', fontSize: '14px' }}>
            Session ID: {sessionId} • Article: <strong>{session.article_code}</strong> • Colour: <strong>{session.colour}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canSeal && (
            <button 
              onClick={handleManualSeal}
              className="btn-corp"
              style={{ background: '#10b981', color: 'white', border: 'none', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}
            >
              📦 Seal Carton
            </button>
          )}
          <button 
            onClick={handleCancelSession}
            className="btn-corp"
            style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}
          >
            ❌ Cancel Session & Rollback
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* LEFT PANEL: CONFIG REQUIREMENTS GRID */}
        <div className="card-clean" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>Config Requirements</span>
            <span style={{ color: 'var(--neon-violet)' }}>{totalScanned} / {totalRequired} Pairs</span>
          </h2>
          
          <table className="corporate-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Size</th>
                <th style={{ textAlign: 'center' }}>Required</th>
                <th style={{ textAlign: 'center' }}>Scanned</th>
                <th style={{ textAlign: 'center' }}>Remaining</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {progress.map(row => {
                const isComplete = row.remaining === 0;
                return (
                  <tr key={row.size} style={{ background: isComplete ? '#f0fdf4' : 'transparent' }}>
                    <td style={{ fontWeight: 800, fontSize: '14px' }}>{row.size}</td>
                    <td style={{ textAlign: 'center' }}>{row.required}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: isComplete ? '#16a34a' : 'var(--text-main)' }}>{row.scanned}</td>
                    <td style={{ textAlign: 'center', color: isComplete ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{row.remaining}</td>
                    <td style={{ textAlign: 'center' }}>
                      {isComplete ? '✅' : '⏳'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* RIGHT PANEL: SCAN INPUT */}
        <div className="card-clean" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0' }}>Barcode Scanner Input</h2>
          
          <form onSubmit={handleScan} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <input 
              ref={barcodeInputRef}
              type="text" 
              placeholder="Scan barcode here..." 
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              disabled={isScanning}
              autoFocus
              className="corporate-input"
              style={{ flex: 1, fontSize: '18px', padding: '16px', fontWeight: 800, border: '2px solid var(--neon-violet)' }}
            />
            <button 
              type="submit" 
              className="btn-corp" 
              disabled={isScanning || !barcode.trim()}
              style={{ background: 'var(--neon-violet)', color: 'white', border: 'none', padding: '0 30px', fontSize: '16px', fontWeight: 800 }}
            >
              {isScanning ? 'Processing...' : 'Scan'}
            </button>
          </form>

          {/* SCAN RESULT FEEDBACK */}
          <div style={{ flex: 1, background: '#f8fafc', borderRadius: '12px', padding: '20px', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {!scanResult ? (
              <div style={{ textAlign: 'center', color: 'var(--text-ghost)', fontSize: '14px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📠</div>
                Waiting for scan...
              </div>
            ) : scanResult.success ? (
              <div style={{ textAlign: 'center', color: '#16a34a' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Success!</h3>
                <p style={{ margin: 0, fontWeight: 700 }}>{scanResult.message}</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#ef4444' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>❌</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Scan Rejected</h3>
                <p style={{ margin: 0, fontWeight: 700 }}>{scanResult.message}</p>
              </div>
            )}
          </div>
          
        </div>

      </div>
    </div>
  );
}
