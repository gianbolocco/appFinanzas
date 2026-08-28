const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, locale = "es-AR", digits = 2) {
  const key = `${locale}:${currency}:${digits}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formatterCache.set(key, f);
  }
  return f;
}

export function formatMoney(amount: number, currency = "ARS", locale = "es-AR") {
  return getFormatter(currency, locale).format(amount);
}

/**
 * Sin centavos. Para KPIs y totales: los decimales solo agregan ruido y ancho,
 * y en mobile son la diferencia entre que el monto entre o se corte.
 */
export function formatMoneyRound(amount: number, currency = "ARS", locale = "es-AR") {
  return getFormatter(currency, locale, 0).format(amount);
}

const compactFormatter = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Para ejes de gráficos: 80 mil, 1,2 M. */
export function formatCompact(amount: number) {
  return compactFormatter.format(amount);
}

export function formatSigned(amount: number, currency = "ARS", locale = "es-AR") {
  const f = getFormatter(currency, locale);
  const sign = amount > 0 ? "+" : amount < 0 ? "−" : "";
  return `${sign}${f.format(Math.abs(amount))}`;
}

export function formatDate(iso: string, locale = "es-AR") {
  const d = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatShortDate(iso: string, locale = "es-AR") {
  const d = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}
