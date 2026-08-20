import { EXPENSE_TYPES, type ExpenseType } from "../calc/types";

// Every color below was checked against WCAG 2.1's 3:1 non-text contrast
// minimum (SC 1.4.11, "graphical objects") on a white chart surface —
// values are hand-verified via the relative-luminance formula, not just
// picked by eye. Green hues need to stay noticeably darker than blue/violet
// ones at the same HSL lightness to hit that bar, since WCAG's luminance
// formula weights green ~3.5x more than blue.
export const PERSON_CHART_PALETTE = ["#64748b", "#2563eb", "#16a34a", "#0891b2", "#0d9488"];

/** n distinct colors, swept across a green-through-violet hue band —
 * wider than a simple blue/green pair so a large category count (expense
 * types) stays distinguishable, while still steering clear of red/orange
 * (reserved for danger/deficit). Alternates between two lightness tiers,
 * both verified >=3:1 against a white chart background at every hue in
 * this range. */
export function categoricalPalette(n: number): string[] {
  const hueStart = 140; // green
  const hueEnd = 280; // violet
  return Array.from({ length: n }, (_, i) => {
    const hue = n <= 1 ? hueStart : hueStart + (i * (hueEnd - hueStart)) / (n - 1);
    const lightness = i % 2 === 0 ? 30 : 42;
    return `hsl(${Math.round(hue)}, 50%, ${lightness}%)`;
  });
}

/** n evenly-spaced shades of green, light to dark — used where color
 * encodes projected value rather than category identity (household combo
 * chart, ordered by final balance). Capped at 40% lightness at the light
 * end so even the lightest shade still clears 3:1 against a white surface
 * (green is the riskiest hue for this — see categoricalPalette). */
export function greenPalette(n: number): string[] {
  if (n <= 1) return ["#0f5c30"];
  return Array.from({ length: n }, (_, i) => `hsl(152, 45%, ${(40 - (i / (n - 1)) * 24).toFixed(0)}%)`);
}

/** One fixed color per expense type, in EXPENSE_TYPES order — mirrors
 * app.py's EXPENSE_PALETTE (dict(zip(EXPENSE_TYPES, categorical_palette(...)))). */
export const EXPENSE_PALETTE: Record<ExpenseType, string> = Object.fromEntries(
  EXPENSE_TYPES.map((type, i) => [type, categoricalPalette(EXPENSE_TYPES.length)[i]]),
) as Record<ExpenseType, string>;

// Surplus/deficit and the actual-vs-simulated comparison line are semantic,
// not thematic — they stay green/red/gray regardless of accent choices,
// since red-for-bad is a convention worth keeping even in a blue/green app.
// Matched to the --danger/--success CSS tokens for consistency.
export const SURPLUS_COLOR = "#157a3d";
export const DEFICIT_COLOR = "#b3261e";
export const ACTUAL_LINE_COLOR = "#64748b";
