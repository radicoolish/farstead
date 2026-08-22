import { useEffect, useState } from "react";
import { loadFromStorage, saveToStorage, SIMPLE_HOUSEHOLD_KEY } from "../storage/localStorage";
import { defaultSimpleHousehold, type SimpleExpense, type SimpleHousehold } from "../calc";

export type SimpleExpenseDraft = Omit<SimpleExpense, "id">;

/** Simple-mode household state, backed by its own localStorage key —
 * completely independent from Advanced mode's people/expenses (see
 * calc/simple.ts), so switching planning modes never overwrites either
 * one's saved data. A single object rather than a list, since Simple mode
 * treats the household as one aggregate unit. */
export function useSimpleHousehold() {
  const [household, setHousehold] = useState<SimpleHousehold>(() => ({
    // Spread over the defaults first so a household saved before a field
    // existed still gets a sane value for it, the same role
    // usePeople's normalizePerson plays for Advanced mode.
    ...defaultSimpleHousehold(),
    ...loadFromStorage<Partial<SimpleHousehold>>(SIMPLE_HOUSEHOLD_KEY, {}),
  }));

  useEffect(() => {
    saveToStorage(SIMPLE_HOUSEHOLD_KEY, household);
  }, [household]);

  function update(patch: Partial<SimpleHousehold>): void {
    setHousehold((prev) => ({ ...prev, ...patch }));
  }

  function addExpense(draft: SimpleExpenseDraft): void {
    const expense: SimpleExpense = { ...draft, id: crypto.randomUUID() };
    setHousehold((prev) => ({ ...prev, expenses: [...prev.expenses, expense] }));
  }

  function removeExpense(id: string): void {
    setHousehold((prev) => ({ ...prev, expenses: prev.expenses.filter((e) => e.id !== id) }));
  }

  function reset(): void {
    setHousehold(defaultSimpleHousehold());
  }

  return { household, update, addExpense, removeExpense, reset };
}
