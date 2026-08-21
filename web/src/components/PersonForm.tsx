import { useId, useState, type FormEvent } from "react";
import type { AccountType, Person } from "../calc";
import type { PersonDraft } from "../hooks/usePeople";
import { NumberField } from "./NumberField";
import { TaxRateEstimator } from "./TaxRateEstimator";
import { SocialSecurityEstimator } from "./SocialSecurityEstimator";

const TODAY_ISO = new Date().toISOString().slice(0, 10);

interface PersonFormProps {
  /** Present for editing an existing person; absent for adding a new one. */
  initial?: Person;
  onSubmit: (draft: PersonDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

/** "Tell Me About Yourself" — every income, 401(k), and Social Security
 * input for one person in a single form, reused for both creating a new
 * person and editing an existing one. Mirrors the Streamlit app's
 * consolidated onboarding form (app.py, Section 1). */
export function PersonForm({ initial, onSubmit, onCancel, submitLabel }: PersonFormProps) {
  // Every field id is namespaced to this instance — the add form and an
  // in-progress edit form can be mounted at the same time, and duplicate
  // DOM ids break label associations (and any id-based lookup) silently.
  const uid = useId();
  const id = (suffix: string) => `${uid}-${suffix}`;

  const [name, setName] = useState(initial?.name ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "1990-01-01");
  const [currentSalary, setCurrentSalary] = useState(initial?.currentSalary ?? 0);
  const [contributionPct, setContributionPct] = useState(initial?.contributionPct ?? 6);
  const [hsaMonthly, setHsaMonthly] = useState(initial?.hsaMonthly ?? 0);
  const [medicalInsuranceMonthly, setMedicalInsuranceMonthly] = useState(
    initial?.medicalInsuranceMonthly ?? 0,
  );
  const [taxRatePct, setTaxRatePct] = useState(initial?.taxRatePct ?? 22);

  const [currentBalance, setCurrentBalance] = useState(initial?.currentBalance ?? 0);
  const [matchPct, setMatchPct] = useState(initial?.matchPct ?? 3);
  const [salaryIncreasePct, setSalaryIncreasePct] = useState(initial?.salaryIncreasePct ?? 3);
  const [growthRatePct, setGrowthRatePct] = useState(initial?.growthRatePct ?? 7);
  const [accountType, setAccountType] = useState<AccountType>(initial?.accountType ?? "Pre-tax");
  const [retirementAge, setRetirementAge] = useState(initial?.retirementAge ?? 65);
  const [stopContributionAge, setStopContributionAge] = useState(
    initial?.stopContributionAge ?? initial?.retirementAge ?? 65,
  );

  const [socialSecurityClaimAge, setSocialSecurityClaimAge] = useState(
    initial?.socialSecurityClaimAge ?? 67,
  );
  const [socialSecurityMonthly, setSocialSecurityMonthly] = useState(
    initial?.socialSecurityMonthly ?? 0,
  );

  const [savingsBalance, setSavingsBalance] = useState(initial?.savingsBalance ?? 0);
  const [savingsGrowthRatePct, setSavingsGrowthRatePct] = useState(initial?.savingsGrowthRatePct ?? 4);
  const [savingsContributionMonthly, setSavingsContributionMonthly] = useState(
    initial?.savingsContributionMonthly ?? 0,
  );

  const [nameError, setNameError] = useState<string | null>(null);

  const grossMonthly = currentSalary / 12;
  const netMonthly =
    grossMonthly -
    (grossMonthly * contributionPct) / 100 -
    hsaMonthly -
    medicalInsuranceMonthly -
    (grossMonthly * taxRatePct) / 100;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required.");
      return;
    }
    onSubmit({
      name: name.trim(),
      birthday,
      currentSalary,
      contributionPct,
      hsaMonthly,
      medicalInsuranceMonthly,
      taxRatePct,
      currentBalance,
      matchPct,
      salaryIncreasePct,
      growthRatePct,
      accountType,
      retirementAge,
      stopContributionAge,
      socialSecurityClaimAge,
      socialSecurityMonthly,
      savingsBalance,
      savingsGrowthRatePct,
      savingsContributionMonthly,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>Basics</h3>
      <div className="field-row">
        <div className="field">
          <label htmlFor={id("name")}>Name</label>
          <input
            id={id("name")}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
          />
          {nameError && <p className="error-text">{nameError}</p>}
        </div>
        <div className="field">
          <label htmlFor={id("birthday")}>Birthday</label>
          <input
            id={id("birthday")}
            type="date"
            value={birthday}
            min="1930-01-01"
            max={TODAY_ISO}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </div>
      </div>

      <h3>Paycheck &amp; Deductions</h3>
      <div className="field-row">
        <div>
          <div className="field">
            <label htmlFor={id("salary")}>Salary ($/yr)</label>
            <NumberField id={id("salary")} min={0} step="any" value={currentSalary} onChange={setCurrentSalary} />
          </div>
          <div className="field">
            <label htmlFor={id("contribution")}>401k Contribution (%)</label>
            <NumberField id={id("contribution")} min={0} max={100} step="any" value={contributionPct} onChange={setContributionPct} />
          </div>
          <div className="field">
            <label htmlFor={id("hsa")}>Monthly HSA Contribution ($)</label>
            <NumberField id={id("hsa")} min={0} step="any" value={hsaMonthly} onChange={setHsaMonthly} />
          </div>
          <div className="field">
            <label htmlFor={id("medical")}>Medical Insurance ($/mo)</label>
            <NumberField id={id("medical")} min={0} step="any" value={medicalInsuranceMonthly} onChange={setMedicalInsuranceMonthly} />
          </div>
        </div>
        <div>
          <div className="field">
            <label htmlFor={id("tax-rate")}>Effective Tax Rate (%)</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <NumberField
                id={id("tax-rate")}
                min={0}
                max={60}
                step="any"
                value={taxRatePct}
                onChange={setTaxRatePct}
                style={{ flex: 1, minWidth: 0 }}
              />
              <TaxRateEstimator annualSalary={currentSalary} contributionPct={contributionPct} hsaMonthly={hsaMonthly} onEstimate={setTaxRatePct} />
            </div>
          </div>
          {currentSalary > 0 && (
            <p className="caption">
              Estimated net monthly income: <strong>${netMonthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong>
            </p>
          )}
        </div>
      </div>

      <h3>401(k) Details</h3>
      <div className="field-row">
        <div>
          <div className="field">
            <label htmlFor={id("balance")}>Current 401(k) Balance ($)</label>
            <NumberField id={id("balance")} min={0} step="any" value={currentBalance} onChange={setCurrentBalance} />
          </div>
          <div className="field">
            <label htmlFor={id("match")}>% of Salary Matched</label>
            <NumberField id={id("match")} min={0} max={100} step="any" value={matchPct} onChange={setMatchPct} />
          </div>
          <div className="field">
            <label htmlFor={id("raise")}>Annual Salary Increase (%)</label>
            <NumberField id={id("raise")} min={0} max={50} step="any" value={salaryIncreasePct} onChange={setSalaryIncreasePct} />
          </div>
          <div className="field">
            <label htmlFor={id("growth")}>Annual Growth Rate (%)</label>
            <NumberField id={id("growth")} min={0} max={50} step="any" value={growthRatePct} onChange={setGrowthRatePct} />
          </div>
        </div>
        <div>
          <fieldset className="field">
            <label>Account Type</label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontWeight: 400, whiteSpace: "nowrap" }}>
              <input
                type="radio"
                name={id("account-type")}
                checked={accountType === "Pre-tax"}
                onChange={() => setAccountType("Pre-tax")}
              />
              Pre-tax
            </label>{" "}
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontWeight: 400, whiteSpace: "nowrap" }}>
              <input
                type="radio"
                name={id("account-type")}
                checked={accountType === "Roth"}
                onChange={() => setAccountType("Roth")}
              />
              Roth
            </label>
          </fieldset>
          <div className="field">
            <label htmlFor={id("retirement-age")}>Retirement / Draw Age</label>
            <NumberField id={id("retirement-age")} min={1} max={100} value={retirementAge} onChange={setRetirementAge} />
          </div>
          <div className="field">
            <label htmlFor={id("stop-contribution-age")}>Stop Contribution Age</label>
            <NumberField id={id("stop-contribution-age")} min={1} max={100} value={stopContributionAge} onChange={setStopContributionAge} />
            <p className="caption">Age at which contributions and the employer match stop.</p>
          </div>
        </div>
      </div>

      <h3>Social Security</h3>
      <div className="field-row">
        <div className="field">
          <label htmlFor={id("ss-claim-age")}>Claim Age</label>
          <NumberField id={id("ss-claim-age")} min={62} max={70} value={socialSecurityClaimAge} onChange={setSocialSecurityClaimAge} />
          <p className="caption">Earliest claim age is 62; delayed retirement credits stop accruing at 70.</p>
        </div>
        <div className="field">
          <label htmlFor={id("ss-monthly")}>Estimated Monthly Benefit ($)</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <NumberField
              id={id("ss-monthly")}
              min={0}
              step="any"
              value={socialSecurityMonthly}
              onChange={setSocialSecurityMonthly}
              style={{ flex: 1, minWidth: 0 }}
            />
            <SocialSecurityEstimator
              annualSalary={currentSalary}
              birthday={birthday}
              claimAge={socialSecurityClaimAge}
              onEstimate={setSocialSecurityMonthly}
            />
          </div>
        </div>
      </div>

      <h3>General Savings</h3>
      <p className="caption" style={{ marginTop: 0 }}>
        Cash, brokerage, or high-yield savings — separate from the 401(k), with no early-withdrawal
        penalty or special tax when drawn on.
      </p>
      <div className="field-row">
        <div className="field">
          <label htmlFor={id("savings-balance")}>Current Savings Balance ($)</label>
          <NumberField id={id("savings-balance")} min={0} step="any" value={savingsBalance} onChange={setSavingsBalance} />
        </div>
        <div className="field">
          <label htmlFor={id("savings-growth")}>Annual Growth Rate (%)</label>
          <NumberField id={id("savings-growth")} min={0} max={50} step="any" value={savingsGrowthRatePct} onChange={setSavingsGrowthRatePct} />
        </div>
        <div className="field">
          <label htmlFor={id("savings-contribution")}>Monthly Savings Contribution ($)</label>
          <NumberField
            id={id("savings-contribution")}
            min={0}
            step="any"
            value={savingsContributionMonthly}
            onChange={setSavingsContributionMonthly}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
        <button type="submit" className="primary">
          {submitLabel ?? (initial ? "Save Changes" : "Add Person")}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
