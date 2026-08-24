import "server-only";

import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/dal";

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

export function getTotalBalance(accounts: { balance: number; currency: string }[]) {
  if (accounts.length === 0) return 0;
  // Por ahora suma simple asumiendo misma moneda; la conversión se hace en Fase 2 multi-moneda
  return accounts.reduce((sum, a) => sum + a.balance, 0);
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
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount, currency, account_id, to_account_id")
    .eq("account_id", accountId)
    .gte("date", from);

  if (error) throw error;

  let income = 0;
  let expense = 0;
  let transferIn = 0;
  let transferOut = 0;

  for (const t of data ?? []) {
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
    else if (t.type === "transfer") transferOut += t.amount;
  }

  // Transferencias entrantes (donde esta cuenta es el destino)
  const { data: incoming } = await supabase
    .from("transactions")
    .select("amount, currency, exchange_rate")
    .eq("to_account_id", accountId)
    .gte("date", from);

  for (const t of incoming ?? []) {
    transferIn += t.amount * (t.exchange_rate ?? 1);
  }

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

  // Sumar transacciones después de esa fecha para restarlas del saldo actual
  const { data: txs } = await supabase
    .from("transactions")
    .select("type, amount, exchange_rate")
    .eq("account_id", accountId)
    .gt("date", date);

  const { data: incoming } = await supabase
    .from("transactions")
    .select("amount, exchange_rate")
    .eq("to_account_id", accountId)
    .gt("date", date);

  let delta = 0;
  for (const t of txs ?? []) {
    if (t.type === "income") delta -= t.amount;
    else if (t.type === "expense") delta += t.amount;
    else if (t.type === "transfer") delta += t.amount;
  }
  for (const t of incoming ?? []) {
    delta -= t.amount * (t.exchange_rate ?? 1);
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
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount, amount_base")
    .gte("date", from);

  if (error) throw error;

  const summary = { income: 0, expense: 0, incomeBase: 0, expenseBase: 0 };
  for (const t of data ?? []) {
    if (t.type === "income") {
      summary.income += t.amount;
      summary.incomeBase += t.amount_base;
    } else if (t.type === "expense") {
      summary.expense += t.amount;
      summary.expenseBase += t.amount_base;
    }
  }
  return { ...summary, baseCurrency: profile.base_currency };
}
