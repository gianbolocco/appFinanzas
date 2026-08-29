export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

/**
 * Zona horaria de la app. Las fechas se calculan siempre acá y nunca en la del
 * proceso: en Vercel el servidor corre en UTC, así que entre las 21 y las 24
 * hora argentina "hoy" devolvía mañana y el movimiento caía en el día — o en el
 * mes — equivocado.
 * ponytail: fija. `users.timezone` ya existe en la base para el día que haya
 * usuarios en otro huso; ahí esto pasa a ser un parámetro.
 */
const TZ = "America/Argentina/Buenos_Aires";

// en-CA formatea como YYYY-MM-DD, que es el mismo formato que guarda Postgres.
const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Fecha de hoy en la zona del usuario. `toISOString()` daría UTC. */
export function todayLocal(now: Date = new Date()): string {
  return isoFormatter.format(now);
}

export function monthStartLocal(now: Date = new Date()): string {
  return monthStartOfIso(todayLocal(now));
}

export function monthEndLocal(now: Date = new Date()): string {
  return monthEndOfIso(todayLocal(now));
}

/** Primer día del mes de una fecha ISO. */
export function monthStartOfIso(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/** Último día del mes de una fecha ISO. Contempla febrero bisiesto. */
export function monthEndOfIso(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  // Día 0 del mes siguiente es el último del actual. En UTC para no arrastrar
  // la zona del proceso a una cuenta que es puro calendario.
  const last = new Date(Date.UTC(y, m, 0));
  return iso(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
}

/** Suma meses sin desbordar: 31/01 + 1 mes = 28/02, no 03/03. */
export function addMonthsIso(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return iso(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay));
}

export function addCadenceIso(isoDate: string, cadence: Cadence): string {
  if (cadence === "weekly") {
    const [y, m, d] = isoDate.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 7));
    return iso(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
  }
  const months = cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12;
  return addMonthsIso(isoDate, months);
}
