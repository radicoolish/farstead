import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { projectBalance, type Person } from "../calc";
import { PERSON_CHART_PALETTE } from "../chart/palette";
import { AreaGradientDefs, gradientId } from "../chart/AreaGradient";
import { formatAxisCurrency, formatFullCurrency } from "../chart/format";

/** Base + every scenario's balance projection, one filled area each,
 * sharing the person's fixed categorical palette (Base is always the
 * neutral slate). Mirrors the per-person chart in app.py's 401(k)
 * Planner section. */
export function BalanceChart({ person }: { person: Person }) {
  const uid = useId();
  const baseRows = projectBalance(person);
  if (baseRows.length <= 1) {
    return <p className="caption">Retirement age must be greater than current age to project growth.</p>;
  }

  const seriesLabels = ["Base", ...person.scenarios.map((s) => s.name)];
  const rowsByAge = new Map<number, Record<string, number>>();
  for (const row of baseRows) rowsByAge.set(row.age, { age: row.age, Base: row.balance });
  for (const scenario of person.scenarios) {
    const overrides = scenario.field === "incomeChange" ? { incomeChange: scenario.value as never } : { [scenario.field]: scenario.value };
    const rows = projectBalance(person, overrides);
    if (rows.length <= 1) continue;
    for (const row of rows) {
      const existing = rowsByAge.get(row.age);
      if (existing) existing[scenario.name] = row.balance;
    }
  }
  const data = [...rowsByAge.values()].sort((a, b) => a.age - b.age);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <AreaGradientDefs
          defs={seriesLabels.map((label, i) => ({
            id: gradientId(uid, label),
            color: PERSON_CHART_PALETTE[i % PERSON_CHART_PALETTE.length],
          }))}
        />
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="age" tick={{ fontSize: 12 }} label={{ value: "Age", position: "insideBottom", offset: -2, fontSize: 12 }} />
        <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 12 }} width={56} />
        <Tooltip formatter={(value) => formatFullCurrency(Number(value))} labelFormatter={(age) => `Age ${age}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {seriesLabels.map((label, i) => {
          const color = PERSON_CHART_PALETTE[i % PERSON_CHART_PALETTE.length];
          return (
            <Area
              key={label}
              type="monotone"
              dataKey={label}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId(uid, label)})`}
              dot={false}
              connectNulls
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}
