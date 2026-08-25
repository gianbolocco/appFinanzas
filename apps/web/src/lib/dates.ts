export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Fecha de hoy en la zona horaria del usuario. `toISOString()` daría UTC. */
export function todayLocal(now: Date = new Date()): string {
  return iso(now.getFullYear(), now.getMonth(), now.getDate());
}

export function monthStartLocal(now: Date = new Date()): string {
  return iso(now.getFullYear(), now.getMonth(), 1);
}

export function monthEndLocal(now: Date = new Date()): string {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return iso(last.getFullYear(), last.getMonth(), last.getDate());
}

/** Suma meses sin desbordar: 31/01 + 1 mes = 28/02, no 03/03. */
export function addMonthsIso(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return iso(target.getFullYear(), target.getMonth(), Math.min(d, lastDay));
}

export function addCadenceIso(isoDate: string, cadence: Cadence): string {
  if (cadence === "weekly") {
    const [y, m, d] = isoDate.split("-").map(Number);
    const next = new Date(y, m - 1, d + 7);
    return iso(next.getFullYear(), next.getMonth(), next.getDate());
  }
  const months = cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12;
  return addMonthsIso(isoDate, months);
}
