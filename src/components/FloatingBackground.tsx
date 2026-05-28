'use client';

import { useEffect, useState } from 'react';
import styles from './FloatingBackground.module.css';

export default function FloatingBackground() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    // A mix of footwear emojis and Lunar's branding as requested
    const icons = ['👡', '👞', '👟', '👢', '🩰', "LUNAR'S", 'IMG'];
    
    // Generate 30 floating items
    const newItems = Array.from({ length: 30 }).map((_, i) => {
      const type = icons[Math.floor(Math.random() * icons.length)];
      return {
        id: i,
        type,
        left: Math.random() * 100, // random start horizontal position (%)
        size: Math.random() * 30 + 20, // random size between 20px and 50px
        duration: Math.random() * 30 + 30, // slow float duration between 30s and 60s
        delay: Math.random() * -60, // random start time so they are pre-scattered
      };
    });
    setItems(newItems);
  }, []);

  if (items.length === 0) return null; // Avoid hydration mismatch

  return (
    <div className={styles.bgContainer}>
      {items.map((item) => (
        <div 
          key={item.id} 
          className={styles.floatingItem}
          style={{
            left: `${item.left}%`,
            fontSize: `${item.size}px`,
            animationDuration: `${item.duration}s`,
            animationDelay: `${item.delay}s`
          }}
        >
          {item.type === 'IMG' ? (
            <img src="/lunars-logo.png" style={{ height: '30px', objectFit: 'contain' }} alt="Lunar's" />
          ) : item.type === "LUNAR'S" ? (
             <span style={{ fontWeight: 900, color: '#3b82f6', letterSpacing: '1px', opacity: 0.5 }}>LUNAR'S</span>
          ) : (
            <span style={{ filter: 'grayscale(0.2)' }}>{item.type}</span>
          )}
        </div>
      ))}
    </div>
  );
}
