// Puebla public.exchange_rates con las cotizaciones del día.
// Invocada por pg_cron una vez por día (ver migración 0007).
import { createClient } from "jsr:@supabase/supabase-js@2";

const QUOTES = ["ARS", "EUR", "BRL", "MXN", "CLP", "COP", "PEN", "UYU"];

Deno.serve(async () => {
  const accessKey = Deno.env.get("EXCHANGERATE_ACCESS_KEY");
  if (!accessKey) {
    return new Response(JSON.stringify({ error: "falta EXCHANGERATE_ACCESS_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url =
    `https://api.exchangerate.host/live?access_key=${accessKey}` +
    `&source=USD&currencies=${QUOTES.join(",")}`;

  const res = await fetch(url);
  const payload = await res.json();

  if (!payload.success || !payload.quotes) {
    return new Response(JSON.stringify({ error: "respuesta invalida", payload }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // La API devuelve { "USDARS": 1234.5, "USDEUR": 0.9, ... }
  const date = new Date().toISOString().slice(0, 10);
  const rows = Object.entries(payload.quotes as Record<string, number>).map(([pair, rate]) => ({
    base: pair.slice(0, 3),
    quote: pair.slice(3),
    rate,
    date,
    source: "api",
  }));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase
    .from("exchange_rates")
    .upsert(rows, { onConflict: "base,quote,date" });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, inserted: rows.length, date }), {
    headers: { "Content-Type": "application/json" },
  });
});
