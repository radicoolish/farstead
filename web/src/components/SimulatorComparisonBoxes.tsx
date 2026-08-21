import type { ReactNode } from "react";
import {
  computeSimulatorComparisonMetrics,
  formatCompactCurrency,
  type Expense,
  type Person,
  type PersonOverrides,
  type SimulatorComparisonMetrics,
  type WithdrawalRate,
} from "../calc";

function formatYears(metrics: SimulatorComparisonMetrics): string {
  return `${metrics.yearsOfDraw}${metrics.lastsFullHorizon ? "+" : ""} yrs`;
}

function DeltaLine({ diff, unit }: { diff: number; unit: "currency" | "years" }) {
  if (diff === 0) {
    return <div className="caption">Same as actual</div>;
  }
  const isBetter = diff > 0;
  const formatted = unit === "currency" ? formatCompactCurrency(Math.abs(diff)) : `${Math.abs(diff)} yrs`;
  return (
    <div style={{ fontSize: "0.78rem", fontWeight: 650, color: isBetter ? "var(--success)" : "var(--danger)" }}>
      {isBetter ? "▲" : "▼"} {formatted} {isBetter ? "better" : "worse"}
    </div>
  );
}

function ComparisonBox({ label, value, help, delta }: { label: string; value: string; help?: string; delta?: ReactNode }) {
  return (
    <div className="card" title={help}>
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      {delta}
    </div>
  );
}

/** The Simulator's headline Actual-vs-Simulated comparison, at a glance:
 * combined 401(k) balance at retirement, and how many years the household's
 * retirement income (withdrawal + Social Security + savings drawdown + any
 * earned income) keeps up with expenses before falling short ("years of
 * draw"), for both the saved household and the freely-edited simulated
 * one. The Simulated
 * box in each pair carries the Better/Worse delta against its Actual
 * counterpart; the charts below tell the same story over time instead of
 * as a single number. */
export function SimulatorComparisonBoxes({
  people,
  expenses,
  currentAge,
  actualWithdrawalRate,
  simWithdrawalRate,
  simOverridesByPersonId,
}: {
  people: Person[];
  expenses: Expense[];
  currentAge: number;
  actualWithdrawalRate: WithdrawalRate;
  simWithdrawalRate: WithdrawalRate;
  simOverridesByPersonId: Record<string, PersonOverrides>;
}) {
  const actual = computeSimulatorComparisonMetrics(people, expenses, currentAge, actualWithdrawalRate);
  const sim = computeSimulatorComparisonMetrics(people, expenses, currentAge, simWithdrawalRate, simOverridesByPersonId);

  const balanceDiff = sim.combinedBalanceAtRetirement - actual.combinedBalanceAtRetirement;
  const yearsDiff = sim.yearsOfDraw - actual.yearsOfDraw;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
      <ComparisonBox
        label="401(k) Balance at Retirement — Actual"
        value={formatCompactCurrency(actual.combinedBalanceAtRetirement)}
        help="Combined balance at each person's own retirement age, from your saved data"
      />
      <ComparisonBox
        label="401(k) Balance at Retirement — Simulated"
        value={formatCompactCurrency(sim.combinedBalanceAtRetirement)}
        help="Combined balance at each person's own (possibly simulated) retirement age"
        delta={<DeltaLine diff={balanceDiff} unit="currency" />}
      />
      <ComparisonBox
        label="Years of Draw — Actual"
        value={formatYears(actual)}
        help={
          actual.lastsFullHorizon
            ? "Income covers expenses all the way through age 85 in your saved data"
            : "Years from retirement until expenses first outpace income, in your saved data"
        }
      />
      <ComparisonBox
        label="Years of Draw — Simulated"
        value={formatYears(sim)}
        help={
          sim.lastsFullHorizon
            ? "Income covers expenses all the way through age 85 in this simulated scenario"
            : "Years from retirement until expenses first outpace income, in this simulated scenario"
        }
        delta={<DeltaLine diff={yearsDiff} unit="years" />}
      />
    </div>
  );
}
