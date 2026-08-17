import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type { HouseholdCombo } from "../calc";
import { greenPalette } from "../chart/palette";
import { formatAxisCurrency, formatFullCurrency } from "../chart/format";

function lastValue(series: Map<number, number>): number {
  return [...series.values()][series.size - 1];
}

/** Line chart (every combo's balance by year) + bar chart (final balance
 * per combo, highest first), both colored by final projected value —
 * darker green means a higher balance, not list order. Mirrors app.py's
 * render_household_combinations / render_household_combo_bars. */
export function HouseholdComboChart({ combos, totalCombos }: { combos: HouseholdCombo[]; totalCombos: number }) {
  const byValueAsc = [...combos].sort((a, b) => lastValue(a.series) - lastValue(b.series));
  const shades = greenPalette(byValueAsc.length);
  const colorByLabel = new Map(byValueAsc.map((c, i) => [c.label, shades[i]]));

  const allYears = new Set<number>();
  for (const combo of combos) for (const year of combo.series.keys()) allYears.add(year);
  const years = [...allYears].sort((a, b) => a - b);
  const lineData = years.map((year) => {
    const row: Record<string, number> = { year };
    for (const combo of combos) row[combo.label] = combo.series.get(year) ?? 0;
    return row;
  });

  const barData = [...combos]
    .map((c) => ({ label: c.label, balance: lastValue(c.series) }))
    .sort((a, b) => b.balance - a.balance);

  return (
    <div>
      <p style={{ fontWeight: 650 }}>All Scenario Combinations ({totalCombos})</p>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: "1rem" }}>
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} width={52} />
              <Tooltip formatter={(v) => formatFullCurrency(Number(v))} />
              {combos.map((combo) => (
                <Line
                  key={combo.label}
                  type="monotone"
                  dataKey={combo.label}
                  stroke={colorByLabel.get(combo.label)}
                  strokeWidth={1.5}
                  dot={false}
                  legendType="none"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={false} />
              <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} width={52} />
              <Tooltip formatter={(v) => formatFullCurrency(Number(v))} />
              <Bar dataKey="balance">
                {barData.map((d) => (
                  <Cell key={d.label} fill={colorByLabel.get(d.label)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.4rem 1rem", marginTop: "0.5rem" }}>
        {combos.map((combo) => (
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
          </div>
        ))}
      </div>
    </div>
  );
}
