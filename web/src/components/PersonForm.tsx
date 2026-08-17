import { useId, useState, type FormEvent } from "react";
import type { AccountType, Person } from "../calc";
import type { PersonDraft } from "../hooks/usePeople";
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
            <input
              id={id("salary")}
              type="number"
              min={0}
              step="any"
              value={currentSalary}
              onChange={(e) => setCurrentSalary(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={id("contribution")}>401k Contribution (%)</label>
            <input
              id={id("contribution")}
              type="number"
              min={0}
              max={100}
              step="any"
              value={contributionPct}
              onChange={(e) => setContributionPct(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={id("hsa")}>Monthly HSA Contribution ($)</label>
            <input
              id={id("hsa")}
              type="number"
              min={0}
              step="any"
              value={hsaMonthly}
              onChange={(e) => setHsaMonthly(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={id("medical")}>Medical Insurance ($/mo)</label>
            <input
              id={id("medical")}
              type="number"
              min={0}
              step="any"
              value={medicalInsuranceMonthly}
              onChange={(e) => setMedicalInsuranceMonthly(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <div className="field">
            <TaxRateEstimator
              annualSalary={currentSalary}
              contributionPct={contributionPct}
              hsaMonthly={hsaMonthly}
              onEstimate={setTaxRatePct}
            />
          </div>
          <div className="field">
            <label htmlFor={id("tax-rate")}>Effective Tax Rate (%)</label>
            <input
              id={id("tax-rate")}
              type="number"
              min={0}
              max={60}
              step="any"
              value={taxRatePct}
              onChange={(e) => setTaxRatePct(Number(e.target.value))}
            />
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
            <input
              id={id("balance")}
              type="number"
              min={0}
              step="any"
              value={currentBalance}
              onChange={(e) => setCurrentBalance(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={id("match")}>% of Salary Matched</label>
            <input
              id={id("match")}
              type="number"
              min={0}
              max={100}
              step="any"
              value={matchPct}
              onChange={(e) => setMatchPct(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={id("raise")}>Annual Salary Increase (%)</label>
            <input
              id={id("raise")}
              type="number"
              min={0}
              max={50}
              step="any"
              value={salaryIncreasePct}
              onChange={(e) => setSalaryIncreasePct(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={id("growth")}>Annual Growth Rate (%)</label>
            <input
              id={id("growth")}
              type="number"
              min={0}
              max={50}
              step="any"
              value={growthRatePct}
              onChange={(e) => setGrowthRatePct(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <fieldset className="field">
            <label>Account Type</label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontWeight: 400 }}>
              <input
                type="radio"
                name={id("account-type")}
                checked={accountType === "Pre-tax"}
                onChange={() => setAccountType("Pre-tax")}
              />
              Pre-tax
            </label>{" "}
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontWeight: 400 }}>
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
            <input
              id={id("retirement-age")}
              type="number"
              min={1}
              max={100}
              value={retirementAge}
              onChange={(e) => setRetirementAge(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={id("stop-contribution-age")}>Stop Contribution Age</label>
            <input
              id={id("stop-contribution-age")}
              type="number"
              min={1}
              max={100}
              value={stopContributionAge}
              onChange={(e) => setStopContributionAge(Number(e.target.value))}
            />
            <p className="caption">Age at which contributions and the employer match stop.</p>
          </div>
        </div>
      </div>

      <h3>Social Security</h3>
      <div className="field-row">
        <div className="field">
          <label htmlFor={id("ss-claim-age")}>Claim Age</label>
          <input
            id={id("ss-claim-age")}
            type="number"
            min={62}
            max={70}
            value={socialSecurityClaimAge}
            onChange={(e) => setSocialSecurityClaimAge(Number(e.target.value))}
          />
          <p className="caption">Earliest claim age is 62; delayed retirement credits stop accruing at 70.</p>
        </div>
        <div className="field">
          <SocialSecurityEstimator
            annualSalary={currentSalary}
            birthday={birthday}
            claimAge={socialSecurityClaimAge}
            onEstimate={setSocialSecurityMonthly}
          />
          <label htmlFor={id("ss-monthly")} style={{ marginTop: "0.5rem" }}>
            Estimated Monthly Benefit ($)
          </label>
          <input
            id={id("ss-monthly")}
            type="number"
            min={0}
            step="any"
            value={socialSecurityMonthly}
            onChange={(e) => setSocialSecurityMonthly(Number(e.target.value))}
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
