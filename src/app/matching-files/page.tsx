'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useMatchingStore } from '@/lib/matching-files/store';
import { compareFiles } from '@/lib/matching-files/compareEngine';
import { exportResultsToExcel, exportResultsToCsv } from '@/lib/matching-files/exportService';
import { getParsedData } from '@/lib/matching-files/db';
import { ComparisonResultRow, ParsedFileData } from '@/lib/matching-files/types';

import UploadEngine from '@/components/matching-files/UploadEngine';
import FileCard from '@/components/matching-files/FileCard';
import SearchFilters from '@/components/matching-files/SearchFilters';
import ComparisonTable from '@/components/matching-files/ComparisonTable';

export default function MatchingFilesPage() {
  const store = useMatchingStore();
  const [allResults, setAllResults] = useState<ComparisonResultRow[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  // Run comparison any time files change or base file selection changes
  useEffect(() => {
    async function runComparison() {
      const readyFiles = store.files.filter(f => f.status === 'ready');
      if (readyFiles.length === 0) {
        setAllResults([]);
        return;
      }

      setIsComparing(true);
      try {
        // If base file is selected, use it; otherwise pass null (global mode)
        let baseFileData: ParsedFileData | null = null;
        if (store.baseFileId) {
          baseFileData = await getParsedData(store.baseFileId);
        }

        // Build comparison file list — if base is selected, exclude it from comparison list
        const comparisonFiles: { fileId: string; displayHeading: string; data: ParsedFileData }[] = [];
        for (const file of readyFiles) {
          if (store.baseFileId && file.id === store.baseFileId) continue;
          const data = await getParsedData(file.id);
          if (data) {
            comparisonFiles.push({ fileId: file.id, displayHeading: file.displayHeading, data });
          }
        }

        const compResults = compareFiles(baseFileData, comparisonFiles);
        setAllResults(compResults);
      } catch (err) {
        console.error('Comparison error', err);
      } finally {
        setIsComparing(false);
      }
    }

    const t = setTimeout(runComparison, 300);
    return () => clearTimeout(t);
  }, [store.baseFileId, store.files]);

  // Apply search filters here in the page — shared between SearchFilters and ComparisonTable
  const filteredResults = useMemo(() => {
    return allResults.filter(r => {
      const art = store.searchArticle.trim().toLowerCase();
      const col = store.searchColour.trim().toLowerCase();
      const siz = store.searchSize.trim().toLowerCase();
      if (art && !r.article.toLowerCase().includes(art)) return false;
      if (col && !r.colour.toLowerCase().includes(col)) return false;
      if (siz && !r.size.toLowerCase().includes(siz)) return false;
      return true;
    });
  }, [allResults, store.searchArticle, store.searchColour, store.searchSize]);

  const hasActiveSearch = store.searchArticle || store.searchColour || store.searchSize;
  const readyFileCount = store.files.filter(f => f.status === 'ready').length;
  const baseFile = store.files.find(f => f.id === store.baseFileId);

  const handleReset = async () => {
    if (confirm('🛑 Are you sure you want to reset everything? All files and comparison data will be lost.')) {
      await store.resetAll();
      setAllResults([]);
    }
  };

  if (!store.isHydrated) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
        <div style={{ fontWeight: 700, fontSize: '18px' }}>Restoring Session...</div>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
            🧩 Matching Files
          </h1>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '15px' }}>
            Upload files, search by Article / Colour / Size, and compare matches across all files instantly.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="btn-corp"
          style={{ background: '#fef2f2', color: '#ef4444', border: '1.5px solid #fecaca', fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          🛑 Reset All
        </button>
      </div>

      {/* ── UPLOAD ZONE ── */}
      <UploadEngine />

      {/* ── UPLOADED FILE CARDS ── */}
      {store.files.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Uploaded Files ({store.files.length})
            </h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {isComparing && (
                <span style={{ fontSize: '13px', color: '#3b82f6', fontWeight: 600 }}>🔄 Processing...</span>
              )}
              {!store.baseFileId && readyFileCount >= 2 && (
                <div style={{ background: '#fef3c7', color: '#d97706', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>
                  💡 Click <strong>"Set as Base"</strong> on a file to compare against it
                </div>
              )}
              {store.baseFileId && (
                <div style={{ background: '#dcfce7', color: '#16a34a', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>
                  📌 Base: {baseFile?.displayHeading}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {store.files.map(file => (
              <FileCard key={file.id} file={file} />
            ))}
          </div>
        </div>
      )}

      {/* ── SEARCH + RESULTS ── Show as soon as at least 1 ready file exists ── */}
      {readyFileCount > 0 && (
        <div style={{ marginTop: '16px' }}>

          {/* Search Section — Always Visible */}
          <div style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)', borderRadius: '20px', padding: '28px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <span style={{ fontSize: '22px' }}>🔍</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Smart Search</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Search across <strong>all {readyFileCount} uploaded file{readyFileCount > 1 ? 's' : ''}</strong> simultaneously. All three filters work together.
                </p>
              </div>
            </div>
            <SearchFilters />
            {hasActiveSearch && (
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                Showing <span style={{ color: '#3b82f6', fontWeight: 800 }}>{filteredResults.length}</span> of{' '}
                <span style={{ fontWeight: 700 }}>{allResults.length}</span> total records
              </div>
            )}
          </div>

          {/* Results Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, margin: '0 0 4px 0', color: '#0f172a' }}>
                {hasActiveSearch ? '🔎 Search Results' : store.baseFileId ? '📊 Comparison Results' : '📋 All Records'}
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {hasActiveSearch
                  ? `Found ${filteredResults.length} record${filteredResults.length !== 1 ? 's' : ''} matching your search — showing which file(s) each appears in`
                  : store.baseFileId
                    ? `Comparing "${baseFile?.displayHeading}" against ${readyFileCount - 1} other file${readyFileCount - 1 !== 1 ? 's' : ''}`
                    : `All ${allResults.length} records from ${readyFileCount} file${readyFileCount > 1 ? 's' : ''}`}
              </p>
            </div>

            {allResults.length > 0 && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => exportResultsToCsv(hasActiveSearch ? filteredResults : allResults)}
                  className="btn-corp"
                  style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  📊 Export CSV
                </button>
                <button
                  onClick={() => exportResultsToExcel(hasActiveSearch ? filteredResults : allResults)}
                  className="btn-corp"
                  style={{ background: '#10b981', color: 'white', border: 'none', fontSize: '13px' }}
                >
                  📗 Export Excel
                </button>
              </div>
            )}
          </div>

          {/* Status Count Bar */}
          {!hasActiveSearch && allResults.length > 0 && (
            <StatusCountBar results={allResults} />
          )}

          {/* The actual comparison data table */}
          <ComparisonTable results={filteredResults} totalResults={allResults.length} />
        </div>
      )}

    </div>
  );
}

// ── Status Summary Bar ──────────────────────────────────────────────────────
function StatusCountBar({ results }: { results: ComparisonResultRow[] }) {
  const counts: Record<string, number> = {};
  results.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

  const badges = [
    { status: 'Perfect Match', bg: '#dcfce7', text: '#16a34a', icon: '✅' },
    { status: 'Partial Match', bg: '#fef3c7', text: '#d97706', icon: '⚠️' },
    { status: 'Missing',       bg: '#f1f5f9', text: '#64748b', icon: '❓' },
    { status: 'Conflict',      bg: '#fee2e2', text: '#dc2626', icon: '❌' },
    { status: 'Duplicate',     bg: '#fce7f3', text: '#db2777', icon: '🔁' },
    { status: 'Unique',        bg: '#eff6ff', text: '#3b82f6', icon: '🔵' },
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
      {badges.map(b => counts[b.status] ? (
        <div key={b.status} style={{ background: b.bg, color: b.text, padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{b.icon}</span>
          <span>{b.status}</span>
          <span style={{ background: 'rgba(0,0,0,0.1)', borderRadius: '10px', padding: '1px 8px', fontSize: '12px', fontWeight: 800 }}>
            {counts[b.status]}
          </span>
        </div>
      ) : null)}
    </div>
  );
}
