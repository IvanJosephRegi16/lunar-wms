'use client';

import React, { useState, useMemo } from 'react';
import { ComparisonResultRow } from '@/lib/matching-files/types';

interface Props {
  results: ComparisonResultRow[];
  totalResults?: number;
}

type SortKey = 'article' | 'colour' | 'size' | 'status';

export default function ComparisonTable({ results, totalResults }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'All'>(50);
  const [sortCol, setSortCol] = useState<SortKey | null>(null);
  const [sortDesc, setSortDesc] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Reset to page 1 whenever results change (e.g. new search)
  const prevResultsLength = React.useRef(results.length);
  if (prevResultsLength.current !== results.length) {
    prevResultsLength.current = results.length;
    // defer state update to avoid render-during-render
    setTimeout(() => setPage(1), 0);
  }

  // Sort
  const sorted = useMemo(() => {
    if (!sortCol) return results;
    return [...results].sort((a, b) => {
      const valA = a[sortCol] ?? '';
      const valB = b[sortCol] ?? '';
      if (valA < valB) return sortDesc ? 1 : -1;
      if (valA > valB) return sortDesc ? -1 : 1;
      return 0;
    });
  }, [results, sortCol, sortDesc]);

  // Paginate
  const totalPages = pageSize === 'All' ? 1 : Math.ceil(sorted.length / (pageSize as number));
  const paginated = useMemo(() => {
    if (pageSize === 'All') return sorted;
    const start = (page - 1) * (pageSize as number);
    return sorted.slice(start, start + (pageSize as number));
  }, [sorted, page, pageSize]);

  const toggleSort = (col: SortKey) => {
    if (sortCol === col) {
      if (sortDesc) { setSortCol(null); setSortDesc(false); }
      else setSortDesc(true);
    } else {
      setSortCol(col); setSortDesc(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const badgeStyle = (status: string): React.CSSProperties => {
    const map: Record<string, { bg: string; color: string }> = {
      'Perfect Match': { bg: '#dcfce7', color: '#16a34a' },
      'Partial Match': { bg: '#fef3c7', color: '#d97706' },
      'Missing':       { bg: '#f1f5f9', color: '#64748b' },
      'Conflict':      { bg: '#fee2e2', color: '#dc2626' },
      'Duplicate':     { bg: '#fce7f3', color: '#db2777' },
      'Unique':        { bg: '#eff6ff', color: '#3b82f6' },
    };
    const s = map[status] || { bg: '#f8fafc', color: '#475569' };
    return { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' as const };
  };

  const fileChipStyle = (heading: string, isBase: boolean): React.CSSProperties => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    background: isBase ? '#dbeafe' : '#f0fdf4',
    color: isBase ? '#1d4ed8' : '#15803d',
    border: `1px solid ${isBase ? '#93c5fd' : '#86efac'}`,
    whiteSpace: 'nowrap',
    marginRight: '4px',
    marginBottom: '4px',
  });

  const thStyle: React.CSSProperties = {
    padding: '14px 16px',
    fontSize: '12px',
    fontWeight: 800,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    background: '#f8fafc',
  };

  if (results.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
        <div style={{ fontWeight: 700, fontSize: '16px', color: '#64748b' }}>No records found</div>
        <div style={{ fontSize: '13px', marginTop: '6px' }}>Try adjusting your search or upload more files.</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>

      {/* Controls bar */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
          {results.length} record{results.length !== 1 ? 's' : ''}
          {totalResults != null && results.length !== totalResults && (
            <span style={{ color: '#94a3b8' }}> (filtered from {totalResults})</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Rows per page:</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(e.target.value === 'All' ? 'All' : Number(e.target.value)); setPage(1); }}
            style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600, fontSize: '13px' }}
          >
            {[10, 25, 50, 100, 500, 'All'].map(sz => (
              <option key={sz} value={sz}>{sz}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '40px', padding: '14px 8px 14px 16px' }}></th>
              {([
                { key: 'article', label: 'Article' },
                { key: 'colour',  label: 'Colour' },
                { key: 'size',    label: 'Size' },
                { key: 'status',  label: 'Status' },
              ] as { key: SortKey; label: string }[]).map(col => (
                <th key={col.key} style={thStyle} onClick={() => toggleSort(col.key)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {col.label}
                    {sortCol === col.key
                      ? <span style={{ color: '#3b82f6', fontWeight: 900 }}>{sortDesc ? ' ↓' : ' ↑'}</span>
                      : <span style={{ opacity: 0.3 }}> ↕</span>}
                  </div>
                </th>
              ))}
              <th style={{ ...thStyle, cursor: 'default' }}>Found In File(s)</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, idx) => (
              <React.Fragment key={row.id}>
                <tr
                  onClick={() => toggleExpand(row.id)}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: expandedRows.has(row.id) ? '#f8fafc' : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                    transition: 'background 0.15s ease',
                  }}
                >
                  <td style={{ padding: '14px 8px 14px 16px', color: '#94a3b8', fontSize: '14px' }}>
                    {expandedRows.has(row.id) ? '▼' : '▶'}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                    {row.article || <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#334155', fontSize: '14px' }}>
                    {row.colour || <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: '#334155', fontSize: '14px' }}>
                    {row.size || <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={badgeStyle(row.status)}>{row.status}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {/* Show unique file names this record was found in */}
                      {Array.from(new Map(row.sources.map(s => [s.fileId, s])).values()).map(src => (
                        <span key={src.fileId} style={fileChipStyle(src.displayHeading, src.displayHeading === 'Base File')}>
                          {src.displayHeading === 'Base File' ? '📌 Base File' : `📄 ${src.displayHeading}`}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>

                {/* Expanded Detail Panel */}
                {expandedRows.has(row.id) && (
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <td colSpan={6} style={{ padding: '20px 40px' }}>
                      <div style={{ fontWeight: 800, fontSize: '13px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Source Breakdown — {row.sources.length} occurrence{row.sources.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {row.sources.map((src, i) => (
                          <div key={i} style={{ background: '#fff', padding: '14px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div style={{ minWidth: '140px' }}>
                              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>File</div>
                              <div style={{ fontSize: '14px', fontWeight: 800, color: src.displayHeading === 'Base File' ? '#1d4ed8' : '#15803d' }}>
                                {src.displayHeading === 'Base File' ? '📌 ' : '📄 '}{src.displayHeading}
                              </div>
                            </div>
                            <div style={{ minWidth: '80px' }}>
                              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Row #</div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>{src.originalRowIndex}</div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Raw Data</div>
                              <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', color: '#334155', overflowX: 'auto', maxHeight: '80px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify(src.rowData, (key, val) => key.startsWith('_') ? undefined : val, 2)}
                              </pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize !== 'All' && totalPages > 1 && (
        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', background: '#f8fafc' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(1)}
            style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontWeight: 700 }}
          >«</button>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{ padding: '6px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontWeight: 700 }}
          >Prev</button>
          <span style={{ fontWeight: 700, color: '#475569', fontSize: '14px' }}>
            Page <span style={{ color: '#3b82f6' }}>{page}</span> / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: '6px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, fontWeight: 700 }}
          >Next</button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
            style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, fontWeight: 700 }}
          >»</button>
        </div>
      )}
    </div>
  );
}
