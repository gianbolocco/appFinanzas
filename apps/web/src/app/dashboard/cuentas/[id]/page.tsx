import { notFound } from "next/navigation";
import { Banknote, Landmark, CreditCard, Smartphone, PiggyBank, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { getCurrentUser } from "@/lib/dal";
import {
  getAccountById,
  getAccountMonthlyStats,
  getAccountBalanceAtDate,
  getAccountTransactions,
  getAccounts,
  getCategories,
} from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { AccountTransactionList } from "./account-tx-list";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cash: Banknote,
  bank: Landmark,
  credit_card: CreditCard,
  debit_card: CreditCard,
  wallet: Smartphone,
  savings: PiggyBank,
};

const TYPE_LABELS: Record<string, string> = {
  cash: "Efectivo",
  bank: "Banco",
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
  wallet: "Billetera",
  savings: "Ahorro",
};

export default async function AccountDetailPage({ params }: PageProps<"/dashboard/cuentas/[id]">) {
  const { id } = await params;
  const { profile } = await getCurrentUser();

  let account;
  try {
    account = await getAccountById(id);
  } catch {
    notFound();
  }

  const [stats, prevMonthBalance, transactions, allAccounts, allCategories] = await Promise.all([
    getAccountMonthlyStats(id),
    getAccountBalanceAtDate(
      id,
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    ),
    getAccountTransactions(id),
    getAccounts(),
    getCategories(),
  ]);

  const slimAccounts = allAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
  }));
  const slimCategories = allCategories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    parent_id: c.parent_id,
    icon: c.icon,
    color: c.color,
    is_predefined: c.is_predefined,
  }));

  const Icon = TYPE_ICONS[account.type] ?? Banknote;
  const monthChange = account.balance - prevMonthBalance;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/cuentas"
        className="flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Cuentas
      </Link>

      {/* Header de la cuenta */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold lg:text-2xl">{account.name}</h1>
          <p className="text-sm text-muted-foreground">
            {TYPE_LABELS[account.type] ?? account.type} · {account.currency}
          </p>
        </div>
      </div>

      {/* Saldo */}
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm">
        <p className="text-sm/none opacity-80">Saldo actual</p>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums lg:text-4xl">
          {formatMoney(account.balance, account.currency)}
        </p>
        <p className={`mt-2 text-sm ${monthChange >= 0 ? "text-white/90" : "text-white/70"}`}>
          {monthChange >= 0 ? "↑" : "↓"} {formatMoney(Math.abs(monthChange), account.currency)} este mes
        </p>
      </section>

      {/* Resumen del mes */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Ingresos</p>
          <p className="mt-1 font-mono text-sm font-semibold text-primary tabular-nums">
            {formatMoney(stats.income, account.currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Gastos</p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
            {formatMoney(stats.expense, account.currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Transf. entrantes</p>
          <p className="mt-1 font-mono text-sm font-semibold text-primary tabular-nums">
            {formatMoney(stats.transferIn, account.currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Transf. salientes</p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
            {formatMoney(stats.transferOut, account.currency)}
          </p>
        </div>
      </section>

      {/* Saldo mes anterior */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Saldo a fin del mes anterior</span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatMoney(prevMonthBalance, account.currency)}
          </span>
        </div>
      </section>

      {/* Lista de movimientos */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Movimientos</h2>
        <AccountTransactionList
          transactions={transactions}
          accountId={id}
          accountCurrency={account.currency}
          accounts={slimAccounts}
          categories={slimCategories}
          baseCurrency={profile.base_currency}
        />
      </section>
    </div>
  );
}
