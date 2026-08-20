import { useState, type SyntheticEvent } from "react";
import { describeExpense, EXPENSE_HORIZON_AGE } from "../calc";
import { useAppData } from "../state/AppDataContext";
import { ExpenseForm } from "./ExpenseForm";
import { ExpenseChart } from "./ExpenseChart";
import { HouseholdCashFlowCharts } from "./HouseholdCashFlowCharts";
import { NumberField } from "./NumberField";
import { SECTION_META } from "./AppNav";

const { Icon } = SECTION_META.expenses;

/** Section 3: Household Expenses. Expense CRUD, the stacked expense chart,
 * and — sharing the same Current Age — the household-wide Income vs.
 * Expenses cash-flow view. Mirrors app.py's Section 3 (which keeps the
 * cash-flow charts here too, not in a separate section). */
export function ExpensesSection() {
  const { people, expenses, addExpense, removeExpense, currentAge, setCurrentAge, withdrawalRatePct, setWithdrawalRatePct } =
    useAppData();

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
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.5rem" }}>
            {expenses.map((expense) => (
              <div key={expense.id} className="card-row">
                <div>
                  <strong>{expense.type}</strong> <span className="caption">— {describeExpense(expense)}</span>
                </div>
                <button type="button" onClick={() => removeExpense(expense.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <h3>Projected Household Expenses</h3>
          <div className="card" style={{ height: 360, marginBottom: "1.5rem" }}>
            <ExpenseChart expenses={expenses} currentAge={currentAge} horizonAge={EXPENSE_HORIZON_AGE} />
          </div>

          <h3>Household Income vs. Expenses</h3>
          <p className="caption">
            Combined take-home income, 401(k) withdrawal income, Social Security, and total expenses by age,
            with the surplus or deficit shown as bars. Once a person's earned income stops (their own
            retirement age), their 401(k) balance x withdrawal rate takes over; Social Security layers in
            independently once each person reaches their own claim age. This always reflects your actual,
            saved data — to explore a 401(k) scenario or freely adjust any input, use the Simulator section
            below.
          </p>
          <div className="field" style={{ maxWidth: 260, marginBottom: "1rem" }}>
            <label htmlFor="withdrawal-rate">401k Withdrawal Rate (%)</label>
            <NumberField id="withdrawal-rate" min={0} max={20} step="any" value={withdrawalRatePct} onChange={setWithdrawalRatePct} />
          </div>
          <HouseholdCashFlowCharts
            people={people}
            expenses={expenses}
            currentAge={currentAge}
            horizonAge={EXPENSE_HORIZON_AGE}
            withdrawalRatePct={withdrawalRatePct}
          />
        </>
      )}
    </section>
  );
}
