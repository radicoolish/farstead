import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  projectHouseholdBalanceByAge,
  projectHouseholdNetIncomeByAge,
  projectHouseholdSocialSecurityByAge,
  projectHouseholdTotalExpensesByAge,
  projectHouseholdWithdrawalIncomeByAge,
  type Expense,
  type Person,
  type PersonOverrides,
} from "../calc";
import { ChartCard, ChartGrid } from "../chart/ChartCard";
import { AreaGradientDefs } from "../chart/AreaGradient";
import { DEFICIT_COLOR, SURPLUS_COLOR } from "../chart/palette";
import { formatAxisCurrency, formatFullCurrency } from "../chart/format";

type Row = { age: number } & Record<string, number>;

function SingleAreaChart({ data, dataKey, color, gradId }: { data: Row[]; dataKey: string; color: string; gradId: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <AreaGradientDefs defs={[{ id: gradId, color }]} />
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="age" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} width={52} />
        <Tooltip formatter={(v) => formatFullCurrency(Number(v))} labelFormatter={(age) => `Age ${age}`} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#${gradId})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Six linked charts — Income, Expenses, 401(k) Balance, 401(k)
 * Withdrawal, Social Security, and Surplus/Deficit — off one shared
 * household projection, laid out in a fixed 2-row grid so the whole set
 * stays scannable at a glance. Once a person's earned income stops, their
 * withdrawal income (401(k) balance x withdrawal rate) takes over; Social
 * Security layers in independently once each person reaches their own
 * claim age. Mirrors app.py's render_household_cash_flow_charts, extended
 * with a balance panel the Python version didn't have. */
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
  const uid = useId();
  const incomeByAge = projectHouseholdNetIncomeByAge(people, currentAge, horizonAge, overridesByPersonId);
  const balanceByAge = projectHouseholdBalanceByAge(people, currentAge, horizonAge, withdrawalRatePct, overridesByPersonId);
  const withdrawalByAge = projectHouseholdWithdrawalIncomeByAge(people, currentAge, horizonAge, withdrawalRatePct, overridesByPersonId);
  const ssByAge = projectHouseholdSocialSecurityByAge(people, currentAge, horizonAge, overridesByPersonId);
  const expensesByAge = projectHouseholdTotalExpensesByAge(expenses, currentAge, horizonAge);

  const data: Row[] = [];
  for (let age = currentAge; age <= horizonAge; age++) {
    const income = incomeByAge.get(age) ?? 0;
    const balance = balanceByAge.get(age) ?? 0;
    const withdrawal = withdrawalByAge.get(age) ?? 0;
    const ss = ssByAge.get(age) ?? 0;
    const exp = expensesByAge.get(age) ?? 0;
    const net = income + withdrawal + ss - exp;
    data.push({
      age,
      Income: income,
      Expenses: exp,
      "401k Balance": balance,
      "401k Withdrawal": withdrawal,
      "Social Security": ss,
      Net: net,
      Surplus: Math.max(0, net),
      Deficit: Math.min(0, net),
    });
  }

  const surplusGradId = `${uid}-surplus`;
  const deficitGradId = `${uid}-deficit`;

  return (
    <ChartGrid fixedColumns={3}>
      <ChartCard title="Income" height={260}>
        <SingleAreaChart data={data} dataKey="Income" color="#2563eb" gradId={`${uid}-income`} />
      </ChartCard>
      <ChartCard title="Expenses" height={260}>
        <SingleAreaChart data={data} dataKey="Expenses" color="#64748b" gradId={`${uid}-expenses`} />
      </ChartCard>
      <ChartCard title="401k Balance" height={260}>
        <SingleAreaChart data={data} dataKey="401k Balance" color="#0d9488" gradId={`${uid}-balance`} />
      </ChartCard>
      <ChartCard title="401k Withdrawal" height={260}>
        <SingleAreaChart data={data} dataKey="401k Withdrawal" color="#16a34a" gradId={`${uid}-withdrawal`} />
      </ChartCard>
      <ChartCard title="Social Security" height={260}>
        <SingleAreaChart data={data} dataKey="Social Security" color="#0891b2" gradId={`${uid}-ss`} />
      </ChartCard>
      <ChartCard title="Surplus / Deficit" height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <AreaGradientDefs
              defs={[
                { id: surplusGradId, color: SURPLUS_COLOR },
                { id: deficitGradId, color: DEFICIT_COLOR },
              ]}
            />
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="age" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} width={52} />
            <Tooltip formatter={(v) => formatFullCurrency(Number(v))} labelFormatter={(age) => `Age ${age}`} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Area type="monotone" dataKey="Surplus" stroke={SURPLUS_COLOR} strokeWidth={2} fill={`url(#${surplusGradId})`} dot={false} />
            <Area type="monotone" dataKey="Deficit" stroke={DEFICIT_COLOR} strokeWidth={2} fill={`url(#${deficitGradId})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </ChartGrid>
  );
}
