"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { monthStartLocal, monthEndLocal, addMonthsIso, todayLocal } from "@/lib/dates";

export const PERIODS = [
  { key: "mes", label: "Este mes" },
  { key: "anterior", label: "Mes anterior" },
  { key: "trimestre", label: "3 meses" },
  { key: "todo", label: "Todo" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

/** Traduce la clave de período a un rango de fechas. Server-safe. */
export function resolvePeriod(key: string | undefined): {
  from?: string;
  to?: string;
  label: string;
} {
  const now = new Date();
  switch (key) {
    case "anterior": {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: monthStartLocal(prev), to: monthEndLocal(prev), label: "Mes anterior" };
    }
    case "trimestre":
      return {
        from: addMonthsIso(monthStartLocal(now), -2),
        to: todayLocal(now),
        label: "Últimos 3 meses",
      };
    case "todo":
      return { label: "Histórico completo" };
    default:
      return { from: monthStartLocal(now), to: monthEndLocal(now), label: "Este mes" };
  }
}

export function PeriodPicker() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("periodo") ?? "mes";

  function select(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "mes") next.delete("periodo");
    else next.set("periodo", key);
    const qs = next.toString();
    router.push(qs ? `/dashboard/reportes?${qs}` : "/dashboard/reportes");
  }

  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => select(p.key)}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${current === p.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
