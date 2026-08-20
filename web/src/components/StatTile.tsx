import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: ReactNode;
  help?: string;
  /** Denser sizing for a metric packed into a per-person grid (no card
   * chrome of its own, smaller value) — vs. the default, which is a
   * standalone bordered card for a headline household number. Both
   * variants share the same label size so "small label text" reads as
   * one consistent thing everywhere in the app, not three near-misses. */
  dense?: boolean;
}

/** The app's one stat-tile pattern — a label over a number — used for
 * headline household totals (Household Summary, the Summary tab) and the
 * denser per-person metric grid (PersonBalanceCard) alike. Previously
 * each of those three spots had grown its own slightly-different label
 * size and value weight; this is the single, deliberate version. */
export function StatTile({ label, value, help, dense }: StatTileProps) {
  return (
    <div className={dense ? undefined : "card"} title={help}>
      <div className="stat-tile-label">{label}</div>
      <div className={dense ? "stat-tile-value stat-tile-value-dense" : "stat-tile-value"}>{value}</div>
    </div>
  );
}
