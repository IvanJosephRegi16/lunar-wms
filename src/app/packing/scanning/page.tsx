'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

interface ScanResult {
  id: string;
  time: string;
  barcode: string;
  article: string;
  colour: string;
  size: string;
  mrp?: number | null;
  status: 'success' | 'warning' | 'error';
  message?: string;
}

interface PendingApproval {
  barcode: string;
  article: string;
  colour: string;
  size: string;
}

export default function ScanningIntakePage() {
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [approving, setApproving] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input continuously with a tighter interval for fast barcode scanners
  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 250); // 250ms ensures near‑instant refocus without CPU thrash
    return () => clearInterval(focusInterval);
  }, []);

  // Web Audio API generator for high-fidelity auditory feedback
  const playSound = (type: 'success' | 'warning') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'success') {
        // High, clean beep (A5 note)
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else {
        // Low, raspy warning buzz (130Hz sawtooth)
        osc.frequency.setValueAtTime(130, ctx.currentTime);
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('Audio feedback error:', e);
    }
  };

  // Advanced keyboard hotkeys for power operators
  useEffect(() => {
    const handleHotkeys = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setScans([]);
        setSessionCount(0);
      } else if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleHotkeys);
    return () => window.removeEventListener('keydown', handleHotkeys);
  }, []);

  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const barcode = e.currentTarget.value.trim();
      e.currentTarget.value = '';
      if (!barcode) return;

      await processScan(barcode);
    }
  };

  const processScan = async (barcode: string) => {
    setIsProcessing(true);
    
    // Check if barcode has already been scanned in this session
    const isDuplicate = scans.some(s => s.barcode === barcode && s.status !== 'error');

    try {
      const res = await fetch('/api/packing/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode })
      });
      const data = await res.json();

      if (!res.ok) {
        addScan(barcode, 'error', data.error || 'API scan error');
        playSound('warning');
      } else {
        if (isDuplicate) {
          addScan(barcode, 'warning', 'Repeated Scan in Session', data.product);
          playSound('warning');
        } else if (data.product?.mrp === null || data.product?.mrp === undefined) {
          // MRP missing — hold for manual approval
          playSound('warning');
          setPendingApproval({ barcode, article: data.product?.article || '-', colour: data.product?.colour || '-', size: data.product?.size || '-' });
        } else {
          addScan(barcode, 'success', data.message || 'Stock Added to Inventory', data.product);
          playSound('success');
        }
        setSessionCount(prev => prev + 1);
      }
    } catch (err: any) {
      addScan(barcode, 'error', err.message || 'Network error');
      playSound('warning');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = () => {
    if (!pendingApproval) return;
    // Record already inserted by API — just accept it with a warning status (no MRP)
    addScan(pendingApproval.barcode, 'warning', 'Approved — No MRP', pendingApproval);
    setPendingApproval(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleReject = async () => {
    if (!pendingApproval) return;
    setApproving(true);
    try {
      await fetch('/api/packing/scan', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: pendingApproval.barcode })
      });
      addScan(pendingApproval.barcode, 'error', 'Rejected — No MRP. Record Blocked.', pendingApproval);
      playSound('warning');
    } catch {
      addScan(pendingApproval.barcode, 'error', 'Rejected (rollback failed — check manually)', pendingApproval);
    } finally {
      setApproving(false);
      setPendingApproval(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const addScan = (barcode: string, status: 'success' | 'warning' | 'error', message: string, parsed?: any) => {
    setScans(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
      barcode,
      article: parsed?.article || '-',
      colour: parsed?.colour || '-',
      size: parsed?.size || '-',
      mrp: parsed?.mrp || null,
      status,
      message
    }, ...prev]);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Scanning Intake Engine</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-ghost)', fontSize: '14px' }}>Continuous Barcode Pool Intake Layer</p>
        </div>
        <div className={styles.sessionCounter}>
          <span>Session Scans:</span>
          <strong>{sessionCount}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className={styles.scannerInputWrapper}>
          <span className={styles.scannerIcon}>{pendingApproval ? '⚠️' : '⚡'}</span>
          <input 
            ref={inputRef}
            type="text" 
            placeholder={pendingApproval ? 'Scanning paused — resolve warning above...' : 'Awaiting scanner input...'}
            onKeyDown={handleScan}
            disabled={!!pendingApproval || isProcessing}
            className={styles.scannerInput}
            autoFocus
            style={pendingApproval ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          />
        </div>
        <div className={styles.hotkeysInfo}>
          <span><span className={styles.hotkey}>Alt + R</span> Force Refocus</span>
          <span><span className={styles.hotkey}>Alt + C</span> Clear Session Logs</span>
        </div>
      </div>

      {/* ─── MRP Warning Modal ─── */}
      {pendingApproval && (
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
          border: '2px solid #f59e0b',
          borderRadius: '16px',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
          boxShadow: '0 8px 24px rgba(245, 158, 11, 0.2)',
          animation: 'pulse-warn 1s ease-in-out'
        }}>
          <div style={{ fontSize: '32px', lineHeight: 1 }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: '15px', color: '#92400e', marginBottom: '6px' }}>
              MRP Not Found in Barcode
            </div>
            <div style={{ fontSize: '13px', color: '#78350f', marginBottom: '12px', lineHeight: 1.5 }}>
              The barcode <strong style={{ fontFamily: 'monospace' }}>{pendingApproval.barcode}</strong> was scanned for <strong>{pendingApproval.article}</strong> / {pendingApproval.colour} / Size {pendingApproval.size},
              but no MRP was detected. Please verify the item physically.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleApprove}
                disabled={approving}
                style={{
                  background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: 'white',
                  border: 'none', padding: '10px 22px', borderRadius: '10px',
                  fontWeight: 800, fontSize: '13px', cursor: approving ? 'wait' : 'pointer',
                  boxShadow: '0 4px 10px rgba(34, 197, 94, 0.3)'
                }}
              >
                ✅ Approve — Accept Without MRP
              </button>
              <button
                onClick={handleReject}
                disabled={approving}
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #ef4444)', color: 'white',
                  border: 'none', padding: '10px 22px', borderRadius: '10px',
                  fontWeight: 800, fontSize: '13px', cursor: approving ? 'wait' : 'pointer',
                  boxShadow: '0 4px 10px rgba(220, 38, 38, 0.3)'
                }}
              >
                ❌ Reject — Block This Scan
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.tableSection}>
        <div className={styles.sectionTitle}>Live Aggregation Intake Stream</div>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Barcode</th>
                <th>Article</th>
                <th>Colour</th>
                <th>Size</th>
                <th>Price (MRP)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {scans.map(scan => (
                <tr 
                  key={scan.id} 
                  className={
                    scan.status === 'error' 
                      ? styles.rowError 
                      : scan.status === 'warning'
                      ? styles.rowWarning
                      : styles.rowSuccess
                  }
                >
                  <td>{scan.time}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{scan.barcode}</td>
                  <td>{scan.article}</td>
                  <td>{scan.colour}</td>
                  <td>{scan.size}</td>
                  <td style={{ fontWeight: 800 }}>{scan.mrp ? `₹${scan.mrp}` : '-'}</td>
                  <td>
                    <span className={
                      scan.status === 'error' 
                        ? styles.badgeError 
                        : scan.status === 'warning'
                        ? styles.badgeWarning
                        : styles.badgeSuccess
                    }>
                      {scan.message || scan.status}
                    </span>
                  </td>
                </tr>
              ))}
              {scans.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '16px' }}>
                    System ready. Start scanning items to stage them into the warehouse pool.
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

