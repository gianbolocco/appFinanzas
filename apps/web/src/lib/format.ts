const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, locale = "es-AR") {
  const key = `${locale}:${currency}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatterCache.set(key, f);
  }
  return f;
}

export function formatMoney(amount: number, currency = "ARS", locale = "es-AR") {
  return getFormatter(currency, locale).format(amount);
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
