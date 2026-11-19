"use client";

import { Moon, Sun } from "lucide-react";

const THEME_STORAGE_KEY = "velo-pulse-theme";

export function ThemeToggle() {
  const toggleTheme = () => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";
    root.classList.toggle("dark", nextTheme === "dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage errors in restricted browsing contexts
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Przełącz motyw jasny lub ciemny"
      title="Przełącz motyw jasny / ciemny"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[var(--bg-carbon-elevated)] text-[var(--text-on-dark)] transition-colors hover:border-[#FF4D1C]/60 hover:text-[#FF4D1C] cursor-pointer"
    >
      <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
    </button>
  );
}
