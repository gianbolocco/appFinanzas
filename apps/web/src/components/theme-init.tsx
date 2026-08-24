"use client";

import { useEffect } from "react";

export function ThemeInit() {
  useEffect(() => {
    try {
      const pref = localStorage.getItem("guita-theme");
      const dark =
        pref === "dark" || (!pref && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    } catch {}
  }, []);

  return null;
}
