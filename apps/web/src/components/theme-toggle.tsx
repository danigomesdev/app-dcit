"use client";

import { useLayoutEffect, useState } from "react";

import styles from "./theme-toggle.module.css";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  });

  // Re-apply the persisted theme after React's dev-mode Strict Mode remount,
  // which clears attributes the inline bootstrap script (app/layout.tsx) set
  // on <html> before hydration. No-op in production.
  useLayoutEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      document.documentElement.dataset.theme = stored;
    }
  }, []);

  function handleToggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      className={styles.iconButton}
      onClick={handleToggleTheme}
      aria-label="Alterar tema"
      aria-pressed={theme === "dark"}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 3a9 9 0 000 18z" fill="currentColor" />
      </svg>
    </button>
  );
}
