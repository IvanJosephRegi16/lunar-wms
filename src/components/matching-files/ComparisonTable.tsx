'use client';

import React, { useState, useMemo } from 'react';
import { useMatchingStore } from '@/lib/matching-files/store';
import { ComparisonResultRow } from '@/lib/matching-files/types';

interface Props {
  results: ComparisonResultRow[];
}

export default function ComparisonTable({ results }: Props) {
  const store = useMatchingStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'All'>(50);
  const [sortCol, setSortCol] = useState<keyof ComparisonResultRow | null>(null);
  const [sortDesc, setSortDesc] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filter
  const filtered = useMemo(() => {
    return results.filter(r => {
      if (store.searchArticle && !r.article.toLowerCase().includes(store.searchArticle.toLowerCase())) return false;
      if (store.searchColour && !r.colour.toLowerCase().includes(store.searchColour.toLowerCase())) return false;
      if (store.searchSize && !r.size.toLowerCase().includes(store.searchSize.toLowerCase())) return false;
      return true;
    });
  }, [results, store.searchArticle, store.searchColour, store.searchSize]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];
      if (valA < valB) return sortDesc ? 1 : -1;
      if (valA > valB) return sortDesc ? -1 : 1;
      return 0;
    });
  }, [filtered, sortCol, sortDesc]);

  // Paginate
  const paginated = useMemo(() => {
    if (pageSize === 'All') return sorted;
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const toggleSort = (col: keyof ComparisonResultRow) => {
    if (sortCol === col) {
      if (sortDesc) {
        setSortCol(null);
        setSortDesc(false);
      } else {
        setSortDesc(true);
      }
    } else {
      setSortCol(col);
      setSortDesc(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Perfect Match': return { bg: '#dcfce7', text: '#16a34a' };
      case 'Partial Match': return { bg: '#fef3c7', text: '#d97706' };
      case 'Missing': return { bg: '#f3f4f6', text: '#6b7280' };
      case 'Conflict': return { bg: '#fee2e2', text: '#dc2626' };
      case 'Duplicate': return { bg: '#fce7f3', text: '#db2777' };
      default: return { bg: '#f8fafc', text: '#475569' };
    }
  };

  return (
    <div className="card-clean" style={{ background: '#fff', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      
      {/* Table Header Controls */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>
          Showing {paginated.length} of {filtered.length} records
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>Rows per page:</label>
          <select 
            value={pageSize}
            onChange={e => {
              setPageSize(e.target.value === 'All' ? 'All' : Number(e.target.value));
              setPage(1);
            }}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600 }}
          >
            {[10, 25, 50, 100, 500, 'All'].map(sz => (
              <option key={sz} value={sz}>{sz}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Responsive Table Wrapper */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ width: '50px' }}></th>
              {[
                { key: 'article', label: 'Article' },
                { key: 'colour', label: 'Colour' },
                { key: 'size', label: 'Size' },
                { key: 'status', label: 'Match Status' }
              ].map(col => (
                <th 
                  key={col.key} 
                  onClick={() => toggleSort(col.key as keyof ComparisonResultRow)}
                  style={{ padding: '16px', fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {col.label}
                    {sortCol === col.key && (
                      <span style={{ color: 'var(--primary)', fontSize: '16px' }}>{sortDesc ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                  No matching records found.
                </td>
              </tr>
            ) : (
              paginated.map(row => (
                <React.Fragment key={row.id}>
                  <tr 
                    onClick={() => toggleExpand(row.id)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: expandedRows.has(row.id) ? '#f8fafc' : '#fff', transition: 'background 0.2s ease' }}
                  >
                    <td style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                      {expandedRows.has(row.id) ? '▼' : '▶'}
                    </td>
                    <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>{row.article || '-'}</td>
                    <td style={{ padding: '16px', fontWeight: 600, color: '#475569' }}>{row.colour || '-'}</td>
                    <td style={{ padding: '16px', fontWeight: 800, color: '#334155' }}>{row.size || '-'}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '12px', 
                        fontWeight: 700,
                        background: getBadgeColor(row.status).bg,
                        color: getBadgeColor(row.status).text 
                      }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded Detail View */}
                  {expandedRows.has(row.id) && (
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <td colSpan={5} style={{ padding: '24px 40px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px' }}>Source Breakdown</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {row.sources.map((src, i) => (
                            <div key={i} style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', gap: '24px', alignItems: 'center' }}>
                              <div style={{ minWidth: '150px' }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Found In File</div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary)' }}>{src.displayHeading}</div>
                              </div>
                              <div style={{ minWidth: '100px' }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Row Number</div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>{src.originalRowIndex}</div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Original Row Data</div>
                                <div style={{ fontSize: '12px', fontFamily: 'monospace', background: '#f1f5f9', padding: '8px', borderRadius: '6px', color: '#334155', maxHeight: '100px', overflowY: 'auto' }}>
                                  {JSON.stringify(src.rowData, (key, val) => key.startsWith('_') ? undefined : val)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pageSize !== 'All' && (
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', background: '#f8fafc' }}>
          <button 
            disabled={page === 1} 
            onClick={() => setPage(prev => Math.max(1, prev - 1))}
            className="btn-corp"
            style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', opacity: page === 1 ? 0.5 : 1 }}
          >
            Previous
          </button>
          <span style={{ fontWeight: 700, color: '#475569' }}>Page {page}</span>
          <button 
            disabled={paginated.length < pageSize} 
            onClick={() => setPage(prev => prev + 1)}
            className="btn-corp"
            style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', opacity: paginated.length < pageSize ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
