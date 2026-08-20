import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import { AreaGradientDefs } from "../chart/AreaGradient";
import { ACTUAL_LINE_COLOR } from "../chart/palette";
import { formatAxisCurrency, formatFullCurrency } from "../chart/format";

type Row = { age: number; Actual: number; Simulated: number };

function DualAreaChart({ data, color, actualGradId, simGradId }: { data: Row[]; color: string; actualGradId: string; simGradId: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <AreaGradientDefs
          defs={[
            { id: actualGradId, color: ACTUAL_LINE_COLOR },
            { id: simGradId, color },
          ]}
        />
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="age" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} width={52} />
        <Tooltip formatter={(v) => formatFullCurrency(Number(v))} labelFormatter={(age) => `Age ${age}`} />
        <Area
          type="monotone"
          dataKey="Actual"
          stroke={ACTUAL_LINE_COLOR}
          strokeWidth={2}
          strokeDasharray="5 4"
          fill={`url(#${actualGradId})`}
          dot={false}
        />
        <Area type="monotone" dataKey="Simulated" stroke={color} strokeWidth={2.5} fill={`url(#${simGradId})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Actual-vs-Simulated comparison: four panels (Income, 401(k) Withdrawal,
 * Social Security, Surplus/Deficit) each showing the household's real,
 * saved projection alongside the freely-edited simulator projection.
 * Expenses aren't simulated (nothing in the Simulator can change them), so
 * unlike HouseholdCashFlowCharts there's no separate Expenses panel — it's
 * folded into the Surplus/Deficit math the same way for both series. Kept
 * to these four panels (no 401k Balance panel) since that addition was
 * scoped to the Household Expenses section's actual-data view. Mirrors
 * app.py's render_simulator_charts. */
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
  const uid = useId();
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
        <DualAreaChart data={incomeRows} color="#2563eb" actualGradId={`${uid}-inc-a`} simGradId={`${uid}-inc-s`} />
      </ChartCard>
      <ChartCard title="401k Withdrawal">
        <DualAreaChart data={withdrawalRows} color="#16a34a" actualGradId={`${uid}-wd-a`} simGradId={`${uid}-wd-s`} />
      </ChartCard>
      <ChartCard title="Social Security">
        <DualAreaChart data={ssRows} color="#0d9488" actualGradId={`${uid}-ss-a`} simGradId={`${uid}-ss-s`} />
      </ChartCard>
      <ChartCard title="Surplus / Deficit">
        <DualAreaChart data={surplusRows} color="#16a34a" actualGradId={`${uid}-sur-a`} simGradId={`${uid}-sur-s`} />
      </ChartCard>
    </ChartGrid>
  );
}
