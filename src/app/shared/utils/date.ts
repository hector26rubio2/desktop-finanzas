export function parseDate(s: string): Date {
  if (s.includes('/')) {
    const [datePart, timePart] = s.split(' ');
    const parts = datePart.split('/').map(Number);
    let y: number, m: number, d: number;
    if (parts[2] > 100) {
      y = parts[2];
      m = parts[1];
      d = parts[0];
    } else {
      y = parts[0];
      m = parts[1];
      d = parts[2];
    }
    if (timePart) {
      const [hh, mi, ss] = timePart.split(':').map(Number);
      return new Date(y, m - 1, d, hh ?? 0, mi ?? 0, ss ?? 0);
    }
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date(s.length <= 10 ? s + 'T12:00:00' : s);
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function getWeekRange(date: Date, lang = 'es'): { start: Date; end: Date; label: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const fmt = (dt: Date) => dt.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
  return { start: monday, end: sunday, label: fmt(monday) + ' \u2013 ' + fmt(sunday) };
}

export function range(n: number, max = 36): number[] {
  return Array.from({ length: Math.min(n, max) }, (_, i) => i);
}
