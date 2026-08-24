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
