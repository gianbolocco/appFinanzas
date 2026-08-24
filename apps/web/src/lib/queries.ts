import "server-only";

import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/dal";
import { monthStartLocal } from "@/lib/dates";
import type { Rate } from "@/lib/money";
import { sumInBase } from "@/lib/money";

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
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: budgets, error } = await supabase
    .from("budgets")
    .select("*, category:categories(*)")
    .order("created_at", { ascending: true });
  if (error) throw error;

  // Buscar gastos del mes agrupados por categoría
  const { data: expenses } = await supabase
    .from("transactions")
    .select("category_id, amount, amount_base")
    .eq("is_installment_parent", false)
    .eq("type", "expense")
    .gte("date", from);

  const spentByCategory: Record<string, number> = {};
  for (const e of expenses ?? []) {
    if (e.category_id) {
      spentByCategory[e.category_id] = (spentByCategory[e.category_id] ?? 0) + e.amount;
    }
  }

  return budgets.map((b) => ({
    ...b,
    spent: b.category_id ? spentByCategory[b.category_id] ?? 0 : 0,
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
      ? Math.max(1, (targetDate.getFullYear() - now.getFullYear()) * 12 + (targetDate.getMonth() - now.getMonth()))
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
  return subs.filter((s) => s.active).reduce((sum, s) => sum + s.monthlyEquivalent, 0);
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
// ----------------------------------------------------------------------------

// Desglose por categoría (gastos del período)
export async function getCategoryBreakdown(opts?: { from?: string; to?: string }) {
  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select("amount, amount_base, currency, category:categories(id, name, color, icon)")
    .eq("is_installment_parent", false)
    .eq("type", "expense");

  if (opts?.from) q = q.gte("date", opts.from);
  if (opts?.to) q = q.lte("date", opts.to);

  const { data, error } = await q;
  if (error) throw error;

  const byCategory: Record<string, { name: string; color: string; icon: string | null; total: number }> = {};
  for (const t of data ?? []) {
    const cat = t.category as unknown as { id: string; name: string; color: string; icon: string | null } | null;
    if (!cat) continue;
    if (!byCategory[cat.id]) {
      byCategory[cat.id] = { name: cat.name, color: cat.color, icon: cat.icon, total: 0 };
    }
    byCategory[cat.id].total += t.amount;
  }

  return Object.values(byCategory).sort((a, b) => b.total - a.total);
}

// Tendencias temporales (últimos 6 meses: ingresos vs gastos)
export async function getMonthlyTrends() {
  const supabase = await createClient();
  const now = new Date();
  const months: { label: string; from: string; to: string }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    months.push({
      label: d.toLocaleDateString("es-AR", { month: "short" }),
      from: d.toISOString().slice(0, 10),
      to: next.toISOString().slice(0, 10),
    });
  }

  const results = await Promise.all(
    months.map(async (m) => {
      const { data } = await supabase
        .from("transactions")
        .select("type, amount")
        .eq("is_installment_parent", false)
        .in("type", ["income", "expense"])
        .gte("date", m.from)
        .lte("date", m.to);
      let income = 0;
      let expense = 0;
      for (const t of data ?? []) {
        if (t.type === "income") income += t.amount;
        else if (t.type === "expense") expense += t.amount;
      }
      return { month: m.label, ingresos: income, gastos: expense, ahorro: income - expense };
    }),
  );

  return results;
}

// Comparativa mes actual vs mes anterior
export async function getMonthComparison() {
  const supabase = await createClient();
  const now = new Date();

  const thisFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const prevTo = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const [currRes, prevRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount")
      .eq("is_installment_parent", false)
      .in("type", ["income", "expense"])
      .gte("date", thisFrom),
    supabase
      .from("transactions")
      .select("type, amount")
      .eq("is_installment_parent", false)
      .in("type", ["income", "expense"])
      .gte("date", prevFrom)
      .lte("date", prevTo),
  ]);

  function sum(data: { type: string; amount: number }[]) {
    let income = 0;
    let expense = 0;
    for (const t of data ?? []) {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
    }
    return { income, expense, ahorro: income - expense };
  }

  return {
    current: sum(currRes.data ?? []),
    previous: sum(prevRes.data ?? []),
  };
}

// Por método de pago (cuenta)
export async function getBreakdownByAccount(opts?: { from?: string; to?: string }) {
  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select("amount, type, account:accounts!transactions_account_id_fkey(id, name, type)")
    .eq("is_installment_parent", false)
    .in("type", ["expense", "income"]);

  if (opts?.from) q = q.gte("date", opts.from);
  if (opts?.to) q = q.lte("date", opts.to);

  const { data, error } = await q;
  if (error) throw error;

  const byAccount: Record<string, { name: string; type: string; income: number; expense: number }> = {};
  for (const t of data ?? []) {
    const acc = t.account as unknown as { id: string; name: string; type: string } | null;
    if (!acc) continue;
    if (!byAccount[acc.id]) {
      byAccount[acc.id] = { name: acc.name, type: acc.type, income: 0, expense: 0 };
    }
    if (t.type === "income") byAccount[acc.id].income += t.amount;
    else if (t.type === "expense") byAccount[acc.id].expense += t.amount;
  }

  return Object.values(byAccount).sort((a, b) => b.expense + b.income - (a.expense + a.income));
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

export async function getMonthlySummary() {
  const { profile } = await getCurrentUser();
  const from = monthStartLocal();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount, amount_base")
    .in("type", ["income", "expense"])
    .eq("is_installment_parent", false)
    .gte("date", from);

  if (error) throw error;

  const summary = { income: 0, expense: 0, incomeBase: 0, expenseBase: 0 };
  for (const t of data ?? []) {
    if (t.type === "income") {
      summary.income += t.amount;
      summary.incomeBase += t.amount_base;
    } else {
      summary.expense += t.amount;
      summary.expenseBase += t.amount_base;
    }
  }
  return { ...summary, baseCurrency: profile.base_currency };
}
