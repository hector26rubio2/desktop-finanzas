export function formatMoney(value: number, currency: string, opts?: { decimals?: number; locale?: string }): string {
  const decimals = opts?.decimals ?? 0;
  const locale = opts?.locale ?? 'es-CO';
  const n = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${n} ${currency}`;
}

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
