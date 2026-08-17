/** "$1.2M" / "$45K" / "$900" — a slightly coarser variant of
 * formatCompactCurrency tuned for chart axis ticks (millions get one
 * decimal, matching Altair's "$,.2s" format used throughout app.py). */
export function formatAxisCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

/** "$45,000" — full precision, for tooltips. */
export function formatFullCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
