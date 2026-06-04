'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Barcode from 'react-barcode';

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

  // Sticker & MRP State
  const [mrpPopup, setMrpPopup] = useState(false);
  const [enteredMrp, setEnteredMrp] = useState('');
  const [sealedCartonData, setSealedCartonData] = useState<any>(null);

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

  const handleManualSealClick = () => {
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

  const totalRequired = progress.reduce((acc, curr) => acc + curr.required, 0);
  const totalScanned = progress.reduce((acc, curr) => acc + curr.scanned, 0);
  const canSeal = progress.length > 0 && progress.every(p => p.scanned >= p.required - 1);

  if (sealedCartonData) {
    return <MasterCartonSticker cartonData={sealedCartonData} onClose={() => router.push('/packed-inventory')} />;
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
              Enter the MRP for this Master Carton. Skip to hide MRP from the sticker.
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
              const isComplete = row.remaining === 0;
              const isOver = row.scanned > row.required;
              
              let cardBg = '#ffffff';
              let borderColor = '#e2e8f0';
              let accentColor = '#3b82f6'; // default blue

              if (isComplete) {
                cardBg = '#f0fdf4';
                borderColor = '#bbf7d0';
                accentColor = '#22c55e'; // green
              } else if (isOver) {
                cardBg = '#fffbeb';
                borderColor = '#fde68a';
                accentColor = '#f59e0b'; // amber
              } else if (row.scanned > 0) {
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
                    SIZE
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', lineHeight: '1', marginBottom: '16px' }}>
                    {row.size}
                  </div>
                  
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginBottom: '16px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      background: accentColor, 
                      width: `${Math.min(100, (row.scanned / row.required) * 100)}%`,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '14px', fontWeight: 700 }}>
                    <div style={{ color: '#64748b' }}>Scanned</div>
                    <div style={{ color: accentColor, fontSize: '16px', fontWeight: 900 }}>{row.scanned} <span style={{ color: '#94a3b8', fontSize: '12px' }}>/ {row.required}</span></div>
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
                placeholder="Scan barcode (e.g. 2222|GREEN|5|499.00)" 
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                disabled={isScanning}
                autoFocus
                className="corporate-input"
                style={{ 
                  width: '100%', 
                  fontSize: '18px', 
                  padding: '20px 24px', 
                  fontWeight: 700, 
                  border: '2px solid #cbd5e1',
                  borderRadius: '16px',
                  backgroundColor: '#f8fafc',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
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
                disabled={isScanning || !barcode.trim()}
                style={{ 
                  background: 'var(--neon-violet)', 
                  color: 'white', 
                  border: 'none', 
                  padding: '18px', 
                  fontSize: '18px', 
                  fontWeight: 800,
                  borderRadius: '16px',
                  boxShadow: '0 10px 15px -3px rgba(124, 58, 237, 0.3)',
                  opacity: (isScanning || !barcode.trim()) ? 0.7 : 1,
                  cursor: (isScanning || !barcode.trim()) ? 'not-allowed' : 'pointer'
                }}
              >
                {isScanning ? 'Processing...' : 'Process Scan'}
              </button>
            </form>

            {/* SCAN RESULT FEEDBACK */}
            <div style={{ 
              background: scanResult?.success ? '#f0fdf4' : scanResult ? '#fef2f2' : '#f8fafc',
              border: `2px dashed ${scanResult?.success ? '#86efac' : scanResult ? '#fca5a5' : '#cbd5e1'}`,
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
    if (activeSizes[i] !== activeSizes[i-1] + 1) {
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

function MasterCartonSticker({ cartonData, onClose }: { cartonData: any, onClose: () => void }) {
  const { article, colour, mrp, progress, carton } = cartonData;
  const activeSizes = progress.filter((p: any) => p.scanned > 0).sort((a:any, b:any) => parseInt(a.size) - parseInt(b.size));
  const aggregatedSizeStr = getAggregatedSizes(progress);
  const totalPairs = activeSizes.reduce((acc: number, curr: any) => acc + curr.scanned, 0);

  const barcodeValue = carton || '';

  return (
    <div style={{ background: '#e2e8f0', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }} className="print-wrapper">
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800;900&family=Barlow+Condensed:wght@600;700;800;900&display=swap');

        @media print {
          body * { visibility: hidden; }
          .print-wrapper { background: white !important; padding: 0 !important; }
          .sticker-wrap, .sticker-wrap * { visibility: visible; }
          .sticker-wrap { position: absolute; left: 0; top: 0; padding: 0 !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .sticker { box-shadow: none !important; margin: 0 !important; border: 3px solid #000 !important; }
        }

        .sticker {
          width: 520px;
          background: #ffffff;
          border: 3px solid #000;
          border-radius: 6px;
          font-family: 'Barlow', sans-serif;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.13);
        }
        .sticker-header { background: #000; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 10px 18px; }
        .sticker-header .brand { font-family: 'Barlow Condensed', sans-serif; font-size: 24px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; }
        .sticker-header .badge { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 800; letter-spacing: 2px; background: #fff; color: #000; padding: 3px 10px; border-radius: 2px; text-transform: uppercase; }
        .info-row { display: flex; align-items: stretch; border-bottom: 2px solid #000; }
        .info-label { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #000; background: #fff; padding: 8px 14px; min-width: 90px; display: flex; align-items: center; border-right: 2px solid #000; }
        .info-value { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 900; color: #000; padding: 6px 18px; display: flex; align-items: center; letter-spacing: 1px; flex: 1; }
        .info-value.art { font-size: 36px; font-weight: 900; letter-spacing: 2px; }
        .info-value.mrp-val { font-size: 32px; font-weight: 900; }
        .info-value.mrp-val .rupee { font-size: 26px; margin-right: 3px; font-weight: 800; color: #000; }
        .size-section { border-bottom: 2px solid #000; }
        .size-col-header { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #000; background: #fff; padding: 6px 0; text-align: center; border-right: 2px solid #000; }
        .size-col-header:first-child { text-align: left; padding-left: 14px; border-right: 2px solid #000; min-width: 90px; }
        .size-col-header.total-col { background: #000; color: #fff; border-right: none; font-size: 14px; }
        .size-cell { font-family: 'Barlow Condensed', sans-serif; font-size: 26px; font-weight: 900; color: #000; text-align: center; padding: 10px 0; border-right: 2px solid #000; }
        .size-cell.label-cell { font-size: 14px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #000; background: #fff; text-align: left; padding-left: 14px; border-right: 2px solid #000; }
        .size-cell.total-cell { font-size: 30px; font-weight: 900; color: #fff; background: #000; border-right: none; }
        .packages-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 18px; border-bottom: 2px solid #000; }
        .packages-label { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #000; }
        .packages-value { font-family: 'Barlow Condensed', sans-serif; font-size: 32px; font-weight: 900; color: #000; letter-spacing: 1px; }
        .packages-value span { font-size: 14px; font-weight: 800; color: #000; margin-left: 4px; letter-spacing: 1px; text-transform: uppercase; }
        .bottom-section { display: flex; align-items: stretch; border-bottom: 2px solid #000; }
        .made-india { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 10px 14px; border-right: 2px solid #000; gap: 2px; }
        .made-india .mil { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #000; }
        .made-india .mfg { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; color: #000; text-transform: uppercase; }
        .made-india .fw { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #000; }
        .barcode-area { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 14px; gap: 4px; }
        .sticker-footer { background: #fff; padding: 8px 18px; display: flex; flex-direction: column; gap: 2px; }
        .footer-line { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; color: #000; font-weight: 700; line-height: 1.5; text-transform: uppercase; }
        .footer-line strong { font-weight: 900; color: #000; }
        .assortment-tag { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 900; letter-spacing: 2px; background: #000; color: #fff; padding: 2px 10px; border-radius: 2px; text-transform: uppercase; display: inline-block; margin-bottom: 2px; }
      `}</style>

      <div className="no-print" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button onClick={onClose} className="btn-corp" style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '12px 24px', borderRadius: '8px' }}>
          ← Back to Inventory
        </button>
        <button onClick={() => window.print()} className="btn-corp" style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 800, boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
          🖨️ Print Sticker
        </button>
      </div>

      <div className="sticker-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="sticker">
          <div className="sticker-header">
            <div className="brand">LUNAR WMS</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="assortment-tag">Assortment</div>
              <div className="badge">Master Carton</div>
            </div>
          </div>

          <div className="sticker-body">
            <div className="info-row">
              <div className="info-label">Art No.</div>
              <div className="info-value art">{article}</div>
            </div>

            <div className="info-row">
              <div className="info-label">Colour</div>
              <div className="info-value" style={{ fontSize: '24px' }}>{colour}</div>
            </div>

            <div className="info-row">
              <div className="info-label">Size</div>
              <div className="info-value" style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '3px' }}>{aggregatedSizeStr.replace('x', ' × ')}</div>
            </div>

            {mrp && (
              <div className="info-row">
                <div className="info-label">MRP</div>
                <div className="info-value mrp-val"><span className="rupee">₹</span>{parseFloat(mrp).toFixed(2)}</div>
              </div>
            )}

            <div className="size-section">
              <div style={{ display: 'grid', gridTemplateColumns: `90px repeat(${activeSizes.length}, 1fr) 72px`, borderBottom: '1px solid #ccc' }}>
                <div className="size-col-header" style={{ textAlign: 'left', paddingLeft: '14px' }}>Size</div>
                {activeSizes.map((s: any) => <div key={s.size} className="size-col-header">{s.size}</div>)}
                <div className="size-col-header total-col">Total</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `90px repeat(${activeSizes.length}, 1fr) 72px` }}>
                <div className="size-cell label-cell">Qty (pair)</div>
                {activeSizes.map((s: any) => <div key={s.size} className="size-cell">{s.scanned}</div>)}
                <div className="size-cell total-cell">{totalPairs}</div>
              </div>
            </div>

            <div className="packages-row">
              <div className="packages-label">No. of Packages</div>
              <div className="packages-value">{totalPairs} <span>Pairs</span></div>
            </div>

            <div className="bottom-section">
              <div className="made-india">
                <div className="mil">Made in India</div>
                <div className="mfg">Month of Mfg: {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}</div>
                <div className="fw">Footwear</div>
              </div>
              <div className="barcode-area">
                <Barcode value={barcodeValue} format="CODE128" width={2.2} height={45} displayValue={false} margin={0} background="#ffffff" />
              </div>
            </div>
          </div>

          <div className="sticker-footer">
            <div className="footer-line"><strong>Mfd. &amp; Pkd. By:</strong> Lunar Rubbers Pvt Ltd — Thodupuzha, Kerala</div>
            <div className="footer-line"><strong>Mktd. By:</strong> Lunar Footwear — Customer Care: 1800-123-456</div>
          </div>
        </div>
      </div>

    </div>
  );
}
