import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  EXPENSE_HORIZON_AGE,
  findEarliestHouseholdRetirement,
  formatCompactCurrency,
  personScenarioOptions,
  projectBalance,
  projectHouseholdNetIncomeByAge,
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
import { StatTile } from "./StatTile";

/** The household-level "when can we retire?" answer: for each person, a
 * dropdown to pick their saved 401(k) scenario (Base by default) feeds
 * `findEarliestHouseholdRetirement`, which searches for the earliest
 * shared target year everyone could retire simultaneously. One combined
 * answer for the whole household, not one person switched at a time. */
export function HouseholdRetirementPanel({
  people,
  expenses,
  currentAge,
  withdrawalRate,
}: {
  people: Person[];
  expenses: Expense[];
  currentAge: number;
  withdrawalRate: WithdrawalRate;
}) {
  const uid = useId();
  const [scenarioLabelByPersonId, setScenarioLabelByPersonId] = useState<Record<string, string>>({});

  if (people.length === 0) return null;

  const scenarioOptionsByPersonId = new Map(people.map((p) => [p.id, personScenarioOptions(p)]));
  const scenarioOverridesByPersonId: Record<string, PersonOverrides> = {};
  for (const person of people) {
    const label = scenarioLabelByPersonId[person.id] ?? "Base";
    const options = scenarioOptionsByPersonId.get(person.id)!;
    scenarioOverridesByPersonId[person.id] = options.find(([optionLabel]) => optionLabel === label)?.[1] ?? {};
  }

  const result = findEarliestHouseholdRetirement(people, expenses, currentAge, withdrawalRate, scenarioOverridesByPersonId);
  const isHousehold = people.length > 1;
  const currentYear = new Date().getFullYear();
  const targetYear = result.earliestYearsOut !== null ? currentYear + result.earliestYearsOut : null;
  const plannedYear = currentYear + result.plannedYearsOut;

  const combinedBalanceThen =
    result.earliestYearsOut !== null
      ? people.reduce((sum, person) => {
          const overrides = { ...scenarioOverridesByPersonId[person.id], retirementAge: result.resultingAgeByPersonId[person.id] };
          const rows = projectBalance(person, overrides, new Date());
          return sum + rows[rows.length - 1].balance;
        }, 0)
      : null;

  const resultingAgesText = people.map((p) => `${p.name}: ${result.resultingAgeByPersonId[p.id]}`).join(" · ");

  let chartData: Array<{ age: number; Surplus: number; Deficit: number }> | null = null;
  if (result.earliestYearsOut !== null) {
    const overridesByPersonId: Record<string, PersonOverrides> = {};
    for (const person of people) {
      overridesByPersonId[person.id] = { ...scenarioOverridesByPersonId[person.id], retirementAge: result.resultingAgeByPersonId[person.id] };
    }
    const incomeByAge = projectHouseholdNetIncomeByAge(people, currentAge, EXPENSE_HORIZON_AGE, overridesByPersonId);
    const withdrawalByAge = projectHouseholdWithdrawalIncomeByAge(people, currentAge, EXPENSE_HORIZON_AGE, withdrawalRate, overridesByPersonId);
    const ssByAge = projectHouseholdSocialSecurityByAge(people, currentAge, EXPENSE_HORIZON_AGE, overridesByPersonId);
    const expensesByAge = projectHouseholdTotalExpensesByAge(expenses, currentAge, EXPENSE_HORIZON_AGE);
    chartData = [];
    for (let age = currentAge; age <= EXPENSE_HORIZON_AGE; age++) {
      const net = (incomeByAge.get(age) ?? 0) + (withdrawalByAge.get(age) ?? 0) + (ssByAge.get(age) ?? 0) - (expensesByAge.get(age) ?? 0);
      chartData.push({ age, Surplus: Math.max(0, net), Deficit: Math.min(0, net) });
    }
  }

  const surplusGradId = `${uid}-retire-surplus`;
  const deficitGradId = `${uid}-retire-deficit`;

  return (
    <div style={{ marginBottom: "2rem" }}>
      <div className="field-row" style={{ marginBottom: "1rem" }}>
        {people.map((person) => {
          const options = scenarioOptionsByPersonId.get(person.id)!;
          if (options.length <= 1) return null;
          return (
            <div className="field" key={person.id} style={{ maxWidth: 260 }}>
              <label htmlFor={`${uid}-scenario-${person.id}`}>{person.name}'s Scenario</label>
              <select
                id={`${uid}-scenario-${person.id}`}
                value={scenarioLabelByPersonId[person.id] ?? "Base"}
                onChange={(e) => setScenarioLabelByPersonId((prev) => ({ ...prev, [person.id]: e.target.value }))}
              >
                {options.map(([label]) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div
        className="card"
        style={{
          marginBottom: "1.5rem",
          borderColor: result.earliestYearsOut === null ? "var(--danger)" : "var(--accent-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {result.earliestYearsOut === null ? (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--danger)" }}>Not achievable —</strong> at these assumptions, no shared retirement
            year keeps income covering expenses all the way through age {EXPENSE_HORIZON_AGE}. Consider raising savings,
            cutting expenses, or trying a different scenario above.
          </p>
        ) : result.yearsEarlier! > 0 ? (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--accent-2)" }}>Good news —</strong>{" "}
            {isHousehold ? "your household could retire together" : `${people[0].name} could retire`} in{" "}
            <strong>
              {result.earliestYearsOut} year{result.earliestYearsOut === 1 ? "" : "s"}
            </strong>{" "}
            ({targetYear}), <strong>{result.yearsEarlier} year{result.yearsEarlier === 1 ? "" : "s"} earlier</strong> than
            planned.
          </p>
        ) : result.yearsEarlier === 0 ? (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--accent-2)" }}>Right on track —</strong> the planned retirement year of{" "}
            {plannedYear} is already the earliest sustainable one.
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--danger)" }}>Heads up —</strong> the plan for {plannedYear} isn't sustainable
            through age {EXPENSE_HORIZON_AGE}. The earliest sustainable year is <strong>{targetYear}</strong>,{" "}
            {Math.abs(result.yearsEarlier!)} year{Math.abs(result.yearsEarlier!) === 1 ? "" : "s"} later than planned.
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <StatTile
          label={isHousehold ? "Earliest Shared Retirement" : "Earliest Retirement"}
          value={result.earliestYearsOut !== null ? `${targetYear}` : "None found"}
          help={result.earliestYearsOut !== null ? `${result.earliestYearsOut} years from now` : undefined}
        />
        {result.earliestYearsOut !== null && (
          <StatTile label="Resulting Age(s)" value={resultingAgesText} />
        )}
        <StatTile label="Planned Retirement" value={`${plannedYear}`} help={`${result.plannedYearsOut} years from now`} />
        {combinedBalanceThen !== null && (
          <StatTile label="Combined 401(k) Balance Then" value={formatCompactCurrency(combinedBalanceThen)} />
        )}
      </div>

      {chartData && (
        <ChartCard
          title={isHousehold ? "Household Surplus / Deficit at the Earliest Shared Retirement" : "Surplus / Deficit at the Earliest Retirement"}
          subtitle="Total income (earned + 401(k) withdrawal + Social Security) minus total expenses, if everyone retires at the year found above."
          height={240}
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
      )}
    </div>
  );
}
