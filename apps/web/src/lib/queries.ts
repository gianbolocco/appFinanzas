import "server-only";

import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/dal";
import { addMonthsIso, monthEndLocal, monthStartLocal, todayLocal } from "@/lib/dates";
import type { Rate } from "@/lib/money";
import { sumInBase, convert } from "@/lib/money";

// ----------------------------------------------------------------------------
// Cuentas
// ----------------------------------------------------------------------------
export async function getAccounts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

/** Cotizaciones más recientes disponibles, una por par base/quote. */
export async function getRates(): Promise<Rate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("base, quote, rate, date")
    .order("date", { ascending: false })
    .limit(200);
  if (error) throw error;

  const latest = new Map<string, Rate>();
  for (const r of data ?? []) {
    const key = `${r.base}:${r.quote}`;
    if (!latest.has(key)) latest.set(key, { base: r.base, quote: r.quote, rate: r.rate });
  }
  return [...latest.values()];
}

/**
 * Suma los saldos convirtiendo a la moneda base.
 * `partial: true` significa que faltó al menos un rate y el total está incompleto:
 * la UI debe decirlo en vez de mostrar un número que no significa nada.
 */
export function getTotalBalance(
  accounts: { balance: number; currency: string }[],
  baseCurrency: string,
  rates: Rate[],
): { total: number; partial: boolean } {
  return sumInBase(accounts, baseCurrency, rates);
}

// ----------------------------------------------------------------------------
// Categorías
// ----------------------------------------------------------------------------
export async function getCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("is_predefined", { ascending: false })
    .order("order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Detalle de cuenta individual
// ----------------------------------------------------------------------------
export async function getAccountById(accountId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("accounts").select("*").eq("id", accountId).single();
  if (error) throw error;
  return data;
}

export async function getAccountMonthlyStats(accountId: string) {
  const supabase = await createClient();
  const from = monthStartLocal();

  // Movimientos donde esta cuenta es el origen
  const { data: outgoing, error } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("account_id", accountId)
    .eq("is_installment_parent", false)
    .gte("date", from);

  if (error) throw error;

  let income = 0;
  let expense = 0;
  let transferOut = 0;

  for (const t of outgoing ?? []) {
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
    else if (t.type === "transfer") transferOut += t.amount;
  }

  // Transferencias entrantes: dest_amount ya está en la moneda de esta cuenta.
  // No se multiplica por exchange_rate (ese rate convierte a moneda base).
  const { data: incoming } = await supabase
    .from("transactions")
    .select("amount, dest_amount")
    .eq("to_account_id", accountId)
    .eq("type", "transfer")
    .gte("date", from);

  const transferIn = (incoming ?? []).reduce((s, t) => s + (t.dest_amount ?? t.amount), 0);

  return { income, expense, transferIn, transferOut };
}

export async function getAccountBalanceAtDate(accountId: string, date: string) {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("balance")
    .eq("id", accountId)
    .single();
  if (!account) return 0;

  // Deshacer los movimientos posteriores a `date` para retroceder el saldo.
  const { data: outgoing } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("account_id", accountId)
    .eq("is_installment_parent", false)
    .gt("date", date);

  const { data: incoming } = await supabase
    .from("transactions")
    .select("amount, dest_amount")
    .eq("to_account_id", accountId)
    .eq("type", "transfer")
    .gt("date", date);

  let delta = 0;
  for (const t of outgoing ?? []) {
    if (t.type === "income") delta -= t.amount;
    else delta += t.amount; // expense y transfer salieron de esta cuenta
  }
  for (const t of incoming ?? []) {
    delta -= t.dest_amount ?? t.amount;
  }

  return account.balance + delta;
}

export async function getAccountTransactions(accountId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "*, category:categories(*), account:accounts!transactions_account_id_fkey(*), to_account:accounts!transactions_to_account_id_fkey(*)",
    )
    .eq("is_installment_parent", false)
    .or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Presupuestos (con cálculo de gastado por categoría en el mes)
// ----------------------------------------------------------------------------
export async function getBudgets() {
  const supabase = await createClient();

  const { data: budgets, error } = await supabase
    .from("budgets")
    .select("*, category:categories(*)")
    .order("created_at", { ascending: true });
  if (error) throw error;

  // Gastos del mes por categoría, en moneda base y sin aportes a metas.
  const { data: expenses } = await supabase
    .from("transactions")
    .select("category_id, amount_base")
    .eq("is_installment_parent", false)
    .eq("type", "expense")
    .is("goal_id", null)
    .gte("date", monthStartLocal());

  const spentByCategory: Record<string, number> = {};
  for (const e of expenses ?? []) {
    if (e.category_id) {
      spentByCategory[e.category_id] = (spentByCategory[e.category_id] ?? 0) + e.amount_base;
    }
  }

  // `spent` ya viene en moneda base; el límite puede estar en otra.
  const [{ profile }, rates] = await Promise.all([getCurrentUser(), getRates()]);

  return budgets.map((b) => ({
    ...b,
    spent: b.category_id ? (spentByCategory[b.category_id] ?? 0) : 0,
    /** Límite en moneda base. null si falta la cotización: no se inventa el número. */
    limitBase: convert(b.amount_limit, b.currency, profile.base_currency, rates),
  }));
}

// ----------------------------------------------------------------------------
// Metas de ahorro (con progreso y sugerencia de aporte mensual)
// ----------------------------------------------------------------------------
export async function getGoals() {
  const supabase = await createClient();
  const { data: goals, error } = await supabase
    .from("goals")
    .select("*")
    .order("archived", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const now = new Date();

  return goals.map((g) => {
    const progress = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
    const remaining = Math.max(0, g.target_amount - g.current_amount);
    const targetDate = g.target_date ? new Date(g.target_date + "T00:00:00") : null;
    const monthsLeft = targetDate
      ? Math.max(
          1,
          (targetDate.getFullYear() - now.getFullYear()) * 12 +
            (targetDate.getMonth() - now.getMonth()),
        )
      : null;
    const suggestedMonthly = monthsLeft && remaining > 0 ? remaining / monthsLeft : null;

    return {
      ...g,
      progress: Math.min(100, progress),
      remaining,
      monthsLeft,
      suggestedMonthly,
      isCompleted: g.current_amount >= g.target_amount,
    };
  });
}

export async function getGoalContributions(goalId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("*")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Suscripciones (con total mensual y alertas)
// ----------------------------------------------------------------------------
export async function getSubscriptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, category:categories(*), account:accounts(*)")
    .order("active", { ascending: false })
    .order("next_date", { ascending: true });
  if (error) throw error;

  const now = new Date();
  const inSevenDays = new Date(now);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  // Calcular equivalente mensual de cada suscripción
  const monthlyFactor: Record<string, number> = {
    weekly: 4.33,
    monthly: 1,
    quarterly: 1 / 3,
    yearly: 1 / 12,
  };

  return data.map((s) => {
    const nextDate = new Date(s.next_date + "T00:00:00");
    const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      ...s,
      monthlyEquivalent: s.amount * (monthlyFactor[s.cadence] ?? 1),
      daysUntil,
      isDueSoon: s.active && daysUntil <= 7 && daysUntil >= 0,
      isOverdue: s.active && daysUntil < 0,
    };
  });
}

export async function getSubscriptionsMonthlyTotal() {
  const subs = await getSubscriptions();
  return subs
    .filter((s) => s.active)
    .reduce<Record<string, number>>((acc, s) => {
      acc[s.currency] = (acc[s.currency] ?? 0) + s.monthlyEquivalent;
      return acc;
    }, {});
}

// Historial de pagos de una suscripción
export async function getSubscriptionPayments(subscriptionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, amount, currency, date, note, account:accounts!transactions_account_id_fkey(name)")
    .eq("subscription_id", subscriptionId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Reportes
//
// Todos los agregados suman `amount_base` (moneda base del usuario), nunca
// `amount`: con cuentas en ARS y USD, sumar el monto crudo da un número que no
// significa nada. Y todos excluyen `goal_id`: un aporte a una meta salió de la
// cuenta pero no se consumió, así que no es gasto.
// ----------------------------------------------------------------------------

export type ReportFilters = {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
};

/** Ingresos, gastos y balance del período. Base de todos los KPIs. */
export async function getPeriodTotals(f?: ReportFilters) {
  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select("type, amount_base")
    .eq("is_installment_parent", false)
    .in("type", ["income", "expense"])
    .is("goal_id", null);

  if (f?.from) q = q.gte("date", f.from);
  if (f?.to) q = q.lte("date", f.to);
  if (f?.accountId) q = q.eq("account_id", f.accountId);
  if (f?.categoryId) q = q.eq("category_id", f.categoryId);

  const { data, error } = await q;
  if (error) throw error;

  let income = 0;
  let expense = 0;
  for (const t of data ?? []) {
    if (t.type === "income") income += t.amount_base;
    else expense += t.amount_base;
  }
  return { income, expense, balance: income - expense };
}

/** Gastos del período agrupados por categoría, de mayor a menor. */
export async function getCategoryBreakdown(f?: ReportFilters) {
  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select("amount_base, category:categories(id, name, color, icon)")
    .eq("type", "expense")
    .eq("is_installment_parent", false)
    .is("goal_id", null);

  if (f?.from) q = q.gte("date", f.from);
  if (f?.to) q = q.lte("date", f.to);
  if (f?.accountId) q = q.eq("account_id", f.accountId);
  if (f?.categoryId) q = q.eq("category_id", f.categoryId);

  const { data, error } = await q;
  if (error) throw error;

  const byCategory: Record<
    string,
    { id: string; name: string; color: string; icon: string | null; total: number }
  > = {};
  for (const t of data ?? []) {
    const cat = t.category as unknown as {
      id: string;
      name: string;
      color: string;
      icon: string | null;
    } | null;
    if (!cat) continue;
    if (!byCategory[cat.id]) {
      byCategory[cat.id] = {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        total: 0,
      };
    }
    byCategory[cat.id].total += t.amount_base;
  }

  return Object.values(byCategory).sort((a, b) => b.total - a.total);
}

/** Movimientos del período agrupados por cuenta / método de pago. */
export async function getBreakdownByAccount(f?: ReportFilters) {
  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select("amount_base, type, account:accounts!transactions_account_id_fkey(id, name, type)")
    .eq("is_installment_parent", false)
    .in("type", ["expense", "income"])
    .is("goal_id", null);

  if (f?.from) q = q.gte("date", f.from);
  if (f?.to) q = q.lte("date", f.to);
  if (f?.accountId) q = q.eq("account_id", f.accountId);
  if (f?.categoryId) q = q.eq("category_id", f.categoryId);

  const { data, error } = await q;
  if (error) throw error;

  const byAccount: Record<
    string,
    { id: string; name: string; type: string; income: number; expense: number }
  > = {};
  for (const t of data ?? []) {
    const acc = t.account as unknown as { id: string; name: string; type: string } | null;
    if (!acc) continue;
    if (!byAccount[acc.id]) {
      byAccount[acc.id] = { id: acc.id, name: acc.name, type: acc.type, income: 0, expense: 0 };
    }
    if (t.type === "income") byAccount[acc.id].income += t.amount_base;
    else byAccount[acc.id].expense += t.amount_base;
  }

  return Object.values(byAccount).sort((a, b) => b.expense - a.expense);
}

/**
 * Evolución mensual: una sola consulta por todo el rango, agrupada en memoria.
 * (Antes era una consulta por mes.)
 */
export async function getMonthlyTrends(months = 6, f?: ReportFilters) {
  const supabase = await createClient();
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  let q = supabase
    .from("transactions")
    .select("type, amount_base, date")
    .eq("is_installment_parent", false)
    .in("type", ["income", "expense"])
    .is("goal_id", null)
    .gte("date", monthStartLocal(first))
    .lte("date", monthEndLocal(now));

  if (f?.accountId) q = q.eq("account_id", f.accountId);
  if (f?.categoryId) q = q.eq("category_id", f.categoryId);

  const { data, error } = await q;
  if (error) throw error;

  const buckets = new Map<
    string,
    { month: string; ingresos: number; gastos: number; balance: number }
  >();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthStartLocal(d).slice(0, 7), {
      month: d.toLocaleDateString("es-AR", { month: "short" }),
      ingresos: 0,
      gastos: 0,
      balance: 0,
    });
  }

  for (const t of data ?? []) {
    const bucket = buckets.get(t.date.slice(0, 7));
    if (!bucket) continue;
    if (t.type === "income") bucket.ingresos += t.amount_base;
    else bucket.gastos += t.amount_base;
  }
  for (const bucket of buckets.values()) bucket.balance = bucket.ingresos - bucket.gastos;

  return [...buckets.values()];
}

/**
 * Cuotas que vencen en los próximos 30 días.
 * El saldo de la cuenta solo se mueve por cuota vencida, así que estas son
 * plata que ya debés pero todavía no salió. El horizonte es rodante y no "hasta
 * fin de mes": el día 28 eso no mostraría nada aunque debas de todo.
 */
export async function getPendingInstallments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, note, amount, amount_base, currency, date, installment_number, installments_total")
    .eq("is_installment_parent", false)
    .not("installment_number", "is", null)
    .gt("date", todayLocal())
    .lte("date", addMonthsIso(todayLocal(), 1))
    .order("date", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTransactions(opts?: {
  limit?: number;
  type?: string;
  categoryId?: string;
  accountId?: string;
  from?: string;
  to?: string;
  search?: string;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select(
      "*, category:categories(*), account:accounts!transactions_account_id_fkey(*), to_account:accounts!transactions_to_account_id_fkey(*)",
    )
    .eq("is_installment_parent", false)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (opts?.limit) q = q.limit(opts.limit);
  if (opts?.type) q = q.eq("type", opts.type);
  if (opts?.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts?.accountId) q = q.eq("account_id", opts.accountId);
  if (opts?.from) q = q.gte("date", opts.from);
  if (opts?.to) q = q.lte("date", opts.to);
  if (opts?.search) q = q.ilike("note", `%${opts.search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}
