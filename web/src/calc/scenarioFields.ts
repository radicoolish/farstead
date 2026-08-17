import type { Person, PersonOverrides } from "./types";

/** Every simple-field scenario key names an actual Person property — only
 * "incomeChange" (PersonOverrides' one non-Person key) is excluded, since
 * that's handled as its own scenario type, never through this config. */
type SimpleScenarioKey = Exclude<keyof PersonOverrides, "incomeChange"> & keyof Person;

/** Fields a single-field scenario is allowed to vary. Current balance,
 * birthday, employer match, current salary, and account type stay fixed
 * from the base person — mirrors app.py's SCENARIO_FIELDS. */
export interface ScenarioFieldConfig {
  label: string;
  key: SimpleScenarioKey;
  min: number;
  max: number;
  step: number;
  percent: boolean;
  /** Retirement/stop-contribution ages can't sensibly go below the
   * person's current age — applied as an additional floor on `min` at
   * render time, same as app.py's special-cases those two keys. */
  isAge?: boolean;
}

export const SCENARIO_FIELDS: ScenarioFieldConfig[] = [
  { label: "% of Salary Contributed", key: "contributionPct", min: 0, max: 50, step: 0.5, percent: true },
  { label: "Annual Salary Increase (%)", key: "salaryIncreasePct", min: 0, max: 15, step: 0.25, percent: true },
  { label: "Annual Growth Rate (%)", key: "growthRatePct", min: 0, max: 15, step: 0.25, percent: true },
  { label: "Retirement / Draw Age", key: "retirementAge", min: 1, max: 100, step: 1, percent: false, isAge: true },
  {
    label: "Stop Contribution Age",
    key: "stopContributionAge",
    min: 1,
    max: 100,
    step: 1,
    percent: false,
    isAge: true,
  },
];

/** A scenario type that isn't a simple single-field override: income
 * steps to a new, flat annual amount starting at a given age and stays
 * there (no further raises) through retirement. */
export const INCOME_CHANGE_LABEL = "Different Income Until Retirement";
