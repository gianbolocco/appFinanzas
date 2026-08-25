import { addMonthsIso } from "@/lib/dates";

export type Rate = { base: string; quote: string; rate: number };

const PIVOT = "USD";

function directRate(from: string, to: string, rates: Rate[]): number | null {
  const direct = rates.find((r) => r.base === from && r.quote === to);
  if (direct) return direct.rate;
  const inverse = rates.find((r) => r.base === to && r.quote === from);
  if (inverse && inverse.rate !== 0) return 1 / inverse.rate;
  return null;
}

/**
 * Convierte entre monedas usando rate directo, inverso, o triangulando por USD.
 * Devuelve null si no alcanza la información: quien llama decide qué hacer,
 * en vez de recibir un 1 silencioso que corrompe el número.
 */
export function convert(amount: number, from: string, to: string, rates: Rate[]): number | null {
  if (from === to) return amount;

  const direct = directRate(from, to, rates);
  if (direct !== null) return amount * direct;

  const toPivot = directRate(from, PIVOT, rates);
  const fromPivot = directRate(PIVOT, to, rates);
  if (toPivot !== null && fromPivot !== null) return amount * toPivot * fromPivot;

  return null;
}

/**
 * Suma saldos de monedas mixtas convirtiendo a `base`.
 * `partial: true` significa que se omitió al menos un saldo por falta de rate.
 */
export function sumInBase(
  items: { balance: number; currency: string }[],
  base: string,
  rates: Rate[],
): { total: number; partial: boolean } {
  let total = 0;
  let partial = false;
  for (const item of items) {
    const converted = convert(item.balance, item.currency, base, rates);
    if (converted === null) partial = true;
    else total += converted;
  }
  return { total, partial };
}

/**
 * Reparte un total en n cuotas de 2 decimales sin perder centavos:
 * la diferencia por redondeo se acumula en la primera cuota.
 */
export function splitInstallments(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const each = Math.floor(cents / n);
  const remainder = cents - each * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? each + remainder : each) / 100);
}

export function installmentDates(startIso: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonthsIso(startIso, i));
}

/** Cuántas de esas fechas ya vencieron (incluye hoy). */
export function dueThrough(dates: string[], todayIso: string): number {
  return dates.filter((d) => d <= todayIso).length;
}
