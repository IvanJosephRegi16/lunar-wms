'use client';

import React, { useRef, useState } from 'react';
import { useMatchingStore } from '@/lib/matching-files/store';
import { parseCsvFile, parseExcelFile } from '@/lib/matching-files/parserEngine';
import { saveParsedData } from '@/lib/matching-files/db';
import { v4 as uuidv4 } from 'uuid';

export default function UploadEngine() {
  const store = useMatchingStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = async (files: File[]) => {
    for (const file of files) {
      const fileId = uuidv4();
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      const isSupported = ['csv', 'xlsx', 'xls'].includes(extension || '');

      store.addFile({
        id: fileId,
        originalFilename: file.name,
        displayHeading: file.name.replace(/\.[^/.]+$/, ""), // remove extension
        fileType: extension || 'unknown',
        fileSize: file.size,
        uploadDate: Date.now(),
        status: isSupported ? 'parsing' : 'unsupported',
        errorMessage: isSupported ? undefined : 'Comparison not yet supported for this format.'
      });

      if (isSupported) {
        // Run parsing asynchronously so it doesn't block UI
        setTimeout(async () => {
          try {
            let parsedRows: any[] = [];
            if (extension === 'csv') {
              parsedRows = await parseCsvFile(file);
            } else if (extension === 'xlsx' || extension === 'xls') {
              parsedRows = await parseExcelFile(file);
            }
            
            await saveParsedData({ fileId, rows: parsedRows });
            store.updateFile(fileId, { status: 'ready' });
          } catch (err: any) {
            console.error('Parsing error', err);
            store.updateFile(fileId, { status: 'error', errorMessage: err.message || 'Error parsing file.' });
          }
        }, 100);
      }
    }
  };

  return (
    <div 
      className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${isDragging ? 'var(--primary)' : '#cbd5e1'}`,
        backgroundColor: isDragging ? '#f0fdf4' : '#f8fafc',
        borderRadius: '16px',
        padding: '40px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginBottom: '24px'
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        multiple 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileSelect}
        accept=".csv,.xlsx,.xls" // visually restrict, but JS handles all via drag
      />
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
        Drag & Drop files here
      </h3>
      <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
        or click to browse files from your computer
      </p>
      <div style={{ marginTop: '16px', fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>
        Supports CSV, XLSX, XLS
      </div>
    </div>
  );
}
