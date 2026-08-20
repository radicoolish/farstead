import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";

const THEME_KEY = "isp:theme";

function loadStoredMode(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Explicit light/dark/system theme choice, layered on top of the CSS's
 * own `prefers-color-scheme` fallback. "system" removes the override
 * entirely so the OS preference (and live changes to it) keep working;
 * "light"/"dark" stamp `data-theme` on <html>, which index.css's
 * `:root[data-theme="..."]` rules take priority over the media query.
 * Persisted so the choice survives a reload. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(loadStoredMode);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);
    window.localStorage.setItem(THEME_KEY, mode);
  }, [mode]);

  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
