import { monthStartLocal, monthEndLocal, addMonthsIso, todayLocal } from "./dates";

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
