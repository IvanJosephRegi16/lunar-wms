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
  status: 'success' | 'error';
  message?: string;
}

export default function ScanningIntakePage() {
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input continuously so scanner always works
  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 1000);
    return () => clearInterval(focusInterval);
  }, []);

  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const barcode = e.currentTarget.value.trim();
      e.currentTarget.value = ''; // clear instantly
      if (!barcode) return;
      await processScan(barcode);
    }
  };

  const processScan = async (barcode: string) => {
    setIsProcessing(true);
    
    try {
      const res = await fetch('/api/packing/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode })
      });
      const data = await res.json();

      if (!res.ok) {
        addScan(barcode, 'error', data.error);
      } else {
        addScan(barcode, 'success', data.message || 'Stock Added to Inventory', data.product);
        setSessionCount(prev => prev + 1);
      }
    } catch (err: any) {
      addScan(barcode, 'error', err.message || 'Network error');
    } finally {
      setIsProcessing(false);
    }
  };

  const addScan = (barcode: string, status: 'success' | 'error', message: string, parsed?: any) => {
    setScans(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
      barcode,
      article: parsed?.article || '-',
      colour: parsed?.colour || '-',
      size: parsed?.size || '-',
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

      <div className={styles.scannerInputWrapper}>
        <span className={styles.scannerIcon}>⚡</span>
        <input 
          ref={inputRef}
          type="text" 
          placeholder="Awaiting scanner input..." 
          onKeyDown={handleScan}
          disabled={isProcessing}
          className={styles.scannerInput}
          autoFocus
        />
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {scans.map(scan => (
                <tr key={scan.id} className={scan.status === 'error' ? styles.rowError : styles.rowSuccess}>
                  <td>{scan.time}</td>
                  <td>{scan.barcode}</td>
                  <td>{scan.article}</td>
                  <td>{scan.colour}</td>
                  <td>{scan.size}</td>
                  <td>
                    <span className={scan.status === 'error' ? styles.badgeError : styles.badgeSuccess}>
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
