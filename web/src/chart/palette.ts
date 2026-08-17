import { EXPENSE_TYPES, type ExpenseType } from "../calc/types";

// One deliberate, cohesive palette shared by every chart — mirrors app.py's
// PERSON_CHART_PALETTE / EXPENSE_PALETTE / green_palette comments. The
// per-person chart uses this as fixed categorical colors (Base is always
// the neutral slate; scenarios take the accent colors in order).
export const PERSON_CHART_PALETTE = ["#334155", "#2563eb", "#d97706", "#7c3aed", "#0891b2"];

/** n distinct hues, evenly spaced around the color wheel — used for
 * categorical series where the count isn't known ahead of time (expense
 * types, household combos). */
export function categoricalPalette(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `hsl(${Math.round((i * 360) / n)}, 55%, 52%)`);
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

export const SURPLUS_COLOR = "#1a7f37";
export const DEFICIT_COLOR = "#cf222e";
export const ACTUAL_LINE_COLOR = "#94a3b8";
