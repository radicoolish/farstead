import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  projectHouseholdNetIncomeByAge,
  projectHouseholdSocialSecurityByAge,
  projectHouseholdTotalExpensesByAge,
  projectHouseholdWithdrawalIncomeByAge,
  type Expense,
  type Person,
  type PersonOverrides,
} from "../calc";
import { ChartCard, ChartGrid } from "../chart/ChartCard";
import { DEFICIT_COLOR, SURPLUS_COLOR } from "../chart/palette";
import { formatAxisCurrency, formatFullCurrency } from "../chart/format";

function SingleLineChart({ data, dataKey, color }: { data: Array<{ age: number } & Record<string, number>>; dataKey: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="age" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} width={52} />
        <Tooltip formatter={(v) => formatFullCurrency(Number(v))} labelFormatter={(age) => `Age ${age}`} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Five linked charts — Income, Expenses, 401(k) Withdrawal, Social
 * Security, and Surplus/Deficit — off one shared household projection.
 * Once a person's earned income stops, their withdrawal income (401(k)
 * balance x withdrawal rate) takes over; Social Security layers in
 * independently once each person reaches their own claim age. Mirrors
 * app.py's render_household_cash_flow_charts. */
export function HouseholdCashFlowCharts({
  people,
  expenses,
  currentAge,
  horizonAge,
  withdrawalRatePct,
  overridesByPersonId,
}: {
  people: Person[];
  expenses: Expense[];
  currentAge: number;
  horizonAge: number;
  withdrawalRatePct: number;
  overridesByPersonId?: Record<string, PersonOverrides>;
}) {
  const incomeByAge = projectHouseholdNetIncomeByAge(people, currentAge, horizonAge, overridesByPersonId);
  const withdrawalByAge = projectHouseholdWithdrawalIncomeByAge(people, currentAge, horizonAge, withdrawalRatePct, overridesByPersonId);
  const ssByAge = projectHouseholdSocialSecurityByAge(people, currentAge, horizonAge, overridesByPersonId);
  const expensesByAge = projectHouseholdTotalExpensesByAge(expenses, currentAge, horizonAge);

  const data = [];
  for (let age = currentAge; age <= horizonAge; age++) {
    const income = incomeByAge.get(age) ?? 0;
    const withdrawal = withdrawalByAge.get(age) ?? 0;
    const ss = ssByAge.get(age) ?? 0;
    const exp = expensesByAge.get(age) ?? 0;
    data.push({
      age,
      Income: income,
      Expenses: exp,
      "401k Withdrawal": withdrawal,
      "Social Security": ss,
      Net: income + withdrawal + ss - exp,
    });
  }

  return (
    <div>
      <ChartGrid>
        <ChartCard title="Income">
          <SingleLineChart data={data} dataKey="Income" color="#2563eb" />
        </ChartCard>
        <ChartCard title="Expenses">
          <SingleLineChart data={data} dataKey="Expenses" color="#64748b" />
        </ChartCard>
        <ChartCard title="401k Withdrawal">
          <SingleLineChart data={data} dataKey="401k Withdrawal" color="#16a34a" />
        </ChartCard>
        <ChartCard title="Social Security">
          <SingleLineChart data={data} dataKey="Social Security" color="#0d9488" />
        </ChartCard>
      </ChartGrid>
      <div style={{ marginTop: "1rem" }}>
        <ChartCard title="Surplus / Deficit" height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="age" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} width={52} />
              <Tooltip formatter={(v) => formatFullCurrency(Number(v))} labelFormatter={(age) => `Age ${age}`} />
              <Bar dataKey="Net">
                {data.map((d) => (
                  <Cell key={d.age} fill={d.Net >= 0 ? SURPLUS_COLOR : DEFICIT_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
