export function formatToIST(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '-';
  
  try {
    let date: Date;
    if (typeof dateInput === 'string') {
      // If it's a SQLite timestamp like "2026-05-08 04:21:57", it's UTC.
      // JS needs a 'Z' or 'T' to interpret it as UTC correctly in all environments.
      const utcStr = dateInput.includes('T') ? dateInput : dateInput.replace(' ', 'T') + 'Z';
      date = new Date(utcStr);
    } else {
      date = new Date(dateInput);
    }

    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    });
  } catch (e) {
    return String(dateInput);
  }
}
