import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { buildExpenseChartData, EXPENSE_TYPES, type Expense } from "../calc";
import { EXPENSE_PALETTE } from "../chart/palette";
import { formatAxisCurrency, formatFullCurrency } from "../chart/format";

/** Stacked bar chart of every expense's annual cost by age, grouped by
 * type. Mirrors app.py's Projected Household Expenses chart. */
export function ExpenseChart({
  expenses,
  currentAge,
  horizonAge,
}: {
  expenses: Expense[];
  currentAge: number;
  horizonAge: number;
}) {
  const data = buildExpenseChartData(expenses, currentAge, horizonAge);
  const typesPresent = EXPENSE_TYPES.filter((type) => data.some((row) => row[type] !== undefined));

  if (typesPresent.length === 0) {
    return <p className="caption">No active expenses in the selected age range.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="age" tick={{ fontSize: 12 }} label={{ value: "Age", position: "insideBottom", offset: -2, fontSize: 12 }} />
        <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 12 }} width={56} />
        <Tooltip formatter={(v) => formatFullCurrency(Number(v))} labelFormatter={(age) => `Age ${age}`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {typesPresent.map((type) => (
          <Bar key={type} dataKey={type} stackId="expenses" fill={EXPENSE_PALETTE[type]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
