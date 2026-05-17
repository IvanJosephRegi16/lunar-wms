'use client';

import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'none',
        border: 'none',
        color: '#6b7280',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 700,
        marginBottom: '16px',
        padding: '6px 12px',
        borderRadius: '8px',
        transition: 'background 0.2s, color 0.2s'
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#1e3a5f'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; }}
    >
      ← Back
    </button>
  );
}
