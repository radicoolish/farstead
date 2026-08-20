import { calculateAge } from "./age";
import { DEFAULT_MARKET_CONDITION_DURATION_YEARS, effectiveGrowthRateForYear, MARKET_CONDITIONS } from "./marketConditions";
import type { BalancePoint, ByAge, IncomeChange, Person, PersonOverrides, WithdrawalRate } from "./types";

/** One year's withdrawal from a single balance — a percentage of that
 * balance, or a fixed dollar amount clamped to what's actually left (so a
 * fixed withdrawal can't take the balance negative once it runs out). */
function withdrawalAmountForYear(rate: WithdrawalRate, balance: number): number {
  if (rate.mode === "percent") return balance * (rate.value / 100);
  return Math.min(rate.value, Math.max(0, balance));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function effectivePerson(person: Person, overrides: PersonOverrides): Person & PersonOverrides {
  return { ...person, ...overrides };
}

function zeroedByAge(currentAge: number, horizonAge: number): ByAge {
  const totals: ByAge = new Map();
  for (let age = currentAge; age <= horizonAge; age++) totals.set(age, 0);
  return totals;
}

function addTo(totals: ByAge, age: number, amount: number): void {
  totals.set(age, (totals.get(age) ?? 0) + amount);
}

/** Year-by-year 401(k) balance from today through retirement, honoring an
 * `incomeChange` override the same way every income-aware projection does:
 * salary (and optionally contribution/match/raise) steps once at a given
 * age, then compounds normally from there. Mirrors app.py's
 * project_balance. */
export function projectBalance(
  person: Person,
  overrides: PersonOverrides = {},
  today: Date = new Date(),
): BalancePoint[] {
  const effective = effectivePerson(person, overrides);
  const age = calculateAge(effective.birthday, today);
  const yearsToGrow = Math.max(effective.retirementAge - age, 0);
  const stopContributionAge = effective.stopContributionAge ?? effective.retirementAge;
  const incomeChange = effective.incomeChange;
  let incomeTriggered = false;

  let balance = effective.currentBalance;
  let salary = effective.currentSalary;
  let contribPct = effective.contributionPct / 100;
  let matchPct = effective.matchPct / 100;
  let salaryGrowth = effective.salaryIncreasePct / 100;
  const growthRate = effective.growthRatePct / 100;
  const marketCondition = overrides.marketCondition ? MARKET_CONDITIONS[overrides.marketCondition] : undefined;
  const marketConditionStartAge = overrides.marketConditionStartAge ?? age;
  const marketConditionDurationYears = overrides.marketConditionDurationYears ?? DEFAULT_MARKET_CONDITION_DURATION_YEARS;

  const thisYear = today.getFullYear();
  const rows: BalancePoint[] = [{ age, year: thisYear, balance: round2(balance) }];

  for (let i = 1; i <= yearsToGrow; i++) {
    const currentAge = age + i;
    if (incomeChange && !incomeTriggered && currentAge >= incomeChange.age) {
      salary = incomeChange.newSalary;
      contribPct = (incomeChange.contributionPct ?? effective.contributionPct) / 100;
      matchPct = (incomeChange.matchPct ?? effective.matchPct) / 100;
      salaryGrowth = (incomeChange.salaryIncreasePct ?? effective.salaryIncreasePct) / 100;
      incomeTriggered = true;
    }
    const annualContribution = currentAge <= stopContributionAge ? salary * (contribPct + matchPct) : 0;
    const yearGrowthRate = effectiveGrowthRateForYear(
      growthRate,
      marketCondition,
      currentAge,
      marketConditionStartAge,
      marketConditionDurationYears,
    );
    balance = balance * (1 + yearGrowthRate) + annualContribution;
    salary = salary * (1 + salaryGrowth);
    rows.push({ age: currentAge, year: thisYear + i, balance: round2(balance) });
  }
  return rows;
}

/** Combined take-home income by household reference age, summed across
 * everyone. Each person's own salary grows at their own raise assumption
 * and stops the year they pass their own retirement age (not the household
 * reference age, since people can be different ages).
 *
 * `overridesByPersonId` lets a chosen 401k scenario (or the Simulator)
 * override salary, contribution %, salary raise, retirement age, and the
 * income-change step per person, instead of always using base assumptions.
 * Tax rate, HSA, and medical insurance stay fixed regardless of scenario,
 * since no scenario field touches them. Mirrors app.py's
 * project_household_net_income_by_age. */
export function projectHouseholdNetIncomeByAge(
  people: Person[],
  currentAge: number,
  horizonAge: number,
  overridesByPersonId: Record<string, PersonOverrides> = {},
  today: Date = new Date(),
): ByAge {
  const totals = zeroedByAge(currentAge, horizonAge);
  for (const person of people) {
    const effective = effectivePerson(person, overridesByPersonId[person.id] ?? {});
    const personAge = calculateAge(effective.birthday, today);
    const retirementAge = effective.retirementAge;
    const incomeChange = effective.incomeChange;
    let incomeTriggered = false;

    let salary = effective.currentSalary;
    let contributionPct = effective.contributionPct;
    let salaryGrowth = effective.salaryIncreasePct / 100;
    const taxRatePct = effective.taxRatePct;
    const hsaAnnual = effective.hsaMonthly * 12;
    const medicalAnnual = effective.medicalInsuranceMonthly * 12;

    for (let i = 0, age = currentAge; age <= horizonAge; age++, i++) {
      const personOwnAge = personAge + i;
      if (personOwnAge > retirementAge) continue;
      if (incomeChange && !incomeTriggered && personOwnAge >= incomeChange.age) {
        salary = incomeChange.newSalary;
        contributionPct = incomeChange.contributionPct ?? effective.contributionPct;
        salaryGrowth = (incomeChange.salaryIncreasePct ?? effective.salaryIncreasePct) / 100;
        incomeTriggered = true;
      }
      const contribution = (salary * contributionPct) / 100;
      const tax = (salary * taxRatePct) / 100;
      addTo(totals, age, salary - contribution - hsaAnnual - medicalAnnual - tax);
      salary *= 1 + salaryGrowth;
    }
  }
  return totals;
}

/** 401(k) withdrawal income by household reference age, summed across
 * everyone, starting the year after each person's own earned income stops.
 * Each year's withdrawal is either a percentage of that person's 401(k)
 * balance at the start of the year, or a fixed dollar amount (see
 * `WithdrawalRate`) — the balance used (the chosen scenario's, or with no
 * override the base) is its projection through retirement; the remainder
 * compounds at their own growth rate for next year. */
export function projectHouseholdWithdrawalIncomeByAge(
  people: Person[],
  currentAge: number,
  horizonAge: number,
  withdrawalRate: WithdrawalRate,
  overridesByPersonId: Record<string, PersonOverrides> = {},
  today: Date = new Date(),
): ByAge {
  const totals = zeroedByAge(currentAge, horizonAge);
  for (const person of people) {
    const overrides = overridesByPersonId[person.id] ?? {};
    const effective = effectivePerson(person, overrides);
    const personAge = calculateAge(effective.birthday, today);
    const retirementAge = effective.retirementAge;
    const scenarioBalances = projectBalance(person, overrides, today);
    const balanceByPersonAge = new Map(scenarioBalances.map((p) => [p.age, p.balance]));
    let balance = balanceByPersonAge.get(retirementAge) ?? scenarioBalances[scenarioBalances.length - 1].balance;
    const growthRate = effective.growthRatePct / 100;
    const marketCondition = overrides.marketCondition ? MARKET_CONDITIONS[overrides.marketCondition] : undefined;
    const marketConditionStartAge = overrides.marketConditionStartAge ?? personAge;
    const marketConditionDurationYears = overrides.marketConditionDurationYears ?? DEFAULT_MARKET_CONDITION_DURATION_YEARS;

    for (let i = 0, age = currentAge; age <= horizonAge; age++, i++) {
      if (personAge + i <= retirementAge) continue;
      const withdrawal = withdrawalAmountForYear(withdrawalRate, balance);
      addTo(totals, age, withdrawal);
      const yearGrowthRate = effectiveGrowthRateForYear(
        growthRate,
        marketCondition,
        personAge + i,
        marketConditionStartAge,
        marketConditionDurationYears,
      );
      balance = (balance - withdrawal) * (1 + yearGrowthRate);
    }
  }
  return totals;
}

/** Combined Social Security income by household reference age, summed
 * across everyone, starting the year each person reaches their own claim
 * age — independent of whether they're still working or already retired.
 * The SSA earnings test, which can temporarily reduce benefits claimed
 * before full retirement age while still working, isn't modeled here.
 * Mirrors app.py's project_household_social_security_by_age. */
export function projectHouseholdSocialSecurityByAge(
  people: Person[],
  currentAge: number,
  horizonAge: number,
  overridesByPersonId: Record<string, PersonOverrides> = {},
  today: Date = new Date(),
): ByAge {
  const totals = zeroedByAge(currentAge, horizonAge);
  for (const person of people) {
    const effective = effectivePerson(person, overridesByPersonId[person.id] ?? {});
    const personAge = calculateAge(effective.birthday, today);
    const claimAge = effective.socialSecurityClaimAge;
    const monthly = effective.socialSecurityMonthly;
    for (let i = 0, age = currentAge; age <= horizonAge; age++, i++) {
      if (personAge + i >= claimAge) addTo(totals, age, monthly * 12);
    }
  }
  return totals;
}

/** Combined 401(k) balance by household reference age, summed across
 * everyone — the running balance itself, not the withdrawal amount.
 * Before a person's own retirement age this is exactly `projectBalance`'s
 * trajectory (growth + contributions); after it, the balance depletes by
 * `withdrawalRate` a year (percent-of-balance or a fixed dollar amount —
 * see `WithdrawalRate`) with the remainder still compounding at their own
 * growth rate — the same mechanics that back
 * projectHouseholdWithdrawalIncomeByAge, just exposing the balance itself
 * instead of only the amount withdrawn from it. */
export function projectHouseholdBalanceByAge(
  people: Person[],
  currentAge: number,
  horizonAge: number,
  withdrawalRate: WithdrawalRate,
  overridesByPersonId: Record<string, PersonOverrides> = {},
  today: Date = new Date(),
): ByAge {
  const totals = zeroedByAge(currentAge, horizonAge);
  for (const person of people) {
    const overrides = overridesByPersonId[person.id] ?? {};
    const effective = effectivePerson(person, overrides);
    const personAge = calculateAge(effective.birthday, today);
    const retirementAge = effective.retirementAge;
    const growthRate = effective.growthRatePct / 100;
    const marketCondition = overrides.marketCondition ? MARKET_CONDITIONS[overrides.marketCondition] : undefined;
    const marketConditionStartAge = overrides.marketConditionStartAge ?? personAge;
    const marketConditionDurationYears = overrides.marketConditionDurationYears ?? DEFAULT_MARKET_CONDITION_DURATION_YEARS;
    const scenarioBalances = projectBalance(person, overrides, today);
    const balanceByPersonAge = new Map(scenarioBalances.map((p) => [p.age, p.balance]));

    let balance = effective.currentBalance;
    for (let i = 0, age = currentAge; age <= horizonAge; age++, i++) {
      const thisPersonAge = personAge + i;
      if (thisPersonAge <= retirementAge) {
        balance = balanceByPersonAge.get(thisPersonAge) ?? balance;
      } else {
        const withdrawal = withdrawalAmountForYear(withdrawalRate, balance);
        const yearGrowthRate = effectiveGrowthRateForYear(
          growthRate,
          marketCondition,
          thisPersonAge,
          marketConditionStartAge,
          marketConditionDurationYears,
        );
        balance = (balance - withdrawal) * (1 + yearGrowthRate);
      }
      addTo(totals, age, balance);
    }
  }
  return totals;
}

/** Each person's own set of choices: their Base plus every saved scenario,
 * as (label, overrides) pairs. Mirrors app.py's person_scenario_options. */
export function personScenarioOptions(person: Person): Array<[string, PersonOverrides]> {
  const options: Array<[string, PersonOverrides]> = [["Base", {}]];
  for (const scenario of person.scenarios) {
    const overrides: PersonOverrides =
      scenario.field === "incomeChange"
        ? { incomeChange: scenario.value as IncomeChange }
        : { [scenario.field]: scenario.value };
    options.push([scenario.name, overrides]);
  }
  return options;
}

/** A person's balance by calendar year, extended past their own retirement
 * year (growth-only compounding, no further contributions) so it can be
 * summed with other people's series through a shared end year. Mirrors
 * app.py's project_series_by_year. */
export function projectSeriesByYear(
  person: Person,
  overrides: PersonOverrides,
  endYear: number,
  today: Date = new Date(),
): Map<number, number> {
  const balancePoints = projectBalance(person, overrides, today);
  const series = new Map<number, number>(balancePoints.map((p) => [p.year, p.balance]));
  const growthRate = (overrides.growthRatePct ?? person.growthRatePct) / 100;

  let year = Math.max(...series.keys());
  let balance = series.get(year)!;
  while (year < endYear) {
    year += 1;
    balance = balance * (1 + growthRate);
    series.set(year, balance);
  }
  return series;
}

export const MAX_HOUSEHOLD_COMBOS = 100;

export interface HouseholdCombo {
  label: string;
  series: Map<number, number>;
}

/** Every combination of each person's Base/scenarios, summed together —
 * e.g. 3 options for one person x 3 for another = 9 combined household
 * series. Returns an empty combo list (with the real totalCombos) if
 * there are too many to chart clearly. Mirrors app.py's
 * build_household_combo_data. */
export function buildHouseholdComboData(
  people: Person[],
  today: Date = new Date(),
): { combos: HouseholdCombo[]; totalCombos: number } {
  if (people.length === 0) return { combos: [], totalCombos: 0 };

  const perPersonChoices = people.map((person) =>
    personScenarioOptions(person).map(([name, overrides]) => ({ person, name, overrides })),
  );

  const totalCombos = perPersonChoices.reduce((acc, choices) => acc * choices.length, 1);
  if (totalCombos > MAX_HOUSEHOLD_COMBOS) return { combos: [], totalCombos };

  let endYear = today.getFullYear();
  for (const choices of perPersonChoices) {
    for (const { person, overrides } of choices) {
      const balances = projectBalance(person, overrides, today);
      endYear = Math.max(endYear, balances[balances.length - 1].year);
    }
  }

  const combos: HouseholdCombo[] = [];
  for (const combo of cartesianProduct(perPersonChoices)) {
    const label = combo.map(({ person, name }) => `${person.name}: ${name}`).join(", ");
    let total: Map<number, number> | null = null;
    for (const { person, overrides } of combo) {
      const series = projectSeriesByYear(person, overrides, endYear, today);
      if (total === null) {
        total = new Map(series);
      } else {
        for (const [year, value] of series) total.set(year, (total.get(year) ?? 0) + value);
      }
    }
    combos.push({ label, series: total! });
  }
  return { combos, totalCombos };
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, curr) => acc.flatMap((prefix) => curr.map((item) => [...prefix, item])), [
    [],
  ]);
}
