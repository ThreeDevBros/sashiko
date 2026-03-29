import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark-grey" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

const STORAGE_KEY = "sashiko-theme";

function getSystemTheme(): "light" | "dark-grey" | "dark" {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return "dark-grey";
  }
  return "light";
}

type ResolvedTheme = "light" | "dark-grey" | "dark";

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "light" || theme === "dark-grey" || theme === "dark") return theme;
  return getSystemTheme();
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark", "dark-grey");
  root.classList.add(resolveTheme(theme));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored && ["system", "light", "dark-grey", "dark"].includes(stored)) return stored;
    } catch {}
    return "system";
  });

  // Apply theme class on mount and changes
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  // Listen for system theme changes when using "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme("system");
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
