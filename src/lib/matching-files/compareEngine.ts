import { ParsedFileData, ParsedRow, ComparisonResultRow, MatchStatus } from './types';

function createCompositeKey(article: string, colour: string, size: string): string {
  // Normalize exactly as requested: ignore case, remove extra spaces
  const normA = (article || '').toString().toLowerCase().replace(/\s+/g, '');
  const normC = (colour || '').toString().toLowerCase().replace(/\s+/g, '');
  const normS = (size || '').toString().toLowerCase().replace(/\s+/g, '');
  return `${normA}|${normC}|${normS}`;
}

export function compareFiles(
  baseFile: ParsedFileData,
  comparisonFiles: { fileId: string; displayHeading: string; data: ParsedFileData }[]
): ComparisonResultRow[] {
  const resultsMap = new Map<string, ComparisonResultRow>();

  // 1. Build Base File Map
  baseFile.rows.forEach(row => {
    const key = createCompositeKey(row.article, row.colour, row.size);
    if (!key || key === '||') return; // skip empty rows

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
      displayHeading: 'Base File', // Generic label, can be mapped in UI
      originalRowIndex: row._originalRowIndex,
      rowData: row
    });
  });

  // 2. Scan Comparison Files
  comparisonFiles.forEach(comp => {
    comp.data.rows.forEach(row => {
      const key = createCompositeKey(row.article, row.colour, row.size);
      if (!key || key === '||') return;

      if (!resultsMap.has(key)) {
        // Exists in comparison file, but NOT in base file
        resultsMap.set(key, {
          id: `row_${key}_${comp.fileId}_${row._originalRowIndex}`,
          compositeKey: key,
          article: row.article,
          colour: row.colour,
          size: row.size,
          sources: [],
          status: 'Conflict' // Or "Extra", user requirement says Missing/Conflict/Duplicate
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
  const expectedFileCount = comparisonFiles.length + 1; // Base + Comparisons

  finalResults.forEach(res => {
    // Determine status based on source occurrences
    const sourceIds = new Set(res.sources.map(s => s.fileId));
    
    if (sourceIds.size === expectedFileCount) {
      res.status = 'Perfect Match';
    } else if (sourceIds.size === 1 && sourceIds.has(baseFile.fileId)) {
      res.status = 'Missing'; // Only in base
    } else if (!sourceIds.has(baseFile.fileId)) {
      res.status = 'Conflict'; // Not in base
    } else {
      res.status = 'Partial Match'; // In base and SOME but not ALL comparison files
    }

    // Check for intra-file duplicates
    const countsPerFile: Record<string, number> = {};
    res.sources.forEach(s => {
      countsPerFile[s.fileId] = (countsPerFile[s.fileId] || 0) + 1;
    });
    if (Object.values(countsPerFile).some(count => count > 1)) {
      res.status = 'Duplicate'; // Found multiple times in the same file
    }
  });

  return finalResults;
}
