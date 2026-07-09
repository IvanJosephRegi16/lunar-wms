import Papa from 'papaparse';
import * as ExcelJS from 'exceljs';
import { ParsedRow } from './types';

export function normalizeHeader(header: string): string {
  if (!header) return '';
  return header.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function extractImportantFields(row: any, normalizedHeaders: Record<string, string>): ParsedRow {
  let article = '';
  let colour = '';
  let size = '';

  for (const [originalKey, val] of Object.entries(row)) {
    const key = normalizedHeaders[originalKey];
    if (key === 'article' || key === 'articlecode' || key === 'item') {
      article = String(val || '');
    } else if (key === 'colour' || key === 'color') {
      colour = String(val || '');
    } else if (key === 'size') {
      size = String(val || '');
    }
  }

  return {
    _originalRowIndex: -1, // will be assigned in loop
    article: article.trim(),
    colour: colour.trim(),
    size: size.trim(),
    ...row
  };
}

export async function parseCsvFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (results) => {
        if (!results.meta.fields) {
          return reject(new Error('CSV does not have headers.'));
        }
        const headers = results.meta.fields.reduce((acc: any, h: string) => {
          acc[h] = normalizeHeader(h);
          return acc;
        }, {});

        const parsed: ParsedRow[] = results.data.map((row: any, index) => {
          const r = extractImportantFields(row, headers);
          r._originalRowIndex = index + 1;
          return r;
        });
        resolve(parsed);
      },
      error: (error) => reject(error)
    });
  });
}

export async function parseExcelFile(file: File): Promise<ParsedRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel file has no worksheets');

  const rows: any[] = [];
  let headerRow: any = null;
  const headersMap: Record<string, string> = {};

  worksheet.eachRow((row, rowNumber) => {
    if (!headerRow) {
      headerRow = row.values;
      if (Array.isArray(headerRow)) {
        headerRow.forEach((h: any, idx: number) => {
          if (h) headersMap[idx.toString()] = normalizeHeader(h.toString());
        });
      }
      return;
    }

    const rowData: any = {};
    if (Array.isArray(row.values)) {
      row.values.forEach((val: any, idx: number) => {
        const header = headersMap[idx.toString()];
        if (header) {
          if (val && typeof val === 'object' && 'result' in val) {
            rowData[header] = val.result;
          } else {
            rowData[header] = val;
          }
        }
      });
    }

    const parsed = extractImportantFields(rowData, Object.fromEntries(Object.entries(headersMap).map(([k, v]) => [v, v])));
    parsed._originalRowIndex = rowNumber;
    rows.push(parsed);
  });

  return rows;
}
