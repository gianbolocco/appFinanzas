"use client";

import { useEffect } from "react";

export function ThemeInit() {
  useEffect(() => {
    try {
      const pref = localStorage.getItem("guita-theme");
      const dark =
        pref === "dark" ||
        (pref !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    } catch {
      // Sin localStorage se queda en tema claro; no vale romper el render por esto.
    }
  }, []);

  return null;
}
