import { useEffect, useState } from "react";
import { loadFromStorage, PEOPLE_KEY, saveToStorage } from "../storage/localStorage";
import type { Person, Scenario } from "../calc";

/** Fills in defaults for any field a person saved before it existed might
 * be missing — the same role app.py's normalize_person plays for
 * people.json. */
function normalizePerson(person: Partial<Person> & Pick<Person, "id" | "name" | "birthday">): Person {
  return {
    currentSalary: 0,
    contributionPct: 0,
    matchPct: 0,
    salaryIncreasePct: 0,
    growthRatePct: 0,
    currentBalance: 0,
    accountType: "Pre-tax",
    retirementAge: 65,
    stopContributionAge: person.retirementAge ?? 65,
    hsaMonthly: 0,
    medicalInsuranceMonthly: 0,
    taxRatePct: 22,
    socialSecurityClaimAge: 67,
    socialSecurityMonthly: 0,
    scenarios: [],
    ...person,
  };
}

export type PersonDraft = Omit<Person, "id" | "scenarios">;
export type ScenarioDraft = Omit<Scenario, "id">;

/** The household combination chart (Base + every scenario,
 * cross-multiplied across everyone) gets unreadable well before this, so
 * it's as much a UX guardrail as anything else. */
export const MAX_SCENARIOS_PER_PERSON = 2;

/** People state, backed by localStorage — the React equivalent of the
 * Streamlit app's `st.session_state.people` + people.json round trip.
 * Every mutation persists immediately, matching the "auto-save on every
 * edit" behavior of the original app. */
export function usePeople() {
  const [people, setPeople] = useState<Person[]>(() =>
    loadFromStorage<Person[]>(PEOPLE_KEY, []).map((p) => normalizePerson(p)),
  );

  useEffect(() => {
    saveToStorage(PEOPLE_KEY, people);
  }, [people]);

  function addPerson(draft: PersonDraft): void {
    const person: Person = { ...draft, id: crypto.randomUUID(), scenarios: [] };
    setPeople((prev) => [...prev, person]);
  }

  function updatePerson(id: string, draft: PersonDraft): void {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...draft } : p)));
  }

  function removePerson(id: string): void {
    setPeople((prev) => prev.filter((p) => p.id !== id));
  }

  function addScenario(personId: string, draft: ScenarioDraft): void {
    const scenario: Scenario = { ...draft, id: crypto.randomUUID() };
    setPeople((prev) =>
      prev.map((p) =>
        p.id === personId && p.scenarios.length < MAX_SCENARIOS_PER_PERSON
          ? { ...p, scenarios: [...p.scenarios, scenario] }
          : p,
      ),
    );
  }

  function removeScenario(personId: string, scenarioId: string): void {
    setPeople((prev) =>
      prev.map((p) =>
        p.id === personId ? { ...p, scenarios: p.scenarios.filter((s) => s.id !== scenarioId) } : p,
      ),
    );
  }

  /** Wholesale replace — used by data import to load a scenario file. */
  function replacePeople(next: Person[]): void {
    setPeople(next.map((p) => normalizePerson(p)));
  }

  function clearPeople(): void {
    setPeople([]);
  }

  return { people, addPerson, updatePerson, removePerson, addScenario, removeScenario, replacePeople, clearPeople };
}
