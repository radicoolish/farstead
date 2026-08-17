import { useState } from "react";
import { calculateAge, type Person } from "../calc";
import { useAppData } from "../state/AppDataContext";
import { BalanceChart } from "./BalanceChart";
import { TotalsRow } from "./TotalsRow";
import { ScenarioList } from "./ScenarioList";
import { ScenarioBuilder } from "./ScenarioBuilder";
import { MAX_SCENARIOS_PER_PERSON } from "../hooks/usePeople";

function Metric({ label, value, help }: { label: string; value: string | number; help?: string }) {
  return (
    <div title={help}>
      <div className="caption" style={{ fontSize: "0.72rem" }}>
        {label}
      </div>
      <div style={{ fontWeight: 650, fontSize: "1.05rem" }}>{value}</div>
    </div>
  );
}

/** One person's 401(k) projection: metrics, the Base+scenarios chart,
 * totals at retirement, and scenario management. Editing salary/401k/SS
 * fields happens via the same "Tell Me About Yourself" form used to create
 * the person (Household Income section) rather than a second edit form
 * here — mirrors app.py's Section 2, minus its separate Edit popover,
 * which this app's consolidated PersonForm makes redundant. */
export function PersonBalanceCard({ person }: { person: Person }) {
  const { addScenario, removeScenario } = useAppData();
  const age = calculateAge(person.birthday);
  const [showBuilder, setShowBuilder] = useState(false);

  return (
    <div className="card">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <Metric label="Current Balance" value={`$${person.currentBalance.toLocaleString("en-US")}`} />
        <Metric label="Current Salary" value={`$${person.currentSalary.toLocaleString("en-US")}`} />
        <Metric label="Contribution + Match" value={`${(person.contributionPct + person.matchPct).toFixed(1)}%`} />
        <Metric label="Retirement Age" value={person.retirementAge} />
        <Metric label="Stops Contributing" value={person.stopContributionAge} help="Age contributions and employer match stop" />
        <Metric label="Salary Increase" value={`${person.salaryIncreasePct}%`} />
        <Metric label="Growth Rate" value={`${person.growthRatePct}%`} />
        <Metric
          label="Social Security"
          value={`$${person.socialSecurityMonthly.toLocaleString("en-US")}/mo`}
          help={`Claiming at age ${person.socialSecurityClaimAge}`}
        />
      </div>
      <p className="caption" style={{ marginTop: 0 }}>
        {person.name} — Age {age} — {person.accountType}
      </p>

      <BalanceChart person={person} />

      <p className="caption" style={{ marginTop: "0.75rem", marginBottom: "0.25rem" }}>
        Projected balance at retirement
      </p>
      <TotalsRow person={person} />

      <h4 style={{ marginTop: "1.25rem", marginBottom: "0.4rem" }}>Scenarios</h4>
      <p className="caption" style={{ marginTop: 0 }}>
        Vary one assumption at a time and compare it to the base projection above.
      </p>
      <ScenarioList scenarios={person.scenarios} onRemove={(scenarioId) => removeScenario(person.id, scenarioId)} />

      {person.scenarios.length < MAX_SCENARIOS_PER_PERSON && (
        <>
          {!showBuilder && (
            <button type="button" onClick={() => setShowBuilder(true)}>
              Add Scenario
            </button>
          )}
          {showBuilder && (
            <ScenarioBuilder
              person={person}
              onAdd={(draft) => {
                addScenario(person.id, draft);
                setShowBuilder(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
