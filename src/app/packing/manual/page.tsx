'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function ManualEntryPage() {
  const [article, setArticle] = useState('');
  const [color, setColor] = useState('');
  const [mrp, setMrp] = useState<number | ''>('');
  const [sizes, setSizes] = useState<Record<string, number>>({
    '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const totalPairs = Object.values(sizes).reduce((sum, val) => sum + (val || 0), 0);

  const handleSubmit = async () => {
    if (!article || !color || totalPairs <= 0 || mrp === '') {
      setMessage('Please enter Article, Colour, Price (MRP), and at least 1 pair.');
      return;
    }

    setLoading(true);
    setMessage('');

    const sizeDetails = Object.entries(sizes)
      .filter(([_, qty]) => qty > 0)
      .map(([size, qty]) => ({ size, totalQuantity: qty }));

    try {
      const res = await fetch('/api/packing/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: article.toUpperCase(),
          color: color.toUpperCase(),
          mrp: Number(mrp),
          sizeDetails,
          totalPairs
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ ' + data.message);
        setArticle('');
        setColor('');
        setMrp('');
        setSizes({'5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0});
      } else {
        setMessage('❌ Error: ' + data.error);
      }
    } catch (err: any) {
      setMessage('❌ Network Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Manual Entry (Scanning Intake only)</h1>
        <p style={{ margin: '4px 0 0 0', color: 'var(--text-ghost)', fontSize: '14px' }}>Add loose product directly into the Inventory Storage Pool without a scanner.</p>
      </div>

      <div className={styles.formPanel}>
        {message && (
          <div className={message.includes('✅') ? styles.msgSuccess : styles.msgError}>
            {message}
          </div>
        )}

        <div className={styles.inputGrid}>
          <div className={styles.inputGroup}>
            <label>Article Number</label>
            <input 
              type="text" 
              value={article} 
              onChange={e => setArticle(e.target.value.toUpperCase())}
              placeholder="e.g. JG-102"
              className={styles.inputField}
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Colour</label>
            <input 
              type="text" 
              value={color} 
              onChange={e => setColor(e.target.value.toUpperCase())}
              placeholder="e.g. BLACK"
              className={styles.inputField}
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Price (MRP)</label>
            <input 
              type="number" 
              value={mrp} 
              onChange={e => setMrp(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="e.g. 499"
              className={styles.inputField}
              min="0"
              step="0.01"
              required
            />
          </div>
        </div>

        <div className={styles.sizesSection}>
          <label>Quantities to Add (Loose Pairs)</label>
          <div className={styles.sizeGrid}>
            {['5','6','7','8','9','10','11','12'].map(sz => (
              <div key={sz} className={styles.sizeBox}>
                <span className={styles.sizeLabel}>Size {sz}</span>
                <input 
                  type="number" 
                  min="0"
                  value={sizes[sz] || ''}
                  onChange={e => setSizes({...sizes, [sz]: parseInt(e.target.value) || 0})}
                  className={styles.sizeInput}
                />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footerRow}>
          <div className={styles.totalBadge}>
            Total Inward Pairs: <strong>{totalPairs}</strong>
          </div>
          <button 
            className={styles.submitBtn} 
            onClick={handleSubmit}
            disabled={loading || totalPairs <= 0 || !article || !color || mrp === ''}
          >
            {loading ? 'Processing...' : 'Add to Inventory Pool →'}
          </button>
        </div>
      </div>
    </div>
  );
}
