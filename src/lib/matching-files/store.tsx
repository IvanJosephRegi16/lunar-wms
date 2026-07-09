'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UploadedFile, ParsedFileData, ComparisonResultRow } from './types';
import { getFilesMetadata, saveFileMetadata, deleteFileDB, clearAllDB, getParsedData } from './db';

interface MatchingStoreState {
  files: UploadedFile[];
  baseFileId: string | null;
  searchArticle: string;
  searchColour: string;
  searchSize: string;
  isHydrated: boolean;
  
  addFile: (file: UploadedFile) => void;
  updateFile: (id: string, updates: Partial<UploadedFile>) => void;
  removeFile: (id: string) => void;
  setBaseFileId: (id: string | null) => void;
  setSearchArticle: (val: string) => void;
  setSearchColour: (val: string) => void;
  setSearchSize: (val: string) => void;
  resetAll: () => Promise<void>;
}

const MatchingContext = createContext<MatchingStoreState | null>(null);

export function MatchingProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [baseFileId, setBaseFileId] = useState<string | null>(null);
  const [searchArticle, setSearchArticle] = useState('');
  const [searchColour, setSearchColour] = useState('');
  const [searchSize, setSearchSize] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate session from IndexedDB on mount
  useEffect(() => {
    async function load() {
      try {
        const storedFiles = await getFilesMetadata();
        setFiles(storedFiles.sort((a, b) => b.uploadDate - a.uploadDate));
        
        // Restore session states from localStorage
        const storedBase = localStorage.getItem('matching_baseFileId');
        if (storedBase) setBaseFileId(storedBase);
        
        setSearchArticle(localStorage.getItem('matching_searchArticle') || '');
        setSearchColour(localStorage.getItem('matching_searchColour') || '');
        setSearchSize(localStorage.getItem('matching_searchSize') || '');
      } catch (e) {
        console.error('Failed to hydrate from IndexedDB', e);
      } finally {
        setIsHydrated(true);
      }
    }
    load();
  }, []);

  // Save session states to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    if (baseFileId) localStorage.setItem('matching_baseFileId', baseFileId);
    else localStorage.removeItem('matching_baseFileId');
    localStorage.setItem('matching_searchArticle', searchArticle);
    localStorage.setItem('matching_searchColour', searchColour);
    localStorage.setItem('matching_searchSize', searchSize);
  }, [baseFileId, searchArticle, searchColour, searchSize, isHydrated]);

  const addFile = (file: UploadedFile) => {
    setFiles((prev) => [file, ...prev]);
    saveFileMetadata(file).catch(console.error);
  };

  const updateFile = (id: string, updates: Partial<UploadedFile>) => {
    setFiles((prev) => prev.map((f) => {
      if (f.id === id) {
        const updated = { ...f, ...updates };
        saveFileMetadata(updated).catch(console.error);
        return updated;
      }
      return f;
    }));
  };

  const removeFile = async (id: string) => {
    if (baseFileId === id) setBaseFileId(null);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    await deleteFileDB(id).catch(console.error);
  };

  const resetAll = async () => {
    setFiles([]);
    setBaseFileId(null);
    setSearchArticle('');
    setSearchColour('');
    setSearchSize('');
    localStorage.removeItem('matching_baseFileId');
    localStorage.removeItem('matching_searchArticle');
    localStorage.removeItem('matching_searchColour');
    localStorage.removeItem('matching_searchSize');
    await clearAllDB();
  };

  return (
    <MatchingContext.Provider value={{
      files,
      baseFileId,
      searchArticle,
      searchColour,
      searchSize,
      isHydrated,
      addFile,
      updateFile,
      removeFile,
      setBaseFileId,
      setSearchArticle,
      setSearchColour,
      setSearchSize,
      resetAll
    }}>
      {children}
    </MatchingContext.Provider>
  );
}

export function useMatchingStore() {
  const context = useContext(MatchingContext);
  if (!context) throw new Error('useMatchingStore must be used within a MatchingProvider');
  return context;
}
