import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  computeSimulatorComparisonMetrics,
  EXPENSE_HORIZON_AGE,
  findEarliestHouseholdRetirement,
  formatCompactCurrency,
  projectHouseholdNetIncomeByAge,
  projectHouseholdSavingsDrawdownByAge,
  projectHouseholdSocialSecurityByAge,
  projectHouseholdTotalExpensesByAge,
  projectHouseholdWithdrawalIncomeByAge,
  projectSavingsBalance,
  scanRetirementMilestones,
  simpleExpensesToExpenses,
  simpleHouseholdToPerson,
  simpleRetirementAgeOverride,
  type SimpleHousehold,
} from "../calc";
import { ChartCard } from "../chart/ChartCard";
import { AreaGradientDefs } from "../chart/AreaGradient";
import { DEFICIT_COLOR, SURPLUS_COLOR } from "../chart/palette";
import { formatAxisCurrency, formatFullCurrency } from "../chart/format";
import { SIMPLE_SECTION_META } from "./SimpleNav";
import { StatTile } from "./StatTile";

const { Icon } = SIMPLE_SECTION_META.results;

/** Simple mode's single output page: a headline callout, the household's
 * key numbers at its planned retirement age, a scanned spread across
 * common retirement-age milestones (see scanRetirementMilestones), and a
 * surplus/deficit chart — everything Simple mode computes, on one page,
 * mirroring the "one page of outputs" the input page's "one page of
 * inputs" pairs with. */
export function SimpleOutputPage({ household }: { household: SimpleHousehold }) {
  const uid = useId();
  const person = simpleHouseholdToPerson(household);
  const people = [person];
  const expenses = simpleExpensesToExpenses(household);
  const rate = household.withdrawalRate;

  const plannedMetrics = computeSimulatorComparisonMetrics(people, expenses, household.currentAge, rate);
  const earliest = findEarliestHouseholdRetirement(people, expenses, household.currentAge, rate);
  const milestones = scanRetirementMilestones(people, expenses, household.currentAge, rate);

  const combinedSavingsAtRetirement = projectSavingsBalance(person).at(-1)!.balance;
  const currentYear = new Date().getFullYear();
  const earliestAge = earliest.earliestYearsOut !== null ? household.currentAge + earliest.earliestYearsOut : null;

  const overridesByPersonId = simpleRetirementAgeOverride(household.retirementAge);
  const incomeByAge = projectHouseholdNetIncomeByAge(people, household.currentAge, EXPENSE_HORIZON_AGE, overridesByPersonId);
  const withdrawalByAge = projectHouseholdWithdrawalIncomeByAge(people, household.currentAge, EXPENSE_HORIZON_AGE, rate, overridesByPersonId);
  const ssByAge = projectHouseholdSocialSecurityByAge(people, household.currentAge, EXPENSE_HORIZON_AGE, overridesByPersonId);
  const expensesByAge = projectHouseholdTotalExpensesByAge(expenses, household.currentAge, EXPENSE_HORIZON_AGE);
  const savingsByAge = projectHouseholdSavingsDrawdownByAge(
    people,
    household.currentAge,
    EXPENSE_HORIZON_AGE,
    incomeByAge,
    withdrawalByAge,
    ssByAge,
    expensesByAge,
    overridesByPersonId,
  );
  const chartData: Array<{ age: number; Surplus: number; Deficit: number }> = [];
  for (let age = household.currentAge; age <= EXPENSE_HORIZON_AGE; age++) {
    const net =
      (incomeByAge.get(age) ?? 0) +
      (withdrawalByAge.get(age) ?? 0) +
      (ssByAge.get(age) ?? 0) +
      (savingsByAge.get(age) ?? 0) -
      (expensesByAge.get(age) ?? 0);
    chartData.push({ age, Surplus: Math.max(0, net), Deficit: Math.min(0, net) });
  }

  const surplusGradId = `${uid}-simple-surplus`;
  const deficitGradId = `${uid}-simple-deficit`;

  return (
    <section>
      <h2 className="section-title">
        <Icon className="section-title-icon" />
        Results
      </h2>
      <p className="caption">Everything computed from the Household Inputs page.</p>

      <div
        className="card"
        style={{
          marginBottom: "1.5rem",
          borderColor: plannedMetrics.lastsFullHorizon ? "var(--accent-2)" : "var(--danger)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {plannedMetrics.lastsFullHorizon ? (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--accent-2)" }}>On track —</strong> retiring at {household.retirementAge} ({currentYear + (household.retirementAge - household.currentAge)}), income covers expenses every year through age {EXPENSE_HORIZON_AGE}.
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--danger)" }}>Heads up —</strong> retiring at {household.retirementAge} runs out
            of income at age {household.retirementAge + plannedMetrics.yearsOfDraw}, {plannedMetrics.yearsOfDraw} year
            {plannedMetrics.yearsOfDraw === 1 ? "" : "s"} into retirement.
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <StatTile label="Current Age" value={household.currentAge} />
        <StatTile label="Planned Retirement Age" value={household.retirementAge} />
        <StatTile
          label="Earliest Sustainable Age"
          value={earliestAge ?? "None found"}
          help="Earliest age at which income covers expenses through age 85"
        />
        <StatTile label="401(k) Balance at Retirement" value={formatCompactCurrency(plannedMetrics.combinedBalanceAtRetirement)} />
        <StatTile label="Savings Balance at Retirement" value={formatCompactCurrency(combinedSavingsAtRetirement)} />
        <StatTile
          label="Estimated Social Security"
          value={`${formatCompactCurrency(person.socialSecurityMonthly)}/mo`}
          help="Auto-calculated from household income, starting at age 67"
        />
      </div>

      <h3>Retirement Age Milestones</h3>
      <p className="caption" style={{ marginTop: 0 }}>
        How a handful of common retirement ages hold up, given everything entered on the input page.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {milestones.map((m) => (
          <div key={m.age} className="card" style={{ borderColor: m.lastsFullHorizon ? "var(--accent-2)" : "var(--danger)" }}>
            <div className="stat-tile-label">Retire at {m.age}</div>
            <div className="stat-tile-value">{formatCompactCurrency(m.combinedBalanceAtRetirement)}</div>
            <div className="caption" style={{ marginTop: "0.15rem" }}>
              {m.lastsFullHorizon ? "Lasts through 85" : `Runs out at ${m.runsOutAtAge}`}
            </div>
          </div>
        ))}
      </div>

      <ChartCard
        title="Household Surplus / Deficit"
        subtitle="Total income (earned + 401(k) withdrawal + Social Security + savings drawdown) minus total expenses, retiring at the planned age."
        height={280}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
