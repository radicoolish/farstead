import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  projectHouseholdBalanceByAge,
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

type ChartKey = "income" | "expenses" | "balance" | "withdrawal" | "socialSecurity" | "savings" | "surplus";

const SIMPLE_CHART_META: Record<Exclude<ChartKey, "surplus">, { label: string; dataKey: string; subtitle: string; color: string }> = {
  income: {
    label: "Income",
    dataKey: "Income",
    subtitle: "Combined take-home pay, after tax and 401(k) contributions, until each person retires.",
    color: "#2563eb",
  },
  expenses: {
    label: "Expenses",
    dataKey: "Expenses",
    subtitle: "Total household spending across every recurring cost and loan.",
    color: "#64748b",
  },
  balance: {
    label: "401(k) Balance",
    dataKey: "401k Balance",
    subtitle: "Combined 401(k) balance — growing pre-retirement, drawn down after.",
    color: "#0d9488",
  },
  withdrawal: {
    label: "401(k) Withdrawal",
    dataKey: "401k Withdrawal",
    subtitle: "After-tax income from 401(k) withdrawals, once earned income stops — net of income tax, plus the 10% early-withdrawal penalty before age 60.",
    color: "#16a34a",
  },
  socialSecurity: {
    label: "Social Security",
    dataKey: "Social Security",
    subtitle: "Combined after-tax benefit once each person reaches their own claim age — 85% of the benefit is taxed at their Effective Tax Rate.",
    color: "#0891b2",
  },
  savings: {
    label: "Savings Drawdown",
    dataKey: "Savings Drawdown",
    subtitle: "General savings drawn down to cover any shortfall — a backstop available at any age, not a fixed withdrawal like the 401(k).",
    color: "#a855f7",
  },
};

const CHART_ORDER: Array<{ key: ChartKey; label: string }> = [
  { key: "income", label: "Income" },
  { key: "expenses", label: "Expenses" },
  { key: "balance", label: "401(k) Balance" },
  { key: "withdrawal", label: "401(k) Withdrawal" },
  { key: "socialSecurity", label: "Social Security" },
  { key: "savings", label: "Savings Drawdown" },
  { key: "surplus", label: "Surplus / Deficit" },
];

/** Seven linked charts — Income, Expenses, 401(k) Balance, 401(k)
 * Withdrawal, Social Security, Savings Drawdown, and Surplus/Deficit — off
 * one shared household projection. Picked one at a time via a dropdown
 * rather than shown all at once, since several small charts side by side
 * made any single one harder to actually read. Once a person's earned
 * income stops, their withdrawal income (401(k) balance x withdrawal
 * rate) takes over; Social Security layers in independently once each
 * person reaches their own claim age; savings drawdown is a backstop,
 * covering whatever shortfall (if any) remains after those three. */
export function HouseholdCashFlowCharts({
  people,
  expenses,
  currentAge,
  horizonAge,
  withdrawalRate,
  overridesByPersonId,
}: {
  people: Person[];
  expenses: Expense[];
  currentAge: number;
  horizonAge: number;
  withdrawalRate: WithdrawalRate;
  overridesByPersonId?: Record<string, PersonOverrides>;
}) {
  const uid = useId();
  const [activeChart, setActiveChart] = useState<ChartKey>("income");
  const incomeByAge = projectHouseholdNetIncomeByAge(people, currentAge, horizonAge, overridesByPersonId);
  const balanceByAge = projectHouseholdBalanceByAge(people, currentAge, horizonAge, withdrawalRate, overridesByPersonId);
  const withdrawalByAge = projectHouseholdWithdrawalIncomeByAge(people, currentAge, horizonAge, withdrawalRate, overridesByPersonId);
  const ssByAge = projectHouseholdSocialSecurityByAge(people, currentAge, horizonAge, overridesByPersonId);
  const expensesByAge = projectHouseholdTotalExpensesByAge(expenses, currentAge, horizonAge);
  const savingsByAge = projectHouseholdSavingsDrawdownByAge(
    people,
    currentAge,
    horizonAge,
    incomeByAge,
    withdrawalByAge,
    ssByAge,
    expensesByAge,
    overridesByPersonId,
  );

  const data: Row[] = [];
  for (let age = currentAge; age <= horizonAge; age++) {
    const income = incomeByAge.get(age) ?? 0;
    const balance = balanceByAge.get(age) ?? 0;
    const withdrawal = withdrawalByAge.get(age) ?? 0;
    const ss = ssByAge.get(age) ?? 0;
    const savings = savingsByAge.get(age) ?? 0;
    const exp = expensesByAge.get(age) ?? 0;
    const net = income + withdrawal + ss + savings - exp;
    data.push({
      age,
      Income: income,
      Expenses: exp,
      "401k Balance": balance,
      "401k Withdrawal": withdrawal,
      "Social Security": ss,
      "Savings Drawdown": savings,
      Net: net,
      Surplus: Math.max(0, net),
      Deficit: Math.min(0, net),
    });
  }

  const surplusGradId = `${uid}-surplus`;
  const deficitGradId = `${uid}-deficit`;

  return (
    <div>
      <div className="field" style={{ maxWidth: 280, marginBottom: "1rem" }}>
        <label htmlFor={`${uid}-chart-select`}>Chart</label>
        <select id={`${uid}-chart-select`} value={activeChart} onChange={(e) => setActiveChart(e.target.value as ChartKey)}>
          {CHART_ORDER.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {activeChart === "surplus" ? (
        <ChartCard
          title="Surplus / Deficit"
          subtitle="Total income (including any savings drawdown) minus total expenses — negative means expenses win that year."
          height={320}
        >
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
      ) : (
        (() => {
          const meta = SIMPLE_CHART_META[activeChart];
          return (
            <ChartCard title={meta.label} subtitle={meta.subtitle} height={320}>
              <SingleAreaChart data={data} dataKey={meta.dataKey} color={meta.color} gradId={`${uid}-${activeChart}`} />
            </ChartCard>
          );
        })()
      )}
    </div>
  );
}
