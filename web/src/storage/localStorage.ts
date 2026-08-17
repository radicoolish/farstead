// Thin, typed wrapper around localStorage — the direct equivalent of the
// Streamlit app's two JSON files (people.json / expenses.json) for a
// single-user, client-only app. See PEOPLE_KEY / EXPENSES_KEY for the
// actual keys in use.

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted or non-JSON value under this key — fall back rather than
    // crash the app on load.
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const PEOPLE_KEY = "isp:people";
export const EXPENSES_KEY = "isp:expenses";
