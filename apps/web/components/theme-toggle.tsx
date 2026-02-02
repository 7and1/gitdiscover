"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}

