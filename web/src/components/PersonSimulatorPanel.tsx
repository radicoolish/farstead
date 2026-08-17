import { useId } from "react";
import { calculateAge, type Person } from "../calc";
import { SliderField } from "./SliderField";
import {
  fieldsFromPerson,
  simStateFromScenario,
  simulatorScenarioOptions,
  type PersonSimState,
  type SimFields,
} from "../simulator/state";

interface PersonSimulatorPanelProps {
  person: Person;
  sim: PersonSimState;
  onChange: (next: PersonSimState) => void;
}

/** One person's free-form simulator inputs: every field the calc engine
 * can vary, as sliders/number inputs, plus a "Load from Saved Scenario"
 * picker that seeds the panel and an income-change sub-form. Sandboxed —
 * nothing here is persisted; the parent SimulatorSection holds the state
 * in memory only. Mirrors app.py's render_simulator_inputs. */
export function PersonSimulatorPanel({ person, sim, onChange }: PersonSimulatorPanelProps) {
  const uid = useId();
  const id = (suffix: string) => `${uid}-${suffix}`;
  const age = calculateAge(person.birthday);

  function updateField<K extends keyof SimFields>(key: K, value: SimFields[K]) {
    onChange({ ...sim, fields: { ...sim.fields, [key]: value }, loadedScenarioLabel: "Custom" });
  }

  function handleLoadScenario(label: string) {
    const options = simulatorScenarioOptions(person);
    const found = options.find(([optionLabel]) => optionLabel === label);
    if (!found) return;
    onChange(simStateFromScenario(person, label, found[1]));
  }

  function handleReset() {
    onChange({ fields: fieldsFromPerson(person), incomeChangeEnabled: false, incomeChange: sim.incomeChange, loadedScenarioLabel: "Base" });
  }

  const scenarioOptions = simulatorScenarioOptions(person);

  return (
    <div>
      <div className="field-row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor={id("load-scenario")}>Load from Saved Scenario</label>
          <select id={id("load-scenario")} value={sim.loadedScenarioLabel} onChange={(e) => handleLoadScenario(e.target.value)}>
            {sim.loadedScenarioLabel === "Custom" && <option value="Custom">Custom (hand-edited)</option>}
            {scenarioOptions.map(([label]) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
          <p className="caption">Seeds every field below — you can keep adjusting afterward.</p>
        </div>
        <button type="button" onClick={handleReset}>
          Reset This Person
        </button>
      </div>

      <div className="field-row">
        <div>
          <div className="field">
            <label htmlFor={id("salary")}>Salary ($/yr)</label>
            <input
              id={id("salary")}
              type="number"
              min={0}
              step="any"
              value={sim.fields.currentSalary}
              onChange={(e) => updateField("currentSalary", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={id("balance")}>Current 401(k) Balance ($)</label>
            <input
              id={id("balance")}
              type="number"
              min={0}
              step="any"
              value={sim.fields.currentBalance}
              onChange={(e) => updateField("currentBalance", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={id("hsa")}>Monthly HSA Contribution ($)</label>
            <input
              id={id("hsa")}
              type="number"
              min={0}
              step="any"
              value={sim.fields.hsaMonthly}
              onChange={(e) => updateField("hsaMonthly", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={id("medical")}>Medical Insurance ($/mo)</label>
            <input
              id={id("medical")}
              type="number"
              min={0}
              step="any"
              value={sim.fields.medicalInsuranceMonthly}
              onChange={(e) => updateField("medicalInsuranceMonthly", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={id("ss-monthly")}>Social Security Monthly Benefit ($)</label>
            <input
              id={id("ss-monthly")}
              type="number"
              min={0}
              step="any"
              value={sim.fields.socialSecurityMonthly}
              onChange={(e) => updateField("socialSecurityMonthly", Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <SliderField
            label="% of Salary Contributed"
            value={sim.fields.contributionPct}
            min={0}
            max={50}
            step={0.5}
            formatValue={(v) => `${v}%`}
            onChange={(v) => updateField("contributionPct", v)}
          />
          <SliderField
            label="% of Salary Matched"
            value={sim.fields.matchPct}
            min={0}
            max={100}
            step={0.5}
            formatValue={(v) => `${v}%`}
            onChange={(v) => updateField("matchPct", v)}
          />
          <SliderField
            label="Annual Salary Increase (%)"
            value={sim.fields.salaryIncreasePct}
            min={0}
            max={15}
            step={0.25}
            formatValue={(v) => `${v}%`}
            onChange={(v) => updateField("salaryIncreasePct", v)}
          />
          <SliderField
            label="Annual Growth Rate (%)"
            value={sim.fields.growthRatePct}
            min={0}
            max={15}
            step={0.25}
            formatValue={(v) => `${v}%`}
            onChange={(v) => updateField("growthRatePct", v)}
          />
          <SliderField
            label="Effective Tax Rate (%)"
            value={sim.fields.taxRatePct}
            min={0}
            max={60}
            step={0.5}
            formatValue={(v) => `${v}%`}
            onChange={(v) => updateField("taxRatePct", v)}
          />
        </div>
        <div>
          <SliderField
            label="Retirement / Draw Age"
            value={sim.fields.retirementAge}
            min={Math.max(1, age)}
            max={100}
            step={1}
            onChange={(v) => updateField("retirementAge", v)}
          />
          <SliderField
            label="Stop Contribution Age"
            value={sim.fields.stopContributionAge}
            min={Math.max(1, age)}
            max={100}
            step={1}
            onChange={(v) => updateField("stopContributionAge", v)}
          />
          <SliderField
            label="Social Security Claim Age"
            value={sim.fields.socialSecurityClaimAge}
            min={62}
            max={70}
            step={1}
            onChange={(v) => updateField("socialSecurityClaimAge", v)}
          />
        </div>
      </div>

      <details className="panel" style={{ marginTop: "0.75rem" }}>
        <summary>Simulate an Income Change</summary>
        <div className="panel-body">
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={sim.incomeChangeEnabled}
              onChange={(e) => onChange({ ...sim, incomeChangeEnabled: e.target.checked, loadedScenarioLabel: "Custom" })}
            />
            Step to a different income at a given age
          </label>
          {sim.incomeChangeEnabled && (
            <div className="field-row" style={{ marginTop: "0.5rem" }}>
              <div className="field">
                <label htmlFor={id("ic-age")}>Age of Change</label>
                <input
                  id={id("ic-age")}
                  type="number"
                  min={age}
                  max={100}
                  value={sim.incomeChange.age}
                  onChange={(e) =>
                    onChange({ ...sim, incomeChange: { ...sim.incomeChange, age: Number(e.target.value) }, loadedScenarioLabel: "Custom" })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor={id("ic-salary")}>New Salary ($/yr)</label>
                <input
                  id={id("ic-salary")}
                  type="number"
                  min={0}
                  step="any"
                  value={sim.incomeChange.newSalary}
                  onChange={(e) =>
                    onChange({
                      ...sim,
                      incomeChange: { ...sim.incomeChange, newSalary: Number(e.target.value) },
                      loadedScenarioLabel: "Custom",
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
