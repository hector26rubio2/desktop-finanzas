/**
 * Formateo de dinero centralizado. Fuente única para evitar `Intl.NumberFormat`
 * disperso por features. Devuelve "1.234.567 COP" (sin decimales por defecto).
 */
export function formatMoney(value: number, currency: string, opts?: { decimals?: number; locale?: string }): string {
  const decimals = opts?.decimals ?? 0;
  const locale = opts?.locale ?? 'es-CO';
  const n = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${n} ${currency}`;
}

/**
 * Igual que formatMoney pero solo el número, sin el código de moneda.
 * `compact` es para ejes de gráficas, donde no cabe la cifra completa: 1,2 M.
 */
export function formatAmount(value: number, opts?: { decimals?: number; locale?: string; compact?: boolean }): string {
  const decimals = opts?.decimals ?? 0;
  const locale = opts?.locale ?? 'es-CO';
  if (opts?.compact) {
    return new Intl.NumberFormat(locale, { notation: 'compact' }).format(value);
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
