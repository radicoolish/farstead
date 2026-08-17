import { useState } from "react";
import { EXPENSE_HORIZON_AGE, type PersonOverrides } from "../calc";
import { useAppData } from "../state/AppDataContext";
import { PersonSimulatorPanel } from "./PersonSimulatorPanel";
import { SimulatorCharts } from "./SimulatorCharts";
import { initialSimState, overridesFromSimState, type PersonSimState } from "../simulator/state";

/** Section 4: a fully sandboxed "what if" playground. Every field for
 * every person is freely editable here without touching saved data —
 * nothing in this section is persisted. Current Age is locked to the
 * same value as the Household Expenses section (see AppDataContext) since
 * it also drives expense inflation; Withdrawal Rate gets its own
 * independent input since it only affects 401(k) withdrawals. Mirrors
 * app.py's Section 4 (render_simulator_inputs + render_simulator_charts). */
export function SimulatorSection() {
  const { people, expenses, currentAge, withdrawalRatePct: actualWithdrawalRatePct } = useAppData();

  const [simStates, setSimStates] = useState<Record<string, PersonSimState>>({});
  const [simWithdrawalRatePct, setSimWithdrawalRatePct] = useState(actualWithdrawalRatePct);
  const [resetKey, setResetKey] = useState(0);

  function getSimState(person: (typeof people)[number]): PersonSimState {
    return simStates[person.id] ?? initialSimState(person);
  }

  function handleChange(personId: string, next: PersonSimState) {
    setSimStates((prev) => ({ ...prev, [personId]: next }));
  }

  function handleResetAll() {
    setSimStates({});
    setSimWithdrawalRatePct(actualWithdrawalRatePct);
    setResetKey((k) => k + 1);
  }

  if (people.length === 0) {
    return (
      <section>
        <h2>Simulator</h2>
        <p className="caption">Add someone in the Income section above to use the simulator.</p>
      </section>
    );
  }

  const simOverridesByPersonId: Record<string, PersonOverrides> = {};
  for (const person of people) {
    simOverridesByPersonId[person.id] = overridesFromSimState(getSimState(person));
  }

  return (
    <section>
      <h2>Simulator</h2>
      <p className="caption">
        Freely adjust any input for any person to explore a "what if" — nothing here is saved. Compares against your
        actual, saved projection from the Household Expenses section above.
      </p>

      <div className="field-row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ maxWidth: 220 }}>
          <label>Current Age</label>
          <input type="number" value={currentAge} disabled />
          <p className="caption">Locked to the Household Expenses section's Current Age.</p>
        </div>
        <div className="field" style={{ maxWidth: 220 }}>
          <label htmlFor="sim-withdrawal-rate">Simulated 401k Withdrawal Rate (%)</label>
          <input
            id="sim-withdrawal-rate"
            type="number"
            min={0}
            max={20}
            step="any"
            value={simWithdrawalRatePct}
            onChange={(e) => setSimWithdrawalRatePct(Number(e.target.value))}
          />
        </div>
        <button type="button" onClick={handleResetAll}>
          Reset All to Actual
        </button>
      </div>

      {people.map((person) => (
        <details key={`${person.id}-${resetKey}`} className="panel" open>
          <summary>{person.name}</summary>
          <div className="panel-body">
            <PersonSimulatorPanel person={person} sim={getSimState(person)} onChange={(next) => handleChange(person.id, next)} />
          </div>
        </details>
      ))}

      <h3 style={{ marginTop: "1.5rem" }}>Actual vs. Simulated</h3>
      <SimulatorCharts
        people={people}
        expenses={expenses}
        currentAge={currentAge}
        horizonAge={EXPENSE_HORIZON_AGE}
        actualWithdrawalRatePct={actualWithdrawalRatePct}
        simWithdrawalRatePct={simWithdrawalRatePct}
        simOverridesByPersonId={simOverridesByPersonId}
      />
    </section>
  );
}
