export const IST_TIMEZONE = 'Asia/Kolkata';

function parseDbDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  let parsedStr = dateStr;
  if (!dateStr.includes('T') && !dateStr.includes('Z') && dateStr.includes(' ')) {
    parsedStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(parsedStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** YYYY-MM-DD for today in IST (Mumbai). */
export function getTodayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Live clock string for chatbot — Indian date & time, IST · Mumbai. */
export function formatNowIST(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')} · ${get('hour')}:${get('minute')}:${get('second')} ${get('dayPeriod')} IST · Mumbai`;
}

/** Stable header date (SSR + client) — avoids en-IN locale string differences in Node vs browser. */
export function formatTodayHeader(timeZone = IST_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')}`;
}

export function formatDate(dateStr: string): string {
  const d = parseDbDate(dateStr);
  if (!d) return dateStr || '';
  return d.toLocaleDateString('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  const d = parseDbDate(dateStr);
  if (!d) return dateStr || '';
  return d.toLocaleString('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }) + ' IST';
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
