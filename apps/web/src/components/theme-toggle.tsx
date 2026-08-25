"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

const OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "auto", label: "Automático", Icon: Monitor },
] as const;

type Theme = (typeof OPTIONS)[number]["value"];

export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("guita-theme") as Theme | null;
      // Leer localStorage en el render (SSR) da hydration mismatch: hay que
      // esperar al efecto de montaje para sincronizar el estado inicial.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "light" || stored === "dark" || stored === "auto") setTheme(stored);
    } catch {
      // localStorage puede fallar en modo privado: el default "auto" alcanza.
    }
  }, []);

  function select(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem("guita-theme", next);
    } catch {
      // Si no se puede persistir, al menos aplicamos el tema en esta sesión.
    }
    applyTheme(next);
  }

  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => select(o.value)}
          aria-pressed={theme === o.value}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${theme === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          <o.Icon className="h-4 w-4" />
          {o.label}
        </button>
      ))}
    </div>
  );
}
