import { ParsedFileData, ParsedRow, ComparisonResultRow, MatchStatus } from './types';

function createCompositeKey(article: string, colour: string, size: string): string {
  // Normalize exactly as requested: ignore case, remove extra spaces
  const normA = (article || '').toString().toLowerCase().replace(/\s+/g, '');
  const normC = (colour || '').toString().toLowerCase().replace(/\s+/g, '');
  const normS = (size || '').toString().toLowerCase().replace(/\s+/g, '');
  return `${normA}|${normC}|${normS}`;
}

export function compareFiles(
  baseFile: ParsedFileData | null,
  comparisonFiles: { fileId: string; displayHeading: string; data: ParsedFileData }[]
): ComparisonResultRow[] {
  const resultsMap = new Map<string, ComparisonResultRow>();

  // 1. Build Base File Map (if provided)
  if (baseFile) {
    baseFile.rows.forEach(row => {
      const key = createCompositeKey(row.article, row.colour, row.size);
      if (!key || key === '||') return;

      if (!resultsMap.has(key)) {
        resultsMap.set(key, {
          id: `row_${key}`,
          compositeKey: key,
          article: row.article,
          colour: row.colour,
          size: row.size,
          sources: [],
          status: 'Missing' // default to missing until matched
        });
      }

      const entry = resultsMap.get(key)!;
      entry.sources.push({
        fileId: baseFile.fileId,
        displayHeading: 'Base File',
        originalRowIndex: row._originalRowIndex,
        rowData: row
      });
    });
  }

  // 2. Scan Comparison Files (or ALL files if no base is provided)
  comparisonFiles.forEach(comp => {
    comp.data.rows.forEach(row => {
      const key = createCompositeKey(row.article, row.colour, row.size);
      if (!key || key === '||') return;

      if (!resultsMap.has(key)) {
        resultsMap.set(key, {
          id: `row_${key}_${comp.fileId}_${row._originalRowIndex}`,
          compositeKey: key,
          article: row.article,
          colour: row.colour,
          size: row.size,
          sources: [],
          status: baseFile ? 'Conflict' : 'Unique' // If no base, default unique
        });
      }

      const entry = resultsMap.get(key)!;
      entry.sources.push({
        fileId: comp.fileId,
        displayHeading: comp.displayHeading,
        originalRowIndex: row._originalRowIndex,
        rowData: row
      });
    });
  });

  // 3. Resolve Statuses
  const finalResults = Array.from(resultsMap.values());
  const expectedFileCount = baseFile ? comparisonFiles.length + 1 : comparisonFiles.length;

  finalResults.forEach(res => {
    const sourceIds = new Set(res.sources.map(s => s.fileId));
    
    // Check for intra-file duplicates
    const countsPerFile: Record<string, number> = {};
    res.sources.forEach(s => {
      countsPerFile[s.fileId] = (countsPerFile[s.fileId] || 0) + 1;
    });
    const hasDuplicates = Object.values(countsPerFile).some(count => count > 1);

    if (baseFile) {
      if (hasDuplicates) {
        res.status = 'Duplicate';
      } else if (sourceIds.size === expectedFileCount) {
        res.status = 'Perfect Match';
      } else if (sourceIds.size === 1 && sourceIds.has(baseFile.fileId)) {
        res.status = 'Missing';
      } else if (!sourceIds.has(baseFile.fileId)) {
        res.status = 'Conflict';
      } else {
        res.status = 'Partial Match';
      }
    } else {
      // Global Search Mode (No Base File)
      if (hasDuplicates) {
        res.status = 'Duplicate';
      } else if (sourceIds.size === expectedFileCount && expectedFileCount > 1) {
        res.status = 'Perfect Match';
      } else if (sourceIds.size > 1) {
        res.status = 'Partial Match';
      } else {
        res.status = 'Unique'; // Only exists in 1 file
      }
    }
  });

  return finalResults;
}
