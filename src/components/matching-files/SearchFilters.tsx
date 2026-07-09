'use client';

import React from 'react';
import { useMatchingStore } from '@/lib/matching-files/store';

export default function SearchFilters() {
  const store = useMatchingStore();
  const hasValue = store.searchArticle || store.searchColour || store.searchSize;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 16px',
    borderRadius: '12px',
    border: '2px solid #e2e8f0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#0f172a',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
    background: '#fff',
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {/* Article */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Article
          </label>
          <input
            type="text"
            placeholder="e.g. JG9919"
            value={store.searchArticle}
            onChange={e => store.setSearchArticle(e.target.value)}
            style={{
              ...inputStyle,
              borderColor: store.searchArticle ? '#3b82f6' : '#e2e8f0',
            }}
          />
        </div>

        {/* Colour */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Colour
          </label>
          <input
            type="text"
            placeholder="e.g. Black"
            value={store.searchColour}
            onChange={e => store.setSearchColour(e.target.value)}
            style={{
              ...inputStyle,
              borderColor: store.searchColour ? '#3b82f6' : '#e2e8f0',
            }}
          />
        </div>

        {/* Size */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Size
          </label>
          <input
            type="text"
            placeholder="e.g. 8"
            value={store.searchSize}
            onChange={e => store.setSearchSize(e.target.value)}
            style={{
              ...inputStyle,
              borderColor: store.searchSize ? '#3b82f6' : '#e2e8f0',
            }}
          />
        </div>

        {/* Clear button — only shown when any filter is active */}
        {hasValue && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'flex-end' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'transparent', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              &nbsp;
            </label>
            <button
              onClick={() => {
                store.setSearchArticle('');
                store.setSearchColour('');
                store.setSearchSize('');
              }}
              style={{
                padding: '11px 16px',
                borderRadius: '12px',
                border: '2px solid #fecaca',
                background: '#fef2f2',
                color: '#ef4444',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ✕ Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
