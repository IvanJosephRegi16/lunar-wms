'use client';

import React, { useState } from 'react';
import { UploadedFile } from '@/lib/matching-files/types';
import { useMatchingStore } from '@/lib/matching-files/store';

export default function FileCard({ file }: { file: UploadedFile }) {
  const store = useMatchingStore();
  const [isEditing, setIsEditing] = useState(false);
  const [headingInput, setHeadingInput] = useState(file.displayHeading);

  const handleSaveHeading = () => {
    store.updateFile(file.id, { displayHeading: headingInput.trim() || file.originalFilename });
    setIsEditing(false);
  };

  const isBaseFile = store.baseFileId === file.id;

  return (
    <div className="card-clean" style={{ 
      padding: '24px', 
      borderRadius: '20px', 
      border: isBaseFile ? '2px solid var(--primary)' : '1px solid #e2e8f0',
      background: isBaseFile ? '#eff6ff' : '#ffffff',
      display: 'flex', 
      flexDirection: 'column',
      gap: '16px',
      position: 'relative'
    }}>
      {isBaseFile && (
        <div style={{ position: 'absolute', top: '-12px', left: '20px', background: 'var(--primary)', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
          Base File
        </div>
      )}

      {/* Header section with rename functionality */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, marginRight: '16px' }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={headingInput}
                onChange={e => setHeadingInput(e.target.value)}
                autoFocus
                onBlur={handleSaveHeading}
                onKeyDown={e => e.key === 'Enter' && handleSaveHeading()}
                style={{ flex: 1, padding: '8px 12px', border: '2px solid var(--primary)', borderRadius: '8px', fontSize: '18px', fontWeight: 800 }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', cursor: 'text' }} onClick={() => setIsEditing(true)}>
                {file.displayHeading}
              </h4>
              <button onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>✏️</button>
            </div>
          )}
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Original: {file.originalFilename}</p>
        </div>
        
        {/* Status Badge */}
        <div>
          <span style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            background: file.status === 'ready' ? '#dcfce7' : file.status === 'error' || file.status === 'unsupported' ? '#fee2e2' : '#fef3c7',
            color: file.status === 'ready' ? '#16a34a' : file.status === 'error' || file.status === 'unsupported' ? '#dc2626' : '#d97706'
          }}>
            {file.status === 'parsing' ? '⏳ Parsing...' : file.status}
          </span>
        </div>
      </div>

      {/* Meta Info */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>
        <div>📁 {file.fileType.toUpperCase()}</div>
        <div>💾 {(file.fileSize / 1024 / 1024).toFixed(2)} MB</div>
        <div>🕒 {new Date(file.uploadDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      {file.errorMessage && (
        <div style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', fontWeight: 600 }}>
          {file.errorMessage}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        <button
          className="btn-corp"
          onClick={() => {
            if (confirm('Delete this file permanently?')) {
              store.removeFile(file.id);
            }
          }}
          style={{ flex: 1, minWidth: '100px', background: '#fff', color: '#ef4444', border: '1px solid #fecaca', padding: '10px', fontWeight: 700 }}
        >
          🗑️ Delete
        </button>

        {file.status === 'ready' && !isBaseFile && (
          <button
            className="btn-corp"
            onClick={() => store.setBaseFileId(file.id)}
            style={{ flex: 2, minWidth: '120px', background: '#3b82f6', color: 'white', border: 'none', padding: '10px', fontWeight: 700 }}
          >
            📌 Set as Base
          </button>
        )}

        {isBaseFile && (
          <button
            className="btn-corp"
            onClick={() => store.setBaseFileId(null)}
            style={{ flex: 2, minWidth: '120px', background: '#eff6ff', color: '#1d4ed8', border: '1.5px solid #93c5fd', padding: '10px', fontWeight: 700 }}
          >
            ✖ Unset Base
          </button>
        )}
      </div>
    </div>
  );
}
