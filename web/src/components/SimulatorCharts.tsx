import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import { ACTUAL_LINE_COLOR } from "../chart/palette";
import { formatAxisCurrency, formatFullCurrency } from "../chart/format";

type Row = { age: number; Actual: number; Simulated: number };

function DualLineChart({ data, color }: { data: Row[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="age" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} width={52} />
        <Tooltip formatter={(v) => formatFullCurrency(Number(v))} labelFormatter={(age) => `Age ${age}`} />
        <Line type="monotone" dataKey="Actual" stroke={ACTUAL_LINE_COLOR} strokeWidth={2} strokeDasharray="5 4" dot={false} />
        <Line type="monotone" dataKey="Simulated" stroke={color} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Actual-vs-Simulated comparison: four panels (Income, 401(k) Withdrawal,
 * Social Security, Surplus/Deficit) each showing the household's real,
 * saved projection alongside the freely-edited simulator projection.
 * Expenses aren't simulated (nothing in the Simulator can change them), so
 * unlike HouseholdCashFlowCharts there's no separate Expenses panel — it's
 * folded into the Surplus/Deficit math the same way for both series.
 * Mirrors app.py's render_simulator_charts. */
export function SimulatorCharts({
  people,
  expenses,
  currentAge,
  horizonAge,
  actualWithdrawalRatePct,
  simWithdrawalRatePct,
  simOverridesByPersonId,
}: {
  people: Person[];
  expenses: Expense[];
  currentAge: number;
  horizonAge: number;
  actualWithdrawalRatePct: number;
  simWithdrawalRatePct: number;
  simOverridesByPersonId: Record<string, PersonOverrides>;
}) {
  const actualIncome = projectHouseholdNetIncomeByAge(people, currentAge, horizonAge);
  const simIncome = projectHouseholdNetIncomeByAge(people, currentAge, horizonAge, simOverridesByPersonId);
  const actualWithdrawal = projectHouseholdWithdrawalIncomeByAge(people, currentAge, horizonAge, actualWithdrawalRatePct);
  const simWithdrawal = projectHouseholdWithdrawalIncomeByAge(people, currentAge, horizonAge, simWithdrawalRatePct, simOverridesByPersonId);
  const actualSs = projectHouseholdSocialSecurityByAge(people, currentAge, horizonAge);
  const simSs = projectHouseholdSocialSecurityByAge(people, currentAge, horizonAge, simOverridesByPersonId);
  const expByAge = projectHouseholdTotalExpensesByAge(expenses, currentAge, horizonAge);

  const incomeRows: Row[] = [];
  const withdrawalRows: Row[] = [];
  const ssRows: Row[] = [];
  const surplusRows: Row[] = [];

  for (let age = currentAge; age <= horizonAge; age++) {
    const aInc = actualIncome.get(age) ?? 0;
    const sInc = simIncome.get(age) ?? 0;
    const aWd = actualWithdrawal.get(age) ?? 0;
    const sWd = simWithdrawal.get(age) ?? 0;
    const aSs = actualSs.get(age) ?? 0;
    const sSs = simSs.get(age) ?? 0;
    const exp = expByAge.get(age) ?? 0;

    incomeRows.push({ age, Actual: aInc, Simulated: sInc });
    withdrawalRows.push({ age, Actual: aWd, Simulated: sWd });
    ssRows.push({ age, Actual: aSs, Simulated: sSs });
    surplusRows.push({ age, Actual: aInc + aWd + aSs - exp, Simulated: sInc + sWd + sSs - exp });
  }

  return (
    <ChartGrid>
      <ChartCard title="Income">
        <DualLineChart data={incomeRows} color="#2563eb" />
      </ChartCard>
      <ChartCard title="401k Withdrawal">
        <DualLineChart data={withdrawalRows} color="#7c3aed" />
      </ChartCard>
      <ChartCard title="Social Security">
        <DualLineChart data={ssRows} color="#0891b2" />
      </ChartCard>
      <ChartCard title="Surplus / Deficit">
        <DualLineChart data={surplusRows} color="#1a7f37" />
      </ChartCard>
    </ChartGrid>
  );
}
