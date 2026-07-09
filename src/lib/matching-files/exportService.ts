import * as ExcelJS from 'exceljs';
import { ComparisonResultRow } from './types';

export async function exportResultsToExcel(results: ComparisonResultRow[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Comparison Results');

  worksheet.columns = [
    { header: 'Article', key: 'article', width: 20 },
    { header: 'Colour', key: 'colour', width: 20 },
    { header: 'Size', key: 'size', width: 10 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Files Found In', key: 'files', width: 50 },
  ];

  results.forEach(res => {
    worksheet.addRow({
      article: res.article,
      colour: res.colour,
      size: res.size,
      status: res.status,
      files: res.sources.map(s => s.displayHeading).join(', ')
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Comparison_Results_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportResultsToCsv(results: ComparisonResultRow[]) {
  const headers = ['Article', 'Colour', 'Size', 'Status', 'Files Found In'];
  const rows = results.map(res => [
    `"${res.article}"`,
    `"${res.colour}"`,
    `"${res.size}"`,
    `"${res.status}"`,
    `"${res.sources.map(s => s.displayHeading).join(', ')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Comparison_Results_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
