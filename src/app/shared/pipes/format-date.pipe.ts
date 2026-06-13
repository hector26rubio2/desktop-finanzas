import { Pipe, PipeTransform } from '@angular/core';
import { parseDate } from '../utils/date';

@Pipe({ standalone: true, name: 'fmtDate' })
export class FmtDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    const d = parseDate(value);
    if (isNaN(d.getTime())) return value;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    // Fechas sin hora en el origen no deben inventar una (parseDate usa 12:00 como mediodía neutro)
    if (!value.includes(':')) return `${day}/${month}/${year}`;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  }
}
