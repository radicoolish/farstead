import type { Scenario } from "../calc";
import { MAX_SCENARIOS_PER_PERSON } from "../hooks/usePeople";

export function ScenarioList({
  scenarios,
  onRemove,
}: {
  scenarios: Scenario[];
  onRemove: (scenarioId: string) => void;
}) {
  return (
    <div>
      {scenarios.map((scenario) => (
        <div key={scenario.id} className="card-row" style={{ padding: "0.4rem 0" }}>
          <div>
            <strong>{scenario.name}</strong> <span className="caption">— {scenario.detail}</span>
          </div>
          <button type="button" onClick={() => onRemove(scenario.id)}>
            Remove
          </button>
        </div>
      ))}
      {scenarios.length >= MAX_SCENARIOS_PER_PERSON && (
        <p className="caption">Maximum of {MAX_SCENARIOS_PER_PERSON} scenarios reached. Remove one to add another.</p>
      )}
    </div>
  );
}
