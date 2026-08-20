import type { ByAge, Person } from "./types";

/** The age the household's retirement period starts at — the earliest
 * retirement age among everyone in the household, since that's the point
 * where earned income first stops and withdrawal/Social Security first
 * start layering in for the household as a whole (even if not everyone
 * has retired yet). For a single-person household this is just their own
 * retirement age — no ambiguity. */
export function householdRetirementBoundaryAge(people: Person[]): number {
  return Math.min(...people.map((p) => p.retirementAge));
}

/** The mean of `byAge`'s values over [startAge, endAge] inclusive — 0 if
 * the range is empty (startAge > endAge) or byAge has no entries in it.
 * Used to collapse a whole projection into one representative number for
 * a given period (pre-retirement, retirement, or the full horizon)
 * instead of reading a single point-in-time value, which can be
 * unrepresentative since costs and income sources shift a lot over time. */
export function averageOverRange(byAge: ByAge, startAge: number, endAge: number): number {
  let sum = 0;
  let count = 0;
  for (let age = startAge; age <= endAge; age++) {
    const value = byAge.get(age);
    if (value !== undefined) {
      sum += value;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}
