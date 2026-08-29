import { monthStartLocal, monthEndLocal, monthEndOfIso, addMonthsIso, todayLocal } from "./dates";

export const PERIODS = [
  { key: "mes", label: "Este mes" },
  { key: "anterior", label: "Mes ant." },
  { key: "trimestre", label: "3 meses" },
  { key: "anio", label: "12 meses" },
  { key: "todo", label: "Todo" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export type ResolvedPeriod = {
  from?: string;
  to?: string;
  /** Mismo largo, corrido hacia atrás: sirve para los deltas. Ausente en "todo". */
  prevFrom?: string;
  prevTo?: string;
  label: string;
  /** Cuántos meses muestra el gráfico de evolución. */
  months: number;
};

/** Cuántos meses hay que retroceder para obtener el período anterior comparable. */
const SHIFT: Record<string, number> = { mes: 1, anterior: 1, trimestre: 3, anio: 12 };

/** Traduce la clave de período a un rango de fechas. Server-safe. */
export function resolvePeriod(key: string | undefined, now = new Date()): ResolvedPeriod {
  let from: string;
  let to: string;
  let label: string;

  switch (key) {
    case "anterior": {
      // Aritmética sobre el ISO, no sobre un Date construido con componentes
      // locales: eso último depende de la zona del proceso.
      from = addMonthsIso(monthStartLocal(now), -1);
      to = monthEndOfIso(from);
      label = "Mes anterior";
      break;
    }
    case "trimestre":
      from = addMonthsIso(monthStartLocal(now), -2);
      to = todayLocal(now);
      label = "Últimos 3 meses";
      break;
    case "anio":
      from = addMonthsIso(monthStartLocal(now), -11);
      to = todayLocal(now);
      label = "Últimos 12 meses";
      break;
    case "todo":
      // Sin rango previo: no hay contra qué comparar el histórico completo.
      return { label: "Histórico completo", months: 12 };
    default:
      from = monthStartLocal(now);
      to = monthEndLocal(now);
      label = "Este mes";
  }

  const shift = SHIFT[key ?? "mes"] ?? 1;
  return {
    from,
    to,
    prevFrom: addMonthsIso(from, -shift),
    prevTo: addMonthsIso(to, -shift),
    label,
    months: key === "anio" ? 12 : 6,
  };
}

/**
 * Ritmo de gasto del mes en curso y proyección de cierre.
 * ponytail: proyección lineal; ignora que el gasto no se reparte parejo
 * (sueldo, vencimientos a fin de mes). Alcanza para saber si vas rápido o lento.
 */
export function monthPace(spent: number, now = new Date()) {
  const today = todayLocal(now);
  const day = Number(today.slice(8, 10));
  const daysInMonth = Number(monthEndOfIso(today).slice(8, 10));
  return { day, daysInMonth, projected: (spent / day) * daysInMonth };
}

/** Variación porcentual. Sin base previa no hay porcentaje que valga: devuelve null. */
export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}
