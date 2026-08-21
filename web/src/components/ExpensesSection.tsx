import { useState, type SyntheticEvent } from "react";
import { EXPENSE_HORIZON_AGE } from "../calc";
import { useAppData } from "../state/AppDataContext";
import { resolveWithdrawalRate } from "../state/withdrawalRate";
import { ExpenseForm } from "./ExpenseForm";
import { ExpenseCard } from "./ExpenseCard";
import { ExpenseChart } from "./ExpenseChart";
import { HouseholdCashFlowCharts } from "./HouseholdCashFlowCharts";
import { NumberField } from "./NumberField";
import { WithdrawalRateInput } from "./WithdrawalRateInput";
import { SECTION_META } from "./AppNav";

const { Icon } = SECTION_META.expenses;

/** Section 3: Household Expenses. Expense CRUD, the stacked expense chart,
 * and — sharing the same Current Age — the household-wide Income vs.
 * Expenses cash-flow view. Mirrors app.py's Section 3 (which keeps the
 * cash-flow charts here too, not in a separate section). */
export function ExpensesSection() {
  const { people, expenses, addExpense, removeExpense, currentAge, setCurrentAge, withdrawalRate, setWithdrawalRate } = useAppData();

  const [formOpen, setFormOpen] = useState(() => expenses.length === 0);

  function handleToggle(e: SyntheticEvent<HTMLDetailsElement>) {
    setFormOpen(e.currentTarget.open);
  }

  return (
    <section>
      <h2 className="section-title">
        <Icon className="section-title-icon" />
        Household Expenses
      </h2>
      <p className="caption">
        Recurring and loan-based household expenses, projected by age up to {EXPENSE_HORIZON_AGE}
      </p>

      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="expenses-current-age">Current Age (for this projection)</label>
        <NumberField id="expenses-current-age" min={1} max={EXPENSE_HORIZON_AGE - 1} value={currentAge} onChange={setCurrentAge} />
      </div>

      <details className="panel" open={formOpen} onToggle={handleToggle}>
        <summary>Add an Expense</summary>
        <div className="panel-body">
          <ExpenseForm currentAge={currentAge} onAdd={addExpense} />
        </div>
      </details>

      {expenses.length === 0 ? (
        <p className="caption">No expenses added yet. Use the form above to add one.</p>
      ) : (
        <>
          <h3>Expenses</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.5rem" }}>
            {expenses.map((expense) => (
              <ExpenseCard key={expense.id} expense={expense} onRemove={() => removeExpense(expense.id)} />
            ))}
          </div>

          <h3>Projected Household Expenses</h3>
          <p className="caption">Every active expense stacked by type, by age — inflation-adjusted costs grow over time.</p>
          <div className="card" style={{ height: 360, marginBottom: "1.5rem" }}>
            <ExpenseChart expenses={expenses} currentAge={currentAge} horizonAge={EXPENSE_HORIZON_AGE} />
          </div>

          <h3>Household Income vs. Expenses</h3>
          <p className="caption">
            Combined take-home income, after-tax 401(k) withdrawal income, Social Security, and total expenses
            by age, with the surplus or deficit shown as bars. Once a person's earned income stops (their own
            retirement age), their 401(k) balance x withdrawal rate takes over — taxed at their Effective Tax
            Rate, plus a 10% early-withdrawal penalty for any Pre-tax withdrawal before age 60 (Roth is
            modeled tax- and penalty-free); Social Security layers in independently once each person reaches
            their own claim age. This always reflects your actual, saved data — to explore a 401(k) scenario
            or freely adjust any input, use the Simulator section below.
          </p>
          <WithdrawalRateInput label="401(k) Withdrawal Rate" value={withdrawalRate} onChange={setWithdrawalRate} />
          <HouseholdCashFlowCharts
            people={people}
            expenses={expenses}
            currentAge={currentAge}
            horizonAge={EXPENSE_HORIZON_AGE}
            withdrawalRate={resolveWithdrawalRate(withdrawalRate)}
          />
        </>
      )}
    </section>
  );
}
