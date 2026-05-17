export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  let parsedStr = dateStr;
  if (!dateStr.includes('T') && !dateStr.includes('Z') && dateStr.includes(' ')) {
    parsedStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(parsedStr);
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  let parsedStr = dateStr;
  if (!dateStr.includes('T') && !dateStr.includes('Z') && dateStr.includes(' ')) {
    parsedStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(parsedStr);
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export function getMayDates(year = 2026): string[] {
  const dates: string[] = [];
  for (let d = 1; d <= 31; d++) {
    dates.push(`${year}-05-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

export function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `May ${d.getDate()}`;
}

export function sumSizes(entry: Record<string, number>): number {
  const sizeKeys = ['size_6','size_7','size_8','size_9','size_10','size_11','size_12'];
  return sizeKeys.reduce((sum, k) => sum + (Number(entry[k]) || 0), 0);
}

export function checkDuplicate(
  entries: Record<string, unknown>[],
  newEntry: Record<string, unknown>,
  excludeId?: number
): boolean {
  return entries.some(e => {
    if (e.id === excludeId) return false;
    return e.article_code === newEntry.article_code &&
           e.colour === newEntry.colour &&
           e.sheet_date === newEntry.sheet_date;
  });
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: '#94a3b8',
    submitted: '#f59e0b',
    approved: '#10b981',
    rejected: '#ef4444',
    locked: '#6366f1',
    open: '#3b82f6',
  };
  return map[status] || '#64748b';
}

export function roleColor(role: string): string {
  const map: Record<string, string> = {
    admin: '#8b5cf6',
    supervisor: '#f59e0b',
    operator: '#3b82f6',
  };
  return map[role] || '#64748b';
}
