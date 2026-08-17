import type { Expense, Person } from "../calc";

// JSON export/import for this app's own (camelCase) schema — not required
// to round-trip with the Streamlit app's snake_case people.json/expenses.json;
// see calc/types.ts for why the two aren't kept byte-compatible.

export interface ExportPayload {
  app: "investment-scenario-planner-web";
  version: 1;
  exportedAt: string;
  people: Person[];
  expenses: Expense[];
  settings: {
    currentAge: number;
    withdrawalRatePct: number;
  };
}

const REQUIRED_PERSON_KEYS = [
  "id", "name", "birthday", "currentSalary", "contributionPct", "currentBalance",
  "matchPct", "salaryIncreasePct", "growthRatePct", "accountType", "retirementAge", "scenarios",
] as const;

const REQUIRED_EXPENSE_KEYS = ["id", "type", "monthlyAmount", "isLoan", "isPerpetuity", "applyInflation"] as const;

export function buildExportPayload(
  people: Person[],
  expenses: Expense[],
  currentAge: number,
  withdrawalRatePct: number,
): ExportPayload {
  return {
    app: "investment-scenario-planner-web",
    version: 1,
    exportedAt: new Date().toISOString().slice(0, 10),
    people,
    expenses,
    settings: { currentAge, withdrawalRatePct },
  };
}

/** Returns an error message if `data` isn't a valid scenario export, else null. */
export function validateImportPayload(data: unknown): string | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return "That file isn't a valid scenario file (expected a JSON object at the top level).";
  }
  const obj = data as Record<string, unknown>;
  if (!("people" in obj) || !("expenses" in obj)) {
    return `That file is missing "people" or "expenses" — it doesn't look like a scenario file exported from this app.`;
  }
  const { people, expenses } = obj;
  if (!Array.isArray(people) || !Array.isArray(expenses)) {
    return `"people" and "expenses" must be lists — this file's structure doesn't match a scenario export.`;
  }
  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    if (typeof person !== "object" || person === null || !REQUIRED_PERSON_KEYS.every((k) => k in person)) {
      return `Person #${i + 1} in the file is missing required fields — this doesn't look like a valid scenario file.`;
    }
  }
  for (let i = 0; i < expenses.length; i++) {
    const expense = expenses[i];
    if (typeof expense !== "object" || expense === null || !REQUIRED_EXPENSE_KEYS.every((k) => k in expense)) {
      return `Expense #${i + 1} in the file is missing required fields — this doesn't look like a valid scenario file.`;
    }
  }
  return null;
}

/** Triggers a browser download of `payload` as a JSON file — the
 * client-only equivalent of Streamlit's st.download_button. */
export function downloadJson(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
