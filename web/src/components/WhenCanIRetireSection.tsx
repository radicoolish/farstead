import { useState } from "react";
import { calculateAge, computeSimulatorComparisonMetrics, findEarliestRetirementAge, formatCompactCurrency } from "../calc";
import { useAppData } from "../state/AppDataContext";
import { resolveWithdrawalRate } from "../state/withdrawalRate";
import { SECTION_META } from "./AppNav";
import { StatTile } from "./StatTile";

const { Icon } = SECTION_META.retire;

/** A single-question optimizer built on top of the app's existing, already
 * detailed household data — no separate simplified assumption set to keep
 * in sync. For the selected person, searches every retirement age from
 * their current age through the modeled horizon and reports the earliest
 * one at which the household's income (earned + 401(k) withdrawal + Social
 * Security) still covers expenses all the way through age 85, compared
 * against that person's own currently saved retirement age. */
export function WhenCanIRetireSection() {
  const { people, expenses, currentAge, withdrawalRate } = useAppData();
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  if (people.length === 0) {
    return (
      <section>
        <h2 className="section-title">
          <Icon className="section-title-icon" />
          When Can I Retire?
        </h2>
        <p className="caption">Add someone in the Income section to find their earliest sustainable retirement age.</p>
      </section>
    );
  }

  const selectedPerson = people.find((p) => p.id === selectedPersonId) ?? people[0];
  const rate = resolveWithdrawalRate(withdrawalRate);
  const result = findEarliestRetirementAge(people, expenses, currentAge, rate, selectedPerson.id);
  const personAge = calculateAge(selectedPerson.birthday);

  const balanceAtEarliestAge =
    result.earliestAge !== null
      ? computeSimulatorComparisonMetrics(people, expenses, currentAge, rate, {
          [selectedPerson.id]: { retirementAge: result.earliestAge },
        }).combinedBalanceAtRetirement
      : null;

  return (
    <section>
      <h2 className="section-title">
        <Icon className="section-title-icon" />
        When Can I Retire?
      </h2>
      <p className="caption">
        Using your saved Income, 401(k), and Expenses assumptions — no separate guesswork here. Visit the Simulator to
        freely test other scenarios instead.
      </p>

      {people.length > 1 && (
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor="retire-person-select">Person</label>
          <select id="retire-person-select" value={selectedPerson.id} onChange={(e) => setSelectedPersonId(e.target.value)}>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <p className="caption">Everyone else's saved retirement age stays fixed while this searches {selectedPerson.name}'s.</p>
        </div>
      )}

      <div
        className="card"
        style={{
          margin: "1rem 0 1.5rem",
          borderColor: result.earliestAge === null ? "var(--danger)" : "var(--accent-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {result.earliestAge === null ? (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--danger)" }}>Not achievable —</strong> at {selectedPerson.name}'s current
            assumptions, no retirement age keeps income covering expenses all the way through age 85. Consider raising
            savings, cutting expenses, or adding Social Security income.
          </p>
        ) : result.yearsEarlier! > 0 ? (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--accent-2)" }}>Good news —</strong> {selectedPerson.name} could retire{" "}
            <strong>{result.yearsEarlier} year{result.yearsEarlier === 1 ? "" : "s"} earlier</strong> than planned, as
            early as <strong>age {result.earliestAge}</strong>.
          </p>
        ) : result.yearsEarlier === 0 ? (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--accent-2)" }}>Right on track —</strong> {selectedPerson.name}'s planned
            retirement age of <strong>{result.currentPlanAge}</strong> is already the earliest sustainable age.
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--danger)" }}>Heads up —</strong> {selectedPerson.name}'s planned retirement
            age of {result.currentPlanAge} isn't sustainable through age 85. The earliest sustainable age is{" "}
            <strong>{result.earliestAge}</strong>, {Math.abs(result.yearsEarlier!)} year
            {Math.abs(result.yearsEarlier!) === 1 ? "" : "s"} later than planned.
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem" }}>
        <StatTile label="Current Age" value={personAge} />
        <StatTile label="Planned Retirement Age" value={result.currentPlanAge} help="From the Income section" />
        <StatTile
          label="Earliest Sustainable Age"
          value={result.earliestAge ?? "None found"}
          help="Earliest age at which income covers expenses through age 85"
        />
        {balanceAtEarliestAge !== null && (
          <StatTile
            label="401(k) Balance at That Age"
            value={formatCompactCurrency(balanceAtEarliestAge)}
            help={`Combined household 401(k) balance if ${selectedPerson.name} retires at age ${result.earliestAge}`}
          />
        )}
      </div>
    </section>
  );
}
