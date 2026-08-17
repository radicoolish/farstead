/** Current age in whole years from an ISO birthday, as of `asOf` (defaults
 * to today). Mirrors app.py's calculate_age. */
export function calculateAge(birthday: string, asOf: Date = new Date()): number {
  const [year, month, day] = birthday.split("-").map(Number);
  let age = asOf.getFullYear() - year;
  const hasHadBirthdayThisYear =
    asOf.getMonth() + 1 > month || (asOf.getMonth() + 1 === month && asOf.getDate() >= day);
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

/** "$1.2MM" / "$45K" / "$900" — mirrors app.py's format_compact_currency. */
export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}MM`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
