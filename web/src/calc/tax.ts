// Approximate, for planning purposes only — not tax advice. Federal
// brackets and the standard deduction are 2024 figures; state rates are
// single-number approximations (most states have their own bracket
// schedules, but modeling all 50 in full is out of scope for a planning
// tool, not a tax preparer). Ported from app.py.

export const FILING_STATUSES = [
  "Single", "Married Filing Jointly", "Married Filing Separately", "Head of Household",
] as const;
export type FilingStatus = (typeof FILING_STATUSES)[number];

/** [thresholdFloor, marginalRate] pairs, ascending. */
type Bracket = readonly [number, number];

const SINGLE_BRACKETS: Bracket[] = [
  [0, 0.10], [11600, 0.12], [47150, 0.22], [100525, 0.24],
  [191950, 0.32], [243725, 0.35], [609350, 0.37],
];

export const FEDERAL_BRACKETS_2024: Record<FilingStatus, Bracket[]> = {
  "Single": SINGLE_BRACKETS,
  "Married Filing Jointly": [
    [0, 0.10], [23200, 0.12], [94300, 0.22], [201050, 0.24],
    [383900, 0.32], [487450, 0.35], [731200, 0.37],
  ],
  "Head of Household": [
    [0, 0.10], [16550, 0.12], [63100, 0.22], [100500, 0.24],
    [191950, 0.32], [243700, 0.35], [609350, 0.37],
  ],
  // Married Filing Separately brackets track Single closely enough at most
  // incomes to approximate with the same table.
  "Married Filing Separately": SINGLE_BRACKETS,
};

export const STANDARD_DEDUCTION_2024: Record<FilingStatus, number> = {
  "Single": 14600,
  "Married Filing Jointly": 29200,
  "Married Filing Separately": 14600,
  "Head of Household": 21900,
};

/** Approximate effective state income tax rate (%) for a typical earner. */
export const STATE_TAX_RATES: Record<string, number> = {
  "Alabama": 5.0, "Alaska": 0.0, "Arizona": 2.5, "Arkansas": 4.4, "California": 9.3,
  "Colorado": 4.4, "Connecticut": 6.5, "Delaware": 6.6, "Florida": 0.0, "Georgia": 5.39,
  "Hawaii": 8.25, "Idaho": 5.8, "Illinois": 4.95, "Indiana": 3.05, "Iowa": 5.7,
  "Kansas": 5.7, "Kentucky": 4.5, "Louisiana": 4.25, "Maine": 7.15, "Maryland": 5.75,
  "Massachusetts": 5.0, "Michigan": 4.25, "Minnesota": 7.85, "Mississippi": 5.0, "Missouri": 4.95,
  "Montana": 5.9, "Nebraska": 5.84, "Nevada": 0.0, "New Hampshire": 0.0, "New Jersey": 6.37,
  "New Mexico": 4.9, "New York": 6.85, "North Carolina": 4.5, "North Dakota": 2.5, "Ohio": 3.5,
  "Oklahoma": 4.75, "Oregon": 8.75, "Pennsylvania": 3.07, "Rhode Island": 5.99, "South Carolina": 6.4,
  "South Dakota": 0.0, "Tennessee": 0.0, "Texas": 0.0, "Utah": 4.65, "Vermont": 6.6,
  "Virginia": 5.75, "Washington": 0.0, "West Virginia": 5.12, "Wisconsin": 5.3, "Wyoming": 0.0,
  "District of Columbia": 8.5,
};

export function calculateFederalTax(taxableIncome: number, filingStatus: FilingStatus): number {
  const brackets = FEDERAL_BRACKETS_2024[filingStatus];
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [threshold, rate] = brackets[i];
    if (taxableIncome <= threshold) break;
    const nextThreshold = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    tax += (Math.min(taxableIncome, nextThreshold) - threshold) * rate;
  }
  return tax;
}

/** Approximate combined federal + state effective tax rate (%) on gross
 * salary, for planning only — not tax advice. */
export function estimateEffectiveTaxRate(
  state: string,
  filingStatus: FilingStatus,
  annualSalary: number,
  pretaxReductions = 0,
): number {
  if (annualSalary <= 0) return 0;
  const taxableIncome = Math.max(
    annualSalary - STANDARD_DEDUCTION_2024[filingStatus] - pretaxReductions,
    0,
  );
  const federalRate = (calculateFederalTax(taxableIncome, filingStatus) / annualSalary) * 100;
  return federalRate + (STATE_TAX_RATES[state] ?? 0);
}
