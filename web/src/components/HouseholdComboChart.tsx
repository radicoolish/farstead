import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { formatCompactCurrency, type HouseholdCombo } from "../calc";
import { greenPalette } from "../chart/palette";
import { formatAxisCurrency, formatFullCurrency } from "../chart/format";

function lastValue(series: Map<number, number>): number {
  return [...series.values()][series.size - 1];
}

/** Area chart (every combo's balance by year, overlaid with a very low
 * fill opacity since several combos can overlap here), with each combo's
 * final balance listed underneath in compact form — highest first, colored
 * to match its line. A separate bar chart used to sit alongside the line
 * chart for this, but with the per-person scenario cap now at 2 the combo
 * count stays small enough that a plain totals list reads more cleanly
 * than a second full chart. */
export function HouseholdComboChart({ combos, totalCombos }: { combos: HouseholdCombo[]; totalCombos: number }) {
  const byValueDesc = [...combos].sort((a, b) => lastValue(b.series) - lastValue(a.series));
  const shades = greenPalette(byValueDesc.length);
  const colorByLabel = new Map(byValueDesc.map((c, i) => [c.label, shades[shades.length - 1 - i]]));

  const allYears = new Set<number>();
  for (const combo of combos) for (const year of combo.series.keys()) allYears.add(year);
  const years = [...allYears].sort((a, b) => a - b);
  const lineData = years.map((year) => {
    const row: Record<string, number> = { year };
    for (const combo of combos) row[combo.label] = combo.series.get(year) ?? 0;
    return row;
  });

  return (
    <div>
      <p style={{ fontWeight: 650 }}>All Scenario Combinations ({totalCombos})</p>
      <div style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={lineData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} width={52} />
            <Tooltip formatter={(v) => formatFullCurrency(Number(v))} />
            {combos.map((combo) => (
              <Area
                key={combo.label}
                type="monotone"
                dataKey={combo.label}
                stroke={colorByLabel.get(combo.label)}
                strokeWidth={1.5}
                fill={colorByLabel.get(combo.label)}
                fillOpacity={0.05}
                dot={false}
                legendType="none"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem 1.5rem", marginTop: "0.75rem" }}>
        {byValueDesc.map((combo) => (
          <div key={combo.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: colorByLabel.get(combo.label),
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "0.8rem" }}>{combo.label}</span>
            <span style={{ fontSize: "0.8rem", fontWeight: 650, color: "var(--ink)" }}>
              {formatCompactCurrency(lastValue(combo.series))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
