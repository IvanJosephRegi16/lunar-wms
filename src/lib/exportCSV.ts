/**
 * Shared CSV export utility — Google Sheets compatible (UTF-8 BOM, quoted fields)
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (val: string | number | null | undefined) =>
    `"${String(val ?? '').replace(/"/g, '""')}"`;

  const csvContent =
    '\uFEFF' + // BOM for Google Sheets / Excel UTF-8
    [headers.map(escape), ...rows.map(row => row.map(escape))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Format a raw DB timestamp string to a readable IST date-time */
export function formatIST(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    let s = dateString;
    if (!s.includes('T') && !s.includes('Z') && s.includes(' ')) {
      s = s.replace(' ', 'T') + 'Z';
    }
    return new Date(s).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch {
    return dateString ?? '';
  }
}
