'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ScanOutwardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [session, setSession] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [barcode, setBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionId) {
      alert('No session ID provided');
      router.push('/carton-generation');
      return;
    }
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

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim() || isScanning) return;

    setIsScanning(true);
    const scannedCode = barcode.trim();
    setBarcode(''); // clear immediately

    try {
      const res = await fetch('/api/packing/outward/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, barcode: scannedCode })
      });
      const data = await res.json();
      
      if (res.ok) {
        setScanResult({ success: true, message: data.message, data: data.article });
        
        // Refresh grid
        await fetchSessionData();

        if (data.isComplete) {
          alert(`Carton ${data.sealedCarton || 'Sealed'} and added to Packed Inventory!`);
          router.push('/packed-inventory');
        }
      } else {
        setScanResult({ success: false, message: data.error });
      }
    } catch (err: any) {
      setScanResult({ success: false, message: err.message || 'Error scanning barcode' });
    } finally {
      setIsScanning(false);
      barcodeInputRef.current?.focus();
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

  return (
    <div className="fade-up" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Scan Outward Session</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-ghost)', fontSize: '14px' }}>
            Session ID: {sessionId} • Article: <strong>{session.article_code}</strong> • Colour: <strong>{session.colour}</strong>
          </p>
        </div>
        <button 
          onClick={handleCancelSession}
          className="btn-corp"
          style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}
        >
          ❌ Cancel Session & Rollback
        </button>
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
