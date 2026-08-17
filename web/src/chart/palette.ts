import { EXPENSE_TYPES, type ExpenseType } from "../calc/types";

// One deliberate, cohesive palette shared by every chart — kept within the
// app's blue/green/gray identity rather than a generic rainbow. The
// per-person chart uses this as fixed categorical colors (Base is always
// the neutral slate; scenarios take the accent colors in order).
export const PERSON_CHART_PALETTE = ["#64748b", "#2563eb", "#16a34a", "#0891b2", "#0d9488"];

/** n distinct colors, swept across a blue-through-green hue band (rather
 * than the full color wheel) with alternating lightness so adjacent steps
 * stay distinguishable even when n is large — used for categorical series
 * where the count isn't known ahead of time (expense types, household
 * combos). */
export function categoricalPalette(n: number): string[] {
  const hueStart = 155; // green
  const hueEnd = 255; // blue
  return Array.from({ length: n }, (_, i) => {
    const hue = n <= 1 ? hueStart : hueStart + (i * (hueEnd - hueStart)) / (n - 1);
    const lightness = i % 2 === 0 ? 46 : 58;
    return `hsl(${Math.round(hue)}, 50%, ${lightness}%)`;
  });
}

/** n evenly-spaced shades of green, light to dark — used where color
 * encodes projected value rather than category identity (household combo
 * chart, ordered by final balance). */
export function greenPalette(n: number): string[] {
  if (n <= 1) return ["#15803d"];
  return Array.from({ length: n }, (_, i) => `hsl(152, 45%, ${(78 - (i / (n - 1)) * 56).toFixed(0)}%)`);
}

/** One fixed color per expense type, in EXPENSE_TYPES order — mirrors
 * app.py's EXPENSE_PALETTE (dict(zip(EXPENSE_TYPES, categorical_palette(...)))). */
export const EXPENSE_PALETTE: Record<ExpenseType, string> = Object.fromEntries(
  EXPENSE_TYPES.map((type, i) => [type, categoricalPalette(EXPENSE_TYPES.length)[i]]),
) as Record<ExpenseType, string>;

// Surplus/deficit and the actual-vs-simulated comparison line are semantic,
// not thematic — they stay green/red/gray regardless of accent choices,
// since red-for-bad is a convention worth keeping even in a blue/green app.
export const SURPLUS_COLOR = "#16a34a";
export const DEFICIT_COLOR = "#dc2626";
export const ACTUAL_LINE_COLOR = "#94a3b8";
