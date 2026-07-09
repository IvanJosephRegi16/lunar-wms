import Papa from 'papaparse';
import * as ExcelJS from 'exceljs';
import { ParsedRow } from './types';

// ─── Normalize a header string for matching ────────────────────────────────
// Strips all spaces, dots, underscores, hyphens and lowercases.
// e.g. "Art No." → "artno", "COLOUR CODE" → "colourcode", "Sz" → "sz"
export function normalizeHeader(header: string): string {
  if (!header) return '';
  return header.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ─── Fuzzy column type detection ──────────────────────────────────────────
// Returns 'article' | 'colour' | 'size' | 'quantity' | null for a given normalized header.
// Covers all common real-world variants found in warehouse/packing Excel sheets.
function detectColumnType(normalizedKey: string): 'article' | 'colour' | 'size' | 'quantity' | null {
  // ── Article / Item / Art No variants ──
  const articlePatterns = [
    'artno', 'art', 'article', 'articleno', 'articlecode', 'articlenum',
    'artnumber', 'artn', 'artcode', 'artnum',
    'item', 'itemno', 'itemcode', 'itemname', 'itemnum',
    'product', 'productno', 'productcode', 'productname',
    'sku', 'skucode', 'skuno',
    'model', 'modelno', 'modelcode',
    'style', 'styleno', 'stylecode',
    'design', 'designno', 'designcode',
    'ref', 'refno', 'reference',
    'partno', 'partcode', 'part',
    'code', 'itemid', 'productid',
  ];

  // ── Colour / Color variants ──
  const colourPatterns = [
    'colour', 'colourno', 'colourcode', 'colourname',
    'color', 'colorcode', 'colorname', 'colorno',
    'col', 'colcode',
    'shade', 'shadecode', 'shadeno', 'shadename',
    'finish', 'finishcode',
    'hue',
  ];

  // ── Size variants ──
  const sizePatterns = [
    'size', 'sizeno', 'sizecode', 'sizename',
    'sz', 'szno', 'szcode',
    'siz',
  ];

  // ── Quantity / Stock variants ──
  const quantityPatterns = [
    'qty', 'quantity', 'stock', 'stockqty', 'stockquantity',
    'pairs', 'pr', 'prs',
    'pcs', 'pieces',
    'count', 'amount', 'balance', 'total', 'totalqty'
  ];

  if (articlePatterns.some(p => normalizedKey === p || normalizedKey.startsWith(p))) {
    return 'article';
  }
  if (colourPatterns.some(p => normalizedKey === p || normalizedKey.startsWith(p))) {
    return 'colour';
  }
  if (sizePatterns.some(p => normalizedKey === p || normalizedKey.startsWith(p))) {
    return 'size';
  }
  if (quantityPatterns.some(p => normalizedKey === p || normalizedKey.startsWith(p))) {
    return 'quantity';
  }
  return null;
}

// ─── Build a unified ParsedRow from a raw data object and its header mapping ──
// headerMapping: { originalKey → normalizedKey } for CSV
//                { normalizedKey → normalizedKey } for Excel (keys are already normalized)
function buildParsedRow(
  rawRow: Record<string, any>,
  headerMapping: Record<string, string>,
  rowIndex: number
): ParsedRow {
  let article = '';
  let colour = '';
  let size = '';
  let quantity = 0;

  for (const [rawKey, val] of Object.entries(rawRow)) {
    // Get the normalized version of this column header
    const normalizedKey = headerMapping[rawKey] ?? normalizeHeader(rawKey);
    const colType = detectColumnType(normalizedKey);
    const strVal = String(val ?? '').trim();

    if (colType === 'article' && !article) article = strVal;
    else if (colType === 'colour' && !colour) colour = strVal;
    else if (colType === 'size' && !size) size = strVal;
    else if (colType === 'quantity' && !quantity) {
      const parsedQty = parseFloat(strVal);
      if (!isNaN(parsedQty)) {
        quantity = parsedQty;
      }
    }
  }

  return {
    _originalRowIndex: rowIndex,
    article,
    colour,
    size,
    quantity,
    ...rawRow,  // keep ALL original fields for expanded row display
  };
}

// ─── CSV Parser ────────────────────────────────────────────────────────────
export async function parseCsvFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (results) => {
        if (!results.meta.fields) {
          return reject(new Error('CSV file has no header row.'));
        }

        // Build a mapping: originalHeader → normalizedHeader
        const headerMapping: Record<string, string> = {};
        results.meta.fields.forEach((h: string) => {
          headerMapping[h] = normalizeHeader(h);
        });

        const parsed: ParsedRow[] = (results.data as Record<string, any>[]).map(
          (row, index) => buildParsedRow(row, headerMapping, index + 1)
        );

        resolve(parsed);
      },
      error: (error) => reject(error),
    });
  });
}

// ─── Excel Parser ──────────────────────────────────────────────────────────
export async function parseExcelFile(file: File): Promise<ParsedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel file contains no worksheets.');

  const rows: ParsedRow[] = [];

  // --- Step 1: Find the header row ---
  // We scan the first 10 rows to find the one that contains article/colour/size-like headers.
  // This handles Excel files where data doesn't start at row 1.
  let headerRowNumber = -1;
  const headerNormalizedMap: Record<string, string> = {}; // columnIndex → normalizedHeader
  const headerOriginalMap: Record<string, string> = {};   // columnIndex → originalHeader

  worksheet.eachRow((row, rowNumber) => {
    if (headerRowNumber !== -1) return; // already found
    if (rowNumber > 15) return;         // don't scan too far

    let articleFound = false;
    let colourFound = false;
    let sizeFound = false;

    if (Array.isArray(row.values)) {
      row.values.forEach((cellVal: any, idx: number) => {
        if (!cellVal) return;
        const raw = String(cellVal).trim();
        const norm = normalizeHeader(raw);
        const type = detectColumnType(norm);
        if (type === 'article') articleFound = true;
        if (type === 'colour') colourFound = true;
        if (type === 'size') sizeFound = true;
        headerNormalizedMap[idx.toString()] = norm;
        headerOriginalMap[idx.toString()] = raw;
      });
    }

    // Accept this as header row if we found at least article or (colour + size)
    if (articleFound || (colourFound && sizeFound)) {
      headerRowNumber = rowNumber;
    }
  });

  // Fallback: treat row 1 as header if nothing detected
  if (headerRowNumber === -1) {
    const firstRow = worksheet.getRow(1);
    if (Array.isArray(firstRow.values)) {
      firstRow.values.forEach((cellVal: any, idx: number) => {
        if (!cellVal) return;
        const raw = String(cellVal).trim();
        headerNormalizedMap[idx.toString()] = normalizeHeader(raw);
        headerOriginalMap[idx.toString()] = raw;
      });
    }
    headerRowNumber = 1;
  }

  // --- Step 2: Parse data rows ---
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return; // skip header row(s)

    const rawRow: Record<string, any> = {};
    if (Array.isArray(row.values)) {
      row.values.forEach((val: any, idx: number) => {
        const origHeader = headerOriginalMap[idx.toString()];
        if (!origHeader) return;

        // Handle ExcelJS formula cells
        let cellValue = val;
        if (val && typeof val === 'object') {
          if ('result' in val) cellValue = val.result;
          else if ('text' in val) cellValue = val.text;
        }

        rawRow[origHeader] = cellValue;
      });
    }

    // Skip completely empty rows
    const hasData = Object.values(rawRow).some(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (!hasData) return;

    // Build a mapping: originalHeader → normalizedHeader for this row
    const headerMapping: Record<string, string> = {};
    Object.entries(headerOriginalMap).forEach(([_idx, orig]) => {
      headerMapping[orig] = normalizeHeader(orig);
    });

    rows.push(buildParsedRow(rawRow, headerMapping, rowNumber));
  });

  return rows;
}
