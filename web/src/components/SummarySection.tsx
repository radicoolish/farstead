import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  averageOverRange,
  calculateAge,
  EXPENSE_HORIZON_AGE,
  formatCompactCurrency,
  householdRetirementBoundaryAge,
  projectBalance,
  projectHouseholdNetIncomeByAge,
  projectHouseholdSocialSecurityByAge,
  projectHouseholdTotalExpensesByAge,
  projectHouseholdWithdrawalIncomeByAge,
} from "../calc";
import { useAppData } from "../state/AppDataContext";
import { resolveWithdrawalRate } from "../state/withdrawalRate";
import { SECTION_META } from "./AppNav";
import { HouseholdRetirementPanel } from "./HouseholdRetirementPanel";
import { StatTile } from "./StatTile";
import { ChartCard } from "../chart/ChartCard";
import { AreaGradientDefs } from "../chart/AreaGradient";
import { DEFICIT_COLOR, SURPLUS_COLOR } from "../chart/palette";
import { formatAxisCurrency, formatFullCurrency } from "../chart/format";

const { Icon } = SECTION_META.summary;

type Period = "total" | "preRetirement" | "retirement";

const PERIOD_META: Record<Period, { label: string; help: string }> = {
  total: { label: "Total", help: "averaged over the full projection" },
  preRetirement: { label: "Pre-Retirement", help: "averaged over the working years" },
  retirement: { label: "Retirement", help: "averaged over the retirement years" },
};

/** The capstone of the linear flow: a recap of everything entered across
 * Income, 401(k), and Expenses, in headline numbers rather than
 * re-showing the full 6-chart cash-flow grid (that stays the detailed
 * view, in the Expenses section). Sits between Expenses and Simulator —
 * after data entry, before free-form exploration.
 *
 * Income/Withdrawal/Social Security/Expenses are all period-averaged
 * (Total / Pre-Retirement / Retirement) rather than a single "today"
 * snapshot, since each of those shifts a lot over the horizon — earned
 * income stops at retirement while withdrawal and Social Security start,
 * loans fall off, inflation compounds. The retirement boundary is the
 * earliest retirement age across the household (unambiguous for one
 * person; the point household dynamics first start shifting for more
 * than one). Balance figures stay point-in-time regardless of the
 * period, since a balance is a stock, not a flow — "average balance
 * during a period" isn't a meaningful figure the way average income is. */
export function SummarySection() {
  const { people, expenses, currentAge, withdrawalRate } = useAppData();
  const uid = useId();
  const [period, setPeriod] = useState<Period>("total");

  if (people.length === 0) {
    return (
      <section>
        <h2 className="section-title">
          <Icon className="section-title-icon" />
          When Can I Retire?
        </h2>
        <p className="caption">Add someone in the Income section to find your earliest sustainable retirement year.</p>
      </section>
    );
  }

  const combinedBalance = people.reduce((sum, p) => sum + p.currentBalance, 0);
  const combinedProjectedBalance = people.reduce((sum, p) => {
    const rows = projectBalance(p);
    return sum + rows[rows.length - 1].balance;
  }, 0);

  // The retirement-age year itself still counts as a working year in the
  // underlying income projection (earned income stops the year *after*
  // retirementAge, matching how withdrawals only start the year after
  // too) — so Pre-Retirement includes that transition year, and
  // Retirement starts the year following it, to avoid a small "still
  // earning" artifact bleeding into the Retirement average.
  const retirementBoundary = householdRetirementBoundaryAge(people);
  const preRetirementEnd = retirementBoundary;
  const retirementStart = retirementBoundary + 1;
  const hasPreRetirementPeriod = preRetirementEnd >= currentAge;
  const hasRetirementPeriod = Math.max(retirementStart, currentAge) <= EXPENSE_HORIZON_AGE;

  const [rangeStart, rangeEnd] =
    period === "preRetirement" && hasPreRetirementPeriod
      ? [currentAge, preRetirementEnd]
      : period === "retirement" && hasRetirementPeriod
        ? [Math.max(retirementStart, currentAge), EXPENSE_HORIZON_AGE]
        : [currentAge, EXPENSE_HORIZON_AGE];

  const incomeByAge = projectHouseholdNetIncomeByAge(people, currentAge, EXPENSE_HORIZON_AGE);
  const withdrawalByAge = projectHouseholdWithdrawalIncomeByAge(people, currentAge, EXPENSE_HORIZON_AGE, resolveWithdrawalRate(withdrawalRate));
  const ssByAge = projectHouseholdSocialSecurityByAge(people, currentAge, EXPENSE_HORIZON_AGE);
  const expensesByAge = projectHouseholdTotalExpensesByAge(expenses, currentAge, EXPENSE_HORIZON_AGE);

  const avgEarned = averageOverRange(incomeByAge, rangeStart, rangeEnd);
  const avgWithdrawal = averageOverRange(withdrawalByAge, rangeStart, rangeEnd);
  const avgSocialSecurity = averageOverRange(ssByAge, rangeStart, rangeEnd);
  const avgTotalIncome = avgEarned + avgWithdrawal + avgSocialSecurity;
  const avgExpenses = averageOverRange(expensesByAge, rangeStart, rangeEnd);

  const data: Array<{ age: number; Surplus: number; Deficit: number }> = [];
  let firstDeficitAge: number | null = null;
  for (let age = currentAge; age <= EXPENSE_HORIZON_AGE; age++) {
    const net = (incomeByAge.get(age) ?? 0) + (withdrawalByAge.get(age) ?? 0) + (ssByAge.get(age) ?? 0) - (expensesByAge.get(age) ?? 0);
    if (net < 0 && firstDeficitAge === null) firstDeficitAge = age;
    data.push({ age, Surplus: Math.max(0, net), Deficit: Math.min(0, net) });
  }

  const surplusGradId = `${uid}-summary-surplus`;
  const deficitGradId = `${uid}-summary-deficit`;
  const periodSuffix = ` (${PERIOD_META[period].help})`;

  return (
    <section>
      <h2 className="section-title">
        <Icon className="section-title-icon" />
        When Can I Retire?
      </h2>
      <p className="caption">
        Using your saved Income, 401(k), and Expenses assumptions — pick a scenario per person below, or see the
        Simulator to freely test other changes.
      </p>

      <HouseholdRetirementPanel people={people} expenses={expenses} currentAge={currentAge} withdrawalRate={resolveWithdrawalRate(withdrawalRate)} />

      <h3>Full Household Summary</h3>
      <p className="caption" style={{ marginTop: 0 }}>
        The big picture across Income, 401(k), and Expenses at your actual saved settings.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "1rem 0" }}>
        {(Object.keys(PERIOD_META) as Period[]).map((key) => {
          const disabled = (key === "preRetirement" && !hasPreRetirementPeriod) || (key === "retirement" && !hasRetirementPeriod);
          return (
            <button
              key={key}
              type="button"
              className={period === key ? "primary" : undefined}
              disabled={disabled}
              onClick={() => setPeriod(key)}
              title={disabled ? "Not applicable — no years fall in this period" : undefined}
              style={{ whiteSpace: "nowrap" }}
            >
              {PERIOD_META[key].label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <StatTile label="Household Size" value={`${people.length} ${people.length === 1 ? "person" : "people"}`} />
        <StatTile label="Combined 401(k) Balance" value={formatCompactCurrency(combinedBalance)} help="Today" />
        <StatTile
          label="Projected at Retirement"
          value={formatCompactCurrency(combinedProjectedBalance)}
          help="Combined 401(k) balance at each person's own retirement age"
        />
        <StatTile label="Combined Earned Income" value={`${formatCompactCurrency(avgEarned)}/yr`} help={`Salary income only${periodSuffix}`} />
        <StatTile
          label="Combined 401(k) Withdrawal"
          value={`${formatCompactCurrency(avgWithdrawal)}/yr`}
          help={`401(k) withdrawal income${periodSuffix}`}
        />
        <StatTile
          label="Combined Social Security"
          value={`${formatCompactCurrency(avgSocialSecurity)}/yr`}
          help={`Social Security income${periodSuffix}`}
        />
        <StatTile
          label="Combined Total Income"
          value={`${formatCompactCurrency(avgTotalIncome)}/yr`}
          help={`Earned + 401(k) Withdrawal + Social Security${periodSuffix}`}
        />
        <StatTile label="Combined Expenses" value={`${formatCompactCurrency(avgExpenses)}/yr`} help={`All household expenses${periodSuffix}`} />
      </div>

      <div
        className="card"
        style={{
          marginBottom: "1.5rem",
          borderColor: firstDeficitAge ? "var(--danger)" : "var(--accent-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {firstDeficitAge ? (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--danger)" }}>Heads up —</strong> at your current assumptions, household expenses
            first exceed income (including 401(k) withdrawals and Social Security) at <strong>age {firstDeficitAge}</strong>.
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--accent-2)" }}>On track —</strong> income covers expenses every year through age{" "}
            {EXPENSE_HORIZON_AGE} at your current assumptions.
          </p>
        )}
      </div>

      <h3>People</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {people.map((person) => {
          const rows = projectBalance(person);
          const finalBalance = rows[rows.length - 1].balance;
          return (
            <div key={person.id} className="card card-row">
              <div>
                <strong>{person.name}</strong>{" "}
                <span className="caption">
                  — Age {calculateAge(person.birthday)}, retires at {person.retirementAge}
                </span>
              </div>
              <div className="caption">
                {formatCompactCurrency(person.currentBalance)} today <strong style={{ color: "var(--ink)" }}>→ {formatCompactCurrency(finalBalance)}</strong> at retirement
              </div>
            </div>
          );
        })}
      </div>

      <ChartCard
        title="Household Surplus / Deficit"
        subtitle="Total income (earned + 401(k) withdrawal + Social Security) minus total expenses, by age."
        height={280}
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
    </section>
  );
}
