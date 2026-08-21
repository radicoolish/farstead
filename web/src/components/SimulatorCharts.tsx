import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  projectHouseholdNetIncomeByAge,
  projectHouseholdSavingsDrawdownByAge,
  projectHouseholdSocialSecurityByAge,
  projectHouseholdTotalExpensesByAge,
  projectHouseholdWithdrawalIncomeByAge,
  type Expense,
  type Person,
  type PersonOverrides,
  type WithdrawalRate,
} from "../calc";
import { ChartCard } from "../chart/ChartCard";
import { AreaGradientDefs } from "../chart/AreaGradient";
import { ACTUAL_LINE_COLOR } from "../chart/palette";
import { formatAxisCurrency, formatFullCurrency } from "../chart/format";

type Row = { age: number; Actual: number; Simulated: number };

type ChartKey = "income" | "withdrawal" | "socialSecurity" | "savings" | "surplus";

const CHART_META: Record<ChartKey, { label: string; title: string; subtitle: string; color: string }> = {
  income: {
    label: "Income",
    title: "Income",
    subtitle: "Combined take-home pay, actual vs. simulated, until each person retires.",
    color: "#2563eb",
  },
  withdrawal: {
    label: "401(k) Withdrawal",
    title: "401k Withdrawal",
    subtitle: "After-tax income from 401(k) withdrawals (net of tax and any early-withdrawal penalty), actual vs. simulated.",
    color: "#16a34a",
  },
  socialSecurity: {
    label: "Social Security",
    title: "Social Security",
    subtitle: "Combined after-tax Social Security benefit, actual vs. simulated.",
    color: "#0d9488",
  },
  savings: {
    label: "Savings Drawdown",
    title: "Savings Drawdown",
    subtitle: "General savings drawn down to cover any shortfall, actual vs. simulated.",
    color: "#a855f7",
  },
  surplus: {
    label: "Surplus / Deficit",
    title: "Surplus / Deficit",
    subtitle: "Total income minus total expenses, actual vs. simulated.",
    color: "#16a34a",
  },
};

const CHART_ORDER: ChartKey[] = ["income", "withdrawal", "socialSecurity", "savings", "surplus"];

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

/** Actual-vs-Simulated comparison: one chart at a time (Income, 401(k)
 * Withdrawal, Social Security, Savings Drawdown, Surplus/Deficit), picked
 * via tabs rather than shown all at once — easier to actually read a
 * single line pair than several small charts at a glance. Each shows the
 * household's real, saved projection alongside the freely-edited
 * simulator projection. Expenses aren't simulated (nothing in the
 * Simulator can change them), so unlike HouseholdCashFlowCharts there's no
 * separate Expenses tab — it's folded into the Surplus/Deficit math the
 * same way for both series. No 401k Balance tab here either, since that
 * addition was scoped to the Household Expenses section's actual-data
 * view. */
export function SimulatorCharts({
  people,
  expenses,
  currentAge,
  horizonAge,
  actualWithdrawalRate,
  simWithdrawalRate,
  simOverridesByPersonId,
}: {
  people: Person[];
  expenses: Expense[];
  currentAge: number;
  horizonAge: number;
  actualWithdrawalRate: WithdrawalRate;
  simWithdrawalRate: WithdrawalRate;
  simOverridesByPersonId: Record<string, PersonOverrides>;
}) {
  const uid = useId();
  const [activeChart, setActiveChart] = useState<ChartKey>("income");
  const actualIncome = projectHouseholdNetIncomeByAge(people, currentAge, horizonAge);
  const simIncome = projectHouseholdNetIncomeByAge(people, currentAge, horizonAge, simOverridesByPersonId);
  const actualWithdrawal = projectHouseholdWithdrawalIncomeByAge(people, currentAge, horizonAge, actualWithdrawalRate);
  const simWithdrawal = projectHouseholdWithdrawalIncomeByAge(people, currentAge, horizonAge, simWithdrawalRate, simOverridesByPersonId);
  const actualSs = projectHouseholdSocialSecurityByAge(people, currentAge, horizonAge);
  const simSs = projectHouseholdSocialSecurityByAge(people, currentAge, horizonAge, simOverridesByPersonId);
  const expByAge = projectHouseholdTotalExpensesByAge(expenses, currentAge, horizonAge);
  const actualSavings = projectHouseholdSavingsDrawdownByAge(people, currentAge, horizonAge, actualIncome, actualWithdrawal, actualSs, expByAge);
  const simSavings = projectHouseholdSavingsDrawdownByAge(
    people,
    currentAge,
    horizonAge,
    simIncome,
    simWithdrawal,
    simSs,
    expByAge,
    simOverridesByPersonId,
  );

  const incomeRows: Row[] = [];
  const withdrawalRows: Row[] = [];
  const ssRows: Row[] = [];
  const savingsRows: Row[] = [];
  const surplusRows: Row[] = [];

  for (let age = currentAge; age <= horizonAge; age++) {
    const aInc = actualIncome.get(age) ?? 0;
    const sInc = simIncome.get(age) ?? 0;
    const aWd = actualWithdrawal.get(age) ?? 0;
    const sWd = simWithdrawal.get(age) ?? 0;
    const aSs = actualSs.get(age) ?? 0;
    const sSs = simSs.get(age) ?? 0;
    const aSav = actualSavings.get(age) ?? 0;
    const sSav = simSavings.get(age) ?? 0;
    const exp = expByAge.get(age) ?? 0;

    incomeRows.push({ age, Actual: aInc, Simulated: sInc });
    withdrawalRows.push({ age, Actual: aWd, Simulated: sWd });
    ssRows.push({ age, Actual: aSs, Simulated: sSs });
    savingsRows.push({ age, Actual: aSav, Simulated: sSav });
    surplusRows.push({ age, Actual: aInc + aWd + aSs + aSav - exp, Simulated: sInc + sWd + sSs + sSav - exp });
  }

  const rowsByChart: Record<ChartKey, Row[]> = {
    income: incomeRows,
    withdrawal: withdrawalRows,
    socialSecurity: ssRows,
    savings: savingsRows,
    surplus: surplusRows,
  };
  const meta = CHART_META[activeChart];

  return (
    <div>
      <div className="chart-tabs" role="tablist" aria-label="Simulator chart">
        {CHART_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeChart === key}
            className={activeChart === key ? "primary" : undefined}
            onClick={() => setActiveChart(key)}
          >
            {CHART_META[key].label}
          </button>
        ))}
      </div>
      <ChartCard title={meta.title} subtitle={meta.subtitle} height={340}>
        <DualAreaChart data={rowsByChart[activeChart]} color={meta.color} actualGradId={`${uid}-${activeChart}-a`} simGradId={`${uid}-${activeChart}-s`} />
      </ChartCard>
    </div>
  );
}
