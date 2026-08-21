import { calculateAge } from "./age";
import { DEFAULT_MARKET_CONDITION_DURATION_YEARS, effectiveGrowthRateForYear, MARKET_CONDITIONS } from "./marketConditions";
import type { AccountType, BalancePoint, ByAge, IncomeChange, Person, PersonOverrides, WithdrawalRate } from "./types";

/** One year's withdrawal from a single balance — a percentage of that
 * balance, or a fixed dollar amount clamped to what's actually left (so a
 * fixed withdrawal can't take the balance negative once it runs out). This
 * is the *gross* amount — what actually leaves the 401(k) balance itself;
 * see `netWithdrawal` for what's left to spend after tax and any early-
 * withdrawal penalty. */
function withdrawalAmountForYear(rate: WithdrawalRate, balance: number): number {
  if (rate.mode === "percent") return balance * (rate.value / 100);
  return Math.min(rate.value, Math.max(0, balance));
}

/** Real IRS early-withdrawal penalty age is 59½; this app only tracks
 * whole-year ages, so 60 is the closest faithful whole-year stand-in (a
 * withdrawal at age 59 is flagged even though someone born early in the
 * year may already be past 59½ by then — erring toward showing the
 * penalty rather than silently hiding a real cost). */
const EARLY_WITHDRAWAL_PENALTY_AGE = 60;
const EARLY_WITHDRAWAL_PENALTY_RATE = 0.1;

/** What's actually spendable from a gross 401(k) withdrawal, after income
 * tax and (if withdrawn before EARLY_WITHDRAWAL_PENALTY_AGE) the 10%
 * federal early-withdrawal penalty. Pre-tax only — Roth withdrawals are
 * modeled as fully tax- and penalty-free, since this app has no way to
 * track contribution-vs-earnings basis and so can't model the narrower
 * real rule that only Roth *earnings* face an early penalty. The gross
 * amount is still what depletes the 401(k) balance (see
 * `projectHouseholdBalanceByAge`) — tax and penalty come out of the
 * withdrawn cash on the way to the retiree, not as a second hit to the
 * account. */
function netWithdrawal(gross: number, accountType: AccountType, taxRatePct: number, ageThisYear: number): number {
  if (accountType === "Roth" || gross <= 0) return gross;
  const tax = gross * (taxRatePct / 100);
  const penalty = ageThisYear < EARLY_WITHDRAWAL_PENALTY_AGE ? gross * EARLY_WITHDRAWAL_PENALTY_RATE : 0;
  return Math.max(0, gross - tax - penalty);
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

/** 401(k) withdrawal *income* by household reference age, summed across
 * everyone, starting the year after each person's own earned income stops.
 * Each year's gross withdrawal is either a percentage of that person's
 * 401(k) balance at the start of the year, or a fixed dollar amount (see
 * `WithdrawalRate`) — the balance used (the chosen scenario's, or with no
 * override the base) is its projection through retirement, and depletes by
 * the *gross* withdrawal each year (matching `projectHouseholdBalanceByAge`).
 * What's added to this function's income totals is the *net* amount after
 * tax and any early-withdrawal penalty (see `netWithdrawal`) — the actual
 * spendable cash, consistent with earned income already being take-home
 * pay rather than gross salary. */
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
      addTo(totals, age, netWithdrawal(withdrawal, effective.accountType, effective.taxRatePct, personAge + i));
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

/** The real IRS rule taxes 0%, up to 50%, or up to 85% of Social Security
 * benefits depending on a tiered "combined income" formula — well beyond
 * this app's flat-effective-tax-rate model elsewhere. As a simplified
 * stand-in, 85% (the ceiling most retirees with other income, like 401(k)
 * withdrawals, actually hit) is treated as taxable at the person's own
 * Effective Tax Rate. */
const SS_TAXABLE_PORTION = 0.85;

/** Combined Social Security *income* by household reference age, summed
 * across everyone, starting the year each person reaches their own claim
 * age — independent of whether they're still working or already retired.
 * Net of the simplified SS_TAXABLE_PORTION tax treatment (see above). The
 * SSA earnings test, which can temporarily reduce benefits claimed before
 * full retirement age while still working, isn't modeled here. Mirrors
 * app.py's project_household_social_security_by_age. */
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
    const gross = effective.socialSecurityMonthly * 12;
    const net = gross * (1 - SS_TAXABLE_PORTION * (effective.taxRatePct / 100));
    for (let i = 0, age = currentAge; age <= horizonAge; age++, i++) {
      if (personAge + i >= claimAge) addTo(totals, age, net);
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

/** Year-by-year general (non-401(k)) savings balance from today through
 * retirement — simpler than projectBalance: a flat monthly contribution
 * (not tied to salary or an income-change step) compounding at the
 * person's own savings growth rate, stopping automatically at their
 * retirement age (no separate "stop contribution age" for savings — once
 * earned income stops, so does the ability to keep contributing). */
export function projectSavingsBalance(
  person: Person,
  overrides: PersonOverrides = {},
  today: Date = new Date(),
): BalancePoint[] {
  const effective = effectivePerson(person, overrides);
  const age = calculateAge(effective.birthday, today);
  const yearsToGrow = Math.max(effective.retirementAge - age, 0);
  const growthRate = effective.savingsGrowthRatePct / 100;
  const annualContribution = effective.savingsContributionMonthly * 12;

  let balance = effective.savingsBalance;
  const thisYear = today.getFullYear();
  const rows: BalancePoint[] = [{ age, year: thisYear, balance: round2(balance) }];

  for (let i = 1; i <= yearsToGrow; i++) {
    balance = balance * (1 + growthRate) + annualContribution;
    rows.push({ age: age + i, year: thisYear + i, balance: round2(balance) });
  }
  return rows;
}

/** Combined general-savings *income* drawn down each year to cover any
 * shortfall — expenses exceeding earned + 401(k) withdrawal + Social
 * Security income — summed across everyone. A general-purpose backstop,
 * unlike the 401(k) which only draws down at a fixed rate after
 * retirement: this is event-driven, available at *any* age (not just
 * retirement), and carries no tax or early-withdrawal penalty since it
 * isn't a retirement account. Each year, per person: contribute (while
 * still working), draw down whatever's needed from whoever has a balance
 * (list order — no per-person tax/penalty distinction makes whose dollar
 * covers it irrelevant), then grow what's left. */
export function projectHouseholdSavingsDrawdownByAge(
  people: Person[],
  currentAge: number,
  horizonAge: number,
  incomeByAge: ByAge,
  withdrawalByAge: ByAge,
  ssByAge: ByAge,
  expensesByAge: ByAge,
  overridesByPersonId: Record<string, PersonOverrides> = {},
  today: Date = new Date(),
): ByAge {
  const totals = zeroedByAge(currentAge, horizonAge);
  const state = people.map((p) => {
    const effective = effectivePerson(p, overridesByPersonId[p.id] ?? {});
    return {
      balance: effective.savingsBalance,
      growthRate: effective.savingsGrowthRatePct / 100,
      annualContribution: effective.savingsContributionMonthly * 12,
      personAge: calculateAge(effective.birthday, today),
      retirementAge: effective.retirementAge,
    };
  });

  for (let i = 0, age = currentAge; age <= horizonAge; age++, i++) {
    let remaining = Math.max(
      0,
      (expensesByAge.get(age) ?? 0) - (incomeByAge.get(age) ?? 0) - (withdrawalByAge.get(age) ?? 0) - (ssByAge.get(age) ?? 0),
    );
    let drawnThisYear = 0;
    for (const s of state) {
      const stillContributing = s.personAge + i <= s.retirementAge;
      const available = s.balance + (stillContributing ? s.annualContribution : 0);
      const draw = Math.min(remaining, Math.max(0, available));
      remaining -= draw;
      drawnThisYear += draw;
      s.balance = (available - draw) * (1 + s.growthRate);
    }
    addTo(totals, age, drawnThisYear);
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
