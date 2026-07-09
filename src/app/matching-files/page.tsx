'use client';

import React, { useState, useEffect } from 'react';
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
  const [results, setResults] = useState<ComparisonResultRow[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    // Re-run comparison automatically whenever base file or available files change, 
    // IF we have a base file.
    async function runComparison() {
      if (!store.baseFileId) {
        setResults([]);
        return;
      }
      
      const readyFiles = store.files.filter(f => f.status === 'ready');
      if (readyFiles.length < 2) {
        // Need at least base + 1 to compare
        setResults([]);
        return;
      }

      setIsComparing(true);
      try {
        const baseFileData = await getParsedData(store.baseFileId);
        if (!baseFileData) throw new Error('Base file data not found in DB');

        const comparisonFiles: { fileId: string; displayHeading: string; data: ParsedFileData }[] = [];
        for (const file of readyFiles) {
          if (file.id === store.baseFileId) continue;
          const data = await getParsedData(file.id);
          if (data) {
            comparisonFiles.push({ fileId: file.id, displayHeading: file.displayHeading, data });
          }
        }

        const compResults = compareFiles(baseFileData, comparisonFiles);
        setResults(compResults);
      } catch (err) {
        console.error('Comparison error', err);
      } finally {
        setIsComparing(false);
      }
    }
    
    // Slight debounce for UX smoothness
    const t = setTimeout(runComparison, 300);
    return () => clearTimeout(t);
  }, [store.baseFileId, store.files]);

  const handleReset = async () => {
    if (confirm('🛑 Are you sure you want to reset everything? All files and comparison data will be lost.')) {
      await store.resetAll();
      setResults([]);
    }
  };

  if (!store.isHydrated) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Restoring Session...</div>;
  }

  return (
    <div className="fade-up" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>Matching Files</h1>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '16px' }}>
            Upload, compare and search matching data across multiple files instantly.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleReset} 
            className="btn-corp" 
            style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontWeight: 700 }}
          >
            🛑 Reset All
          </button>
        </div>
      </div>

      <UploadEngine />

      {store.files.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Uploaded Files ({store.files.length})</h2>
            {!store.baseFileId && store.files.filter(f => f.status === 'ready').length >= 2 && (
              <div style={{ background: '#fef3c7', color: '#d97706', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>
                💡 Select a base file to begin comparison
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {store.files.map(file => (
              <FileCard key={file.id} file={file} />
            ))}
          </div>
        </div>
      )}

      {store.baseFileId && results.length > 0 && (
        <div style={{ marginTop: '48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 8px 0' }}>Comparison Results</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#16a34a', background: '#dcfce7', padding: '4px 8px', borderRadius: '4px' }}>
                  Base: {store.files.find(f => f.id === store.baseFileId)?.displayHeading}
                </span>
                {isComparing && <span style={{ fontSize: '13px', color: '#3b82f6' }}>🔄 Updating comparison...</span>}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => exportResultsToCsv(results)} 
                className="btn-corp" 
                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
              >
                📊 Export CSV
              </button>
              <button 
                onClick={() => exportResultsToExcel(results)} 
                className="btn-corp" 
                style={{ background: '#10b981', color: 'white', border: 'none' }}
              >
                📗 Export Excel
              </button>
            </div>
          </div>

          <SearchFilters />

          <ComparisonTable results={results} />
        </div>
      )}

    </div>
  );
}
