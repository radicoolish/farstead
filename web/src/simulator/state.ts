import { calculateAge, personScenarioOptions, type IncomeChange, type Person, type PersonOverrides } from "../calc";

/** Every field the Simulator lets a user freely override for one person,
 * sandboxed in memory only — never written to localStorage. Always holds
 * ALL fields (seeded from the person's saved data), mirroring app.py's
 * sim_*-prefixed session_state keys. */
export interface SimFields {
  currentSalary: number;
  contributionPct: number;
  matchPct: number;
  salaryIncreasePct: number;
  growthRatePct: number;
  currentBalance: number;
  retirementAge: number;
  stopContributionAge: number;
  hsaMonthly: number;
  medicalInsuranceMonthly: number;
  taxRatePct: number;
  socialSecurityClaimAge: number;
  socialSecurityMonthly: number;
}

export interface PersonSimState {
  fields: SimFields;
  incomeChangeEnabled: boolean;
  incomeChange: IncomeChange;
  /** Label of the saved scenario last loaded into this panel ("Base" if
   * none, or if the user has since hand-edited a field away from it). */
  loadedScenarioLabel: string;
}

export function fieldsFromPerson(person: Person): SimFields {
  return {
    currentSalary: person.currentSalary,
    contributionPct: person.contributionPct,
    matchPct: person.matchPct,
    salaryIncreasePct: person.salaryIncreasePct,
    growthRatePct: person.growthRatePct,
    currentBalance: person.currentBalance,
    retirementAge: person.retirementAge,
    stopContributionAge: person.stopContributionAge,
    hsaMonthly: person.hsaMonthly,
    medicalInsuranceMonthly: person.medicalInsuranceMonthly,
    taxRatePct: person.taxRatePct,
    socialSecurityClaimAge: person.socialSecurityClaimAge,
    socialSecurityMonthly: person.socialSecurityMonthly,
  };
}

function defaultIncomeChange(person: Person): IncomeChange {
  return {
    age: calculateAge(person.birthday) + 5,
    newSalary: person.currentSalary,
    contributionPct: person.contributionPct,
    matchPct: person.matchPct,
    salaryIncreasePct: person.salaryIncreasePct,
  };
}

export function initialSimState(person: Person): PersonSimState {
  return {
    fields: fieldsFromPerson(person),
    incomeChangeEnabled: false,
    incomeChange: defaultIncomeChange(person),
    loadedScenarioLabel: "Base",
  };
}

/** Merge a saved scenario's single-field (or income-change) override on
 * top of the person's base fields — mirrors personScenarioOptions' Base +
 * per-scenario override pairs used elsewhere for the saved-scenario chart. */
export function simStateFromScenario(person: Person, label: string, overrides: PersonOverrides): PersonSimState {
  const fields = { ...fieldsFromPerson(person), ...overrides };
  if (overrides.incomeChange) {
    return {
      fields,
      incomeChangeEnabled: true,
      incomeChange: { ...defaultIncomeChange(person), ...overrides.incomeChange },
      loadedScenarioLabel: label,
    };
  }
  return { fields, incomeChangeEnabled: false, incomeChange: defaultIncomeChange(person), loadedScenarioLabel: label };
}

/** Saved-scenario picker options for a person's simulator panel — reuses
 * the same Base + named-scenario pairing as the 401(k) planner's charts. */
export function simulatorScenarioOptions(person: Person): Array<[string, PersonOverrides]> {
  return personScenarioOptions(person);
}

export function overridesFromSimState(sim: PersonSimState): PersonOverrides {
  return {
    ...sim.fields,
    ...(sim.incomeChangeEnabled ? { incomeChange: sim.incomeChange } : {}),
  };
}
