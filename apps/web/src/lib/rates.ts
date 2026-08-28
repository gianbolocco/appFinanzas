import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Busca la cotización vigente a la fecha de la transacción.
 * Si no hay ninguna, cae a 1 y lo deja registrado: un rate faltante
 * corrompe amount_base en silencio, así que al menos queda rastro.
 *
 * Vive acá y no en actions.ts porque también la necesita el webhook de
 * Telegram, que usa el cliente service-role.
 */
export async function fetchRate(
  db: SupabaseClient,
  from: string,
  to: string,
  onDate?: string,
): Promise<number> {
  if (from === to) return 1;

  let q = db
    .from("exchange_rates")
    .select("rate")
    .eq("base", from)
    .eq("quote", to)
    .order("date", { ascending: false })
    .limit(1);
  if (onDate) q = q.lte("date", onDate);

  const { data } = await q.maybeSingle();
  if (data?.rate) return data.rate;

  // Probar el par inverso antes de rendirse
  let inv = db
    .from("exchange_rates")
    .select("rate")
    .eq("base", to)
    .eq("quote", from)
    .order("date", { ascending: false })
    .limit(1);
  if (onDate) inv = inv.lte("date", onDate);

  const { data: inverse } = await inv.maybeSingle();
  if (inverse?.rate) return 1 / inverse.rate;

  console.warn(`[guita] sin cotización ${from}->${to} al ${onDate ?? "hoy"}; usando 1`);
  return 1;
}
