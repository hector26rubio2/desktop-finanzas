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

/** Igual que formatMoney pero solo el número, sin el código de moneda. */
export function formatAmount(value: number, opts?: { decimals?: number; locale?: string }): string {
  const decimals = opts?.decimals ?? 0;
  const locale = opts?.locale ?? 'es-CO';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
