import type { ByAge, Expense } from "./types";

/** {age: annualCost} for age in currentAge..horizonAge.
 *
 * Loans are a fixed payment that stops once the remaining term elapses.
 * Everything else is either active the whole horizon (perpetuity) or only
 * between startAge/stopAge, with its monthly cost compounding by the
 * inflation rate every year from today regardless of when it's active — a
 * cost that starts 5 years from now is already 5 years' worth of inflation
 * higher by the time it kicks in. Mirrors app.py's
 * project_expense_annual_costs. */
export function projectExpenseAnnualCosts(expense: Expense, currentAge: number, horizonAge: number): ByAge {
  const results: ByAge = new Map();
  const monthly = expense.monthlyAmount;
  const inflationRate = expense.applyInflation ? (expense.inflationRate || 0) / 100 : 0;

  for (let i = 0, age = currentAge; age <= horizonAge; age++, i++) {
    let annual: number;
    if (expense.isLoan) {
      const active = i < (expense.remainingTermYears ?? 0);
      annual = active ? monthly * 12 : 0;
    } else {
      const active = expense.isPerpetuity
        ? true
        : expense.startAge !== undefined &&
          expense.stopAge !== undefined &&
          expense.startAge <= age &&
          age <= expense.stopAge;
      const inflatedMonthly = monthly * Math.pow(1 + inflationRate, i);
      annual = active ? inflatedMonthly * 12 : 0;
    }
    results.set(age, annual);
  }
  return results;
}

/** Total household expenses by age, summed across every expense. Mirrors
 * app.py's project_household_total_expenses_by_age. */
export function projectHouseholdTotalExpensesByAge(
  expenses: Expense[],
  currentAge: number,
  horizonAge: number,
): ByAge {
  const totals: ByAge = new Map();
  for (let age = currentAge; age <= horizonAge; age++) totals.set(age, 0);
  for (const expense of expenses) {
    for (const [age, cost] of projectExpenseAnnualCosts(expense, currentAge, horizonAge)) {
      totals.set(age, (totals.get(age) ?? 0) + cost);
    }
  }
  return totals;
}

/** Wide-format rows — one per age, one numeric key per expense type present
 * — the shape a stacked bar chart (Recharts) wants, unlike Altair's long
 * format in the original app.py (build_expense_chart_df). Types with $0
 * cost at a given age are simply absent from that row's keys. */
export type ExpenseChartRow = { age: number } & Record<string, number>;

export function buildExpenseChartData(
  expenses: Expense[],
  currentAge: number,
  horizonAge: number,
): ExpenseChartRow[] {
  const rows: ExpenseChartRow[] = [];
  const rowByAge = new Map<number, ExpenseChartRow>();
  for (let age = currentAge; age <= horizonAge; age++) {
    const row: ExpenseChartRow = { age };
    rows.push(row);
    rowByAge.set(age, row);
  }
  for (const expense of expenses) {
    for (const [age, cost] of projectExpenseAnnualCosts(expense, currentAge, horizonAge)) {
      if (cost <= 0) continue;
      const row = rowByAge.get(age)!;
      row[expense.type] = (row[expense.type] ?? 0) + cost;
    }
  }
  return rows;
}

/** One-line human summary, e.g. "$2,250/mo — loan, 11 yrs remaining" or
 * "$500/mo — ongoing — 3.0% inflation". Mirrors app.py's describe_expense. */
export function describeExpense(expense: Expense): string {
  const monthlyTxt = `$${expense.monthlyAmount.toLocaleString("en-US")}/mo`;
  if (expense.isLoan) {
    return `${monthlyTxt} — loan, ${expense.remainingTermYears ?? 0} yrs remaining`;
  }
  const timing = expense.isPerpetuity ? "ongoing" : `ages ${expense.startAge}–${expense.stopAge}`;
  const inflationTxt = expense.applyInflation
    ? `${expense.inflationRate.toFixed(1)}% inflation`
    : "no inflation";
  return `${monthlyTxt} — ${timing} — ${inflationTxt}`;
}
