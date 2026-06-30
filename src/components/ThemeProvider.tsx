"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { buildColorVars } from "@/lib/theme";

type Theme = "dark" | "light";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} });

export function useTheme() {
  return useContext(Ctx);
}

export function ThemeProvider({
  children,
  primaryColor,
  secondaryColor,
}: {
  children: ReactNode;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}) {
  const [theme, setTheme] = useState<Theme>("dark");

  // Read localStorage on mount (avoids SSR mismatch)
  useEffect(() => {
    const saved = localStorage.getItem("tokeville-theme") as Theme | null;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  // Apply data-theme to <html> so CSS vars cascade everywhere
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("tokeville-theme", theme);
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  // Build workspace color override vars
  const isDark = theme === "dark";
  const colorVars = primaryColor ? buildColorVars(primaryColor, isDark) : {};

  // Apply workspace color vars to :root as inline style on a wrapper
  return (
    <Ctx.Provider value={{ theme, toggle }}>
      <div
        style={colorVars as React.CSSProperties}
        className="contents"
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** Small sun/moon toggle button — drop it in any header. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      onClick={toggle}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-foreground cursor-pointer ${className}`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
