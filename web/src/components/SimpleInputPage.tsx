import { useId, useState } from "react";
import { formatCompactCurrency, simpleHouseholdToPerson, type SimpleHousehold } from "../calc";
import type { SimpleExpenseDraft } from "../hooks/useSimpleHousehold";
import { NumberField } from "./NumberField";
import { TaxRateEstimator } from "./TaxRateEstimator";
import { SIMPLE_SECTION_META } from "./SimpleNav";

const { Icon } = SIMPLE_SECTION_META.inputs;

/** A minimal %/$ toggle for the 401(k) withdrawal rate, local to Simple
 * mode — deliberately not the shared WithdrawalRateInput, which is built
 * around WithdrawalRateState (remembers both values across a mode
 * switch); Simple mode just stores the one active WithdrawalRate value,
 * consistent with everything else here being the plainer version. */
function SimpleWithdrawalRateField({
  household,
  onUpdate,
}: {
  household: SimpleHousehold;
  onUpdate: (patch: Partial<SimpleHousehold>) => void;
}) {
  const uid = useId();
  const { withdrawalRate } = household;
  return (
    <div className="field" style={{ maxWidth: 280 }}>
      <label htmlFor={uid}>401(k) Withdrawal Rate</label>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <div style={{ display: "flex", flex: "none" }}>
          <button
            type="button"
            className={withdrawalRate.mode === "percent" ? "primary" : undefined}
            style={{ borderRadius: "7px 0 0 7px", padding: "0.5rem 0.75rem" }}
            onClick={() => onUpdate({ withdrawalRate: { mode: "percent", value: withdrawalRate.mode === "percent" ? withdrawalRate.value : 4 } })}
            aria-pressed={withdrawalRate.mode === "percent"}
          >
            %
          </button>
          <button
            type="button"
            className={withdrawalRate.mode === "dollar" ? "primary" : undefined}
            style={{ borderRadius: "0 7px 7px 0", padding: "0.5rem 0.75rem", marginLeft: -1 }}
            onClick={() => onUpdate({ withdrawalRate: { mode: "dollar", value: withdrawalRate.mode === "dollar" ? withdrawalRate.value : 40000 } })}
            aria-pressed={withdrawalRate.mode === "dollar"}
          >
            $
          </button>
        </div>
        <NumberField
          id={uid}
          min={0}
          max={withdrawalRate.mode === "percent" ? 20 : undefined}
          step="any"
          value={withdrawalRate.value}
          onChange={(v) => onUpdate({ withdrawalRate: { ...withdrawalRate, value: v } })}
        />
      </div>
      <p className="caption" style={{ marginTop: "0.3rem" }}>
        {withdrawalRate.mode === "percent" ? "% of the 401(k) balance withdrawn each year." : "A fixed dollar amount withdrawn each year."}
      </p>
    </div>
  );
}

/** Simple mode's single input page — every field the household needs to
 * enter, in one place, instead of Advanced mode's five-section flow.
 * Social Security isn't collected at all — it's auto-estimated from
 * household income (see calc/simple.ts), same formula Advanced mode's
 * "Estimate my benefit" button uses. */
export function SimpleInputPage({
  household,
  onUpdate,
  onAddExpense,
  onRemoveExpense,
}: {
  household: SimpleHousehold;
  onUpdate: (patch: Partial<SimpleHousehold>) => void;
  onAddExpense: (draft: SimpleExpenseDraft) => void;
  onRemoveExpense: (id: string) => void;
}) {
  const uid = useId();
  const id = (suffix: string) => `${uid}-${suffix}`;

  const [newStartAge, setNewStartAge] = useState(household.retirementAge);
  const [newStopAge, setNewStopAge] = useState(85);
  const [newMonthlyAmount, setNewMonthlyAmount] = useState(0);

  const estimatedSocialSecurityMonthly = simpleHouseholdToPerson(household).socialSecurityMonthly;

  function handleAddExpense() {
    onAddExpense({ startAge: newStartAge, stopAge: newStopAge, monthlyAmount: newMonthlyAmount });
    setNewMonthlyAmount(0);
  }

  return (
    <section>
      <h2 className="section-title">
        <Icon className="section-title-icon" />
        Household Inputs
      </h2>
      <p className="caption">Everything the household needs, on one page — see the Results tab for the answer.</p>

      <h3>Household</h3>
      <div className="field-row">
        <div className="field">
          <label htmlFor={id("age")}>Current Age</label>
          <NumberField id={id("age")} min={1} max={100} value={household.currentAge} onChange={(v) => onUpdate({ currentAge: v })} />
        </div>
        <div className="field">
          <label htmlFor={id("income")}>Household Income ($/yr)</label>
          <NumberField id={id("income")} min={0} step="any" value={household.householdIncome} onChange={(v) => onUpdate({ householdIncome: v })} />
        </div>
      </div>

      <h3>401(k)</h3>
      <div className="field-row">
        <div>
          <div className="field">
            <label htmlFor={id("balance")}>Current 401(k) Balance ($)</label>
            <NumberField id={id("balance")} min={0} step="any" value={household.currentBalance} onChange={(v) => onUpdate({ currentBalance: v })} />
          </div>
          <div className="field">
            <label htmlFor={id("contribution")}>401(k) Contribution (%)</label>
            <NumberField
              id={id("contribution")}
              min={0}
              max={100}
              step="any"
              value={household.contributionPct}
              onChange={(v) => onUpdate({ contributionPct: v })}
            />
          </div>
          <div className="field">
            <label htmlFor={id("match")}>% of Salary Matched</label>
            <NumberField id={id("match")} min={0} max={100} step="any" value={household.matchPct} onChange={(v) => onUpdate({ matchPct: v })} />
          </div>
          <div className="field">
            <label htmlFor={id("growth")}>401(k) Growth Rate (%)</label>
            <NumberField id={id("growth")} min={0} max={50} step="any" value={household.growthRatePct} onChange={(v) => onUpdate({ growthRatePct: v })} />
          </div>
        </div>
        <div>
          <div className="field">
            <label htmlFor={id("raise")}>Annual Salary Increase (%)</label>
            <NumberField
              id={id("raise")}
              min={0}
              max={50}
              step="any"
              value={household.salaryIncreasePct}
              onChange={(v) => onUpdate({ salaryIncreasePct: v })}
            />
          </div>
          <div className="field">
            <label htmlFor={id("retirement-age")}>Retirement Age</label>
            <NumberField id={id("retirement-age")} min={1} max={100} value={household.retirementAge} onChange={(v) => onUpdate({ retirementAge: v })} />
          </div>
          <div className="field">
            <label htmlFor={id("tax-rate")}>Effective Tax Rate (%)</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <NumberField
                id={id("tax-rate")}
                min={0}
                max={60}
                step="any"
                value={household.taxRatePct}
                onChange={(v) => onUpdate({ taxRatePct: v })}
                style={{ flex: 1, minWidth: 0 }}
              />
              <TaxRateEstimator
                annualSalary={household.householdIncome}
                contributionPct={household.contributionPct}
                hsaMonthly={0}
                onEstimate={(ratePct) => onUpdate({ taxRatePct: ratePct })}
              />
            </div>
          </div>
          <SimpleWithdrawalRateField household={household} onUpdate={onUpdate} />
        </div>
      </div>
      <p className="caption">
        Estimated Social Security: <strong>{formatCompactCurrency(estimatedSocialSecurityMonthly)}/mo</strong>, starting at
        age 67 — auto-calculated from household income, for planning only.
      </p>

      <h3>Savings</h3>
      <p className="caption" style={{ marginTop: 0 }}>
        Cash, brokerage, or high-yield savings — separate from the 401(k), with no early-withdrawal penalty or special
        tax when drawn on.
      </p>
      <div className="field-row">
        <div className="field">
          <label htmlFor={id("savings-balance")}>Current Savings Balance ($)</label>
          <NumberField id={id("savings-balance")} min={0} step="any" value={household.savingsBalance} onChange={(v) => onUpdate({ savingsBalance: v })} />
        </div>
        <div className="field">
          <label htmlFor={id("savings-growth")}>Savings Growth Rate (%)</label>
          <NumberField
            id={id("savings-growth")}
            min={0}
            max={50}
            step="any"
            value={household.savingsGrowthRatePct}
            onChange={(v) => onUpdate({ savingsGrowthRatePct: v })}
          />
        </div>
      </div>

      <h3>Expenses</h3>
      <p className="caption" style={{ marginTop: 0 }}>
        Total household expenses by age range, instead of itemized by category — add as many ranges as needed.
      </p>
      <div className="field" style={{ maxWidth: 220 }}>
        <label htmlFor={id("inflation")}>Household Inflation Rate (%)</label>
        <NumberField
          id={id("inflation")}
          min={0}
          max={20}
          step="any"
          value={household.inflationRatePct}
          onChange={(v) => onUpdate({ inflationRatePct: v })}
        />
        <p className="caption">Applied to every expense range below.</p>
      </div>

      {household.expenses.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
          {household.expenses.map((expense) => (
            <div key={expense.id} className="card card-row">
              <div>
                Ages {expense.startAge}–{expense.stopAge}: <strong>${expense.monthlyAmount.toLocaleString("en-US")}/mo</strong>
              </div>
              <button type="button" className="danger" onClick={() => onRemoveExpense(expense.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="field-row">
          <div className="field">
            <label htmlFor={id("new-start")}>Start Age</label>
            <NumberField id={id("new-start")} min={1} max={100} value={newStartAge} onChange={setNewStartAge} />
          </div>
          <div className="field">
            <label htmlFor={id("new-stop")}>Stop Age</label>
            <NumberField id={id("new-stop")} min={1} max={100} value={newStopAge} onChange={setNewStopAge} />
          </div>
          <div className="field">
            <label htmlFor={id("new-amount")}>Monthly Amount ($)</label>
            <NumberField id={id("new-amount")} min={0} step="any" value={newMonthlyAmount} onChange={setNewMonthlyAmount} />
          </div>
        </div>
        <button type="button" onClick={handleAddExpense}>
          Add Expense Range
        </button>
      </div>
    </section>
  );
}
