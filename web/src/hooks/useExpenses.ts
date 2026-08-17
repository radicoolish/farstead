import { useEffect, useState } from "react";
import { EXPENSES_KEY, loadFromStorage, saveToStorage } from "../storage/localStorage";
import type { Expense } from "../calc";

export type ExpenseDraft = Omit<Expense, "id">;

/** Expenses state, backed by localStorage — the same role people.json /
 * usePeople plays for people. */
export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromStorage<Expense[]>(EXPENSES_KEY, []));

  useEffect(() => {
    saveToStorage(EXPENSES_KEY, expenses);
  }, [expenses]);

  function addExpense(draft: ExpenseDraft): void {
    const expense: Expense = { ...draft, id: crypto.randomUUID() };
    setExpenses((prev) => [...prev, expense]);
  }

  function removeExpense(id: string): void {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  /** Wholesale replace — used by data import to load a scenario file. */
  function replaceExpenses(next: Expense[]): void {
    setExpenses(next);
  }

  function clearExpenses(): void {
    setExpenses([]);
  }

  return { expenses, addExpense, removeExpense, replaceExpenses, clearExpenses };
}
