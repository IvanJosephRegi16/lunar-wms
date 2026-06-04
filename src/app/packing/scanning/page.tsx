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

export default function ScanningIntakePage() {
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  
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
          <span className={styles.scannerIcon}>⚡</span>
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Awaiting scanner input..."
            onKeyDown={handleScan}
            disabled={false}
            className={styles.scannerInput}
            autoFocus
          />
        </div>
        <div className={styles.hotkeysInfo}>
          <span><span className={styles.hotkey}>Alt + R</span> Force Refocus</span>
          <span><span className={styles.hotkey}>Alt + C</span> Clear Session Logs</span>
        </div>
      </div>

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

