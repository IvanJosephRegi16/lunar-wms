'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VerificationPage() {
  const router = useRouter();
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/packing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: barcode.trim() })
      });
      const data = await res.json();

      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to verify barcode');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
      setBarcode('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fade-up" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>Barcode Verification</h1>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '15px' }}>
            Scan a barcode to check its intake and outward scanning status.
          </p>
        </div>
        <button 
          onClick={() => router.push('/packing/scan-outward')} 
          className="btn-corp" 
          style={{ background: '#f1f5f9', color: '#475569', border: 'none' }}
        >
          Back to Outward
        </button>
      </div>

      <div className="card-clean" style={{ padding: '32px', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)' }}>
        <form onSubmit={handleScan} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
          <input 
            ref={inputRef}
            type="text" 
            placeholder='Scan barcode here...'
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            disabled={loading}
            className="corporate-input"
            style={{ 
              width: '100%', 
              fontSize: '18px', 
              padding: '20px 24px', 
              fontWeight: 700, 
              border: '2px solid #cbd5e1',
              borderRadius: '16px',
              backgroundColor: '#f8fafc',
            }}
          />
          <button 
            type="submit" 
            className="btn-corp" 
            disabled={!barcode.trim() || loading}
            style={{ 
              background: 'var(--neon-violet)', 
              color: 'white', 
              border: 'none', 
              padding: '18px', 
              fontSize: '18px', 
              fontWeight: 800,
              borderRadius: '16px',
              opacity: (!barcode.trim() || loading) ? 0.7 : 1,
            }}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        {error && (
          <div style={{ padding: '20px', background: '#fef2f2', border: '2px solid #fecaca', borderRadius: '16px', color: '#dc2626', fontWeight: 600 }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 800 }}>Verification Result</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ 
                padding: '24px', 
                borderRadius: '16px', 
                border: result.isIntakeScanned ? '2px solid #86efac' : '2px solid #fca5a5',
                background: result.isIntakeScanned ? '#f0fdf4' : '#fef2f2'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{result.isIntakeScanned ? '✅' : '❌'}</div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', color: result.isIntakeScanned ? '#16a34a' : '#dc2626' }}>Intake Status</h4>
                <p style={{ margin: 0, color: result.isIntakeScanned ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                  {result.isIntakeScanned ? 'Successfully scanned in Intake' : 'Not found in Intake'}
                </p>
                {result.intakeData && (
                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>
                    Scanned on: {new Date(result.intakeData.created_at).toLocaleString()}
                  </div>
                )}
              </div>

              <div style={{ 
                padding: '24px', 
                borderRadius: '16px', 
                border: result.isOutwardScanned ? '2px solid #fcd34d' : '2px solid #cbd5e1',
                background: result.isOutwardScanned ? '#fffbeb' : '#f8fafc'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{result.isOutwardScanned ? '📦' : '⏳'}</div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', color: result.isOutwardScanned ? '#d97706' : '#64748b' }}>Outward Status</h4>
                <p style={{ margin: 0, color: result.isOutwardScanned ? '#b45309' : '#475569', fontWeight: 600 }}>
                  {result.isOutwardScanned ? 'Already scanned Outward' : 'Pending Outward scan'}
                </p>
                {result.outwardData && (
                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>
                    Scanned on: {new Date(result.outwardData.created_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '16px', padding: '16px', background: '#f1f5f9', borderRadius: '12px', fontSize: '14px', color: '#475569' }}>
              <strong>Barcode Scanned:</strong> {result.barcode}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
