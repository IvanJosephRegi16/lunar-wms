'use client';

import React from 'react';
import { useMatchingStore } from '@/lib/matching-files/store';

export default function SearchFilters() {
  const store = useMatchingStore();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Search Article</label>
        <input 
          type="text" 
          placeholder="e.g. JG9919"
          value={store.searchArticle}
          onChange={e => store.setSearchArticle(e.target.value)}
          className="corporate-input"
          style={{ padding: '12px 16px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '15px', fontWeight: 600 }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Search Colour</label>
        <input 
          type="text" 
          placeholder="e.g. Black"
          value={store.searchColour}
          onChange={e => store.setSearchColour(e.target.value)}
          className="corporate-input"
          style={{ padding: '12px 16px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '15px', fontWeight: 600 }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Search Size</label>
        <input 
          type="text" 
          placeholder="e.g. 8"
          value={store.searchSize}
          onChange={e => store.setSearchSize(e.target.value)}
          className="corporate-input"
          style={{ padding: '12px 16px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '15px', fontWeight: 600 }}
        />
      </div>
    </div>
  );
}
