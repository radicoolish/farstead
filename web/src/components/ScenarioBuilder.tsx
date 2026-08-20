import { useEffect, useId, useState } from "react";
import {
  calculateAge,
  formatCompactCurrency,
  INCOME_CHANGE_LABEL,
  SCENARIO_FIELDS,
  type Person,
} from "../calc";
import type { ScenarioDraft } from "../hooks/usePeople";
import { NumberField } from "./NumberField";

interface ScenarioBuilderProps {
  person: Person;
  onAdd: (draft: ScenarioDraft) => void;
}

/** Add-a-scenario form for one person: either vary a single field (a
 * slider-backed numeric override) or step to a different income at a
 * given age (the "Different Income Until Retirement" type). Mirrors
 * app.py's scenario builder in Section 2. */
export function ScenarioBuilder({ person, onAdd }: ScenarioBuilderProps) {
  const uid = useId();
  const age = calculateAge(person.birthday);
  const [name, setName] = useState("");
  const [fieldLabel, setFieldLabel] = useState<string>(SCENARIO_FIELDS[0].label);
  const config = SCENARIO_FIELDS.find((f) => f.label === fieldLabel);
  const isIncomeChange = fieldLabel === INCOME_CHANGE_LABEL;

  const [simpleValue, setSimpleValue] = useState(0);
  // Reset the value whenever the selected field changes, seeded from the
  // person's current value for that field — the same "only overwrite on
  // an actual mode change" pattern used throughout this app to avoid
  // fighting a value the user is actively editing.
  useEffect(() => {
    if (!config) return;
    const raw = Number(person[config.key] ?? 0);
    const min = config.isAge ? Math.max(config.min, age + 1) : config.min;
    setSimpleValue(Math.min(Math.max(raw, min), config.max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldLabel]);

  const [changeAge, setChangeAge] = useState(() => Math.min(age + 5, person.retirementAge));
  const [newSalary, setNewSalary] = useState(person.currentSalary);
  const [newContribution, setNewContribution] = useState(person.contributionPct);
  const [newMatch, setNewMatch] = useState(person.matchPct);
  const [newRaise, setNewRaise] = useState(person.salaryIncreasePct);

  function handleAdd() {
    const scenarioName = name.trim() || `Scenario ${person.scenarios.length + 1}`;
    if (isIncomeChange) {
      const detail =
        `At age ${changeAge}: income → ${formatCompactCurrency(newSalary)}/yr, ` +
        `${newContribution.toFixed(1)}% contributed, ${newMatch.toFixed(1)}% match, ` +
        `${newRaise.toFixed(1)}% raises`;
      onAdd({
        field: "incomeChange",
        value: {
          age: changeAge,
          newSalary,
          contributionPct: newContribution,
          matchPct: newMatch,
          salaryIncreasePct: newRaise,
        },
        name: scenarioName,
        detail,
      });
    } else if (config) {
      const detail = `${config.label}: ${simpleValue}${config.percent ? "%" : ""}`;
      onAdd({ field: config.key, value: simpleValue, name: scenarioName, detail });
    }
    setName("");
  }

  const ageMin = age + 1;
  const ageMax = Math.max(ageMin, person.retirementAge);

  return (
    <div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${uid}-name`}>Scenario Name</label>
          <input
            id={`${uid}-name`}
            type="text"
            placeholder={`Scenario ${person.scenarios.length + 1}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${uid}-field`}>What do you want to change?</label>
          <select id={`${uid}-field`} value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)}>
            {SCENARIO_FIELDS.map((f) => (
              <option key={f.label} value={f.label}>
                {f.label}
              </option>
            ))}
            <option value={INCOME_CHANGE_LABEL}>{INCOME_CHANGE_LABEL}</option>
          </select>
        </div>
      </div>

      {isIncomeChange ? (
        <>
          <div className="field-row">
            <div className="field">
              <label htmlFor={`${uid}-change-age`}>Age When Income Changes</label>
              <NumberField id={`${uid}-change-age`} min={ageMin} max={ageMax} value={changeAge} onChange={setChangeAge} />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-new-salary`}>New Annual Salary ($)</label>
              <NumberField id={`${uid}-new-salary`} min={0} step="any" value={newSalary} onChange={setNewSalary} />
            </div>
          </div>
          <div className="field-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="field">
              <label htmlFor={`${uid}-new-contrib`}>New % of Salary Contributed</label>
              <NumberField id={`${uid}-new-contrib`} min={0} max={100} step="any" value={newContribution} onChange={setNewContribution} />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-new-match`}>New % of Salary Matched</label>
              <NumberField id={`${uid}-new-match`} min={0} max={100} step="any" value={newMatch} onChange={setNewMatch} />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-new-raise`}>New Annual Salary Increase (%)</label>
              <NumberField id={`${uid}-new-raise`} min={0} max={50} step="any" value={newRaise} onChange={setNewRaise} />
            </div>
          </div>
          <p className="caption">
            Salary, contribution %, match %, and raise assumption all switch to these values at that
            age and carry through to retirement.
          </p>
        </>
      ) : config ? (
        <div className="field">
          <label htmlFor={`${uid}-value`}>
            {config.label}
            {config.percent ? " (%)" : ""}
          </label>
          <NumberField
            id={`${uid}-value`}
            min={config.isAge ? Math.max(config.min, ageMin) : config.min}
            max={config.max}
            step={config.percent ? "any" : 1}
            value={simpleValue}
            onChange={setSimpleValue}
          />
        </div>
      ) : null}

      <button type="button" onClick={handleAdd} style={{ marginTop: "0.75rem" }}>
        Add Scenario
      </button>
    </div>
  );
}
