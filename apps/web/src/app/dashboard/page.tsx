import Link from "next/link";
import { redirect } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Banknote,
  Landmark,
  CreditCard,
  Smartphone,
  PiggyBank,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { getCurrentUser } from "@/lib/dal";
import { getAccounts, getTransactions, getMonthlySummary, getTotalBalance, getRates } from "@/lib/queries";
import { formatMoney, formatSigned, formatShortDate } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";

const ACCOUNT_ICONS: Record<string, LucideIcon> = {
  cash: Banknote,
  bank: Landmark,
  credit_card: CreditCard,
  debit_card: CreditCard,
  wallet: Smartphone,
  savings: PiggyBank,
};

const ACCOUNT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  bank: "Banco",
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
  wallet: "Billetera",
  savings: "Ahorro",
};

export default async function DashboardPage() {
  const { profile } = await getCurrentUser();

  if (!profile.onboarded) {
    redirect("/onboarding");
  }

  const [accounts, transactions, summary, rates] = await Promise.all([
    getAccounts(),
    getTransactions({ limit: 5 }),
    getMonthlySummary(),
    getRates(),
  ]);

  const baseCurrency = profile.base_currency;
  const { total: totalBalance, partial } = getTotalBalance(
    accounts.map((a) => ({ balance: a.balance, currency: a.currency })),
    baseCurrency,
    rates,
  );
  const initial = (profile.full_name ?? profile.email ?? "?").charAt(0).toUpperCase();

  // Agrupar cuentas por moneda para los netos individuales
  const byCurrency = accounts.reduce<Record<string, number>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? 0) + a.balance;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Hola,</p>
          <h1 className="text-xl font-semibold lg:text-2xl">{profile.full_name ?? profile.email}</h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span className="text-sm font-semibold">{initial}</span>
        </div>
      </header>

      {/* Saldo total neto */}
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm lg:p-6">
        <p className="text-sm/none opacity-80">Patrimonio neto</p>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums lg:text-4xl">
          {formatMoney(totalBalance, baseCurrency)}
        </p>
        {partial && (
          <p className="mt-1 text-xs opacity-80">
            Faltan cotizaciones de algunas monedas: el total está incompleto.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80">
          {Object.entries(byCurrency).map(([cur, bal]) => (
            <span key={cur} className="font-mono tabular-nums">
              {formatMoney(bal, cur)}
            </span>
          ))}
        </div>
      </section>

      {/* Cuentas individuales — clickeables al detalle */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tus cuentas</h2>
          <Link href="/dashboard/cuentas" className="text-sm font-medium text-primary">
            Ver todas
          </Link>
        </div>
        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              No tenés cuentas. Andá a la pestaña Cuentas para crear una.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => {
              const Icon = ACCOUNT_ICONS[a.type] ?? Banknote;
              const isPositive = a.balance >= 0;
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/cuentas/${a.id}`}
                  className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md hover:border-primary/30"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACCOUNT_LABELS[a.type] ?? a.type}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                  </div>
                  <p
                    className={`font-mono text-lg font-semibold tabular-nums ${isPositive ? "text-foreground" : "text-destructive"}`}
                  >
                    {formatMoney(a.balance, a.currency)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Resumen del mes */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Resumen del mes</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Ingresos</p>
            </div>
            <p className="mt-1.5 font-mono text-lg font-semibold text-primary tabular-nums">
              {formatMoney(summary.income, baseCurrency)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Gastos</p>
            </div>
            <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums">
              {formatMoney(summary.expense, baseCurrency)}
            </p>
          </div>
          <div className="hidden rounded-2xl border border-border bg-card p-4 shadow-sm lg:block">
            <div className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              <p className="text-xs text-muted-foreground">Ahorro</p>
            </div>
            <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums">
              {formatMoney(summary.income - summary.expense, baseCurrency)}
            </p>
          </div>
          <div className="hidden rounded-2xl border border-border bg-card p-4 shadow-sm lg:block">
            <p className="text-xs text-muted-foreground">Cuentas</p>
            <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums">
              {accounts.length}
            </p>
          </div>
        </div>
      </section>

      {/* Últimos movimientos */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Últimos movimientos</h2>
          <Link href="/dashboard/gastos" className="text-sm font-medium text-primary">
            Ver todo
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Todavía no cargaste movimientos. Tocá el botón verde para sumar el primero.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {transactions.map((t) => {
              const isIncome = t.type === "income";
              const signed = isIncome ? t.amount : -t.amount;
              const Icon = getCategoryIcon(t.category?.icon ?? null);
              const catColor = t.category?.color ?? "oklch(0.556 0 0)";
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `color-mix(in oklch, ${catColor} 15%, transparent)` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: catColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t.note ?? t.category?.name ?? "Movimiento"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatShortDate(t.date)} · {t.account?.name}
                    </p>
                  </div>
                  <p
                    className={`font-mono text-sm font-semibold tabular-nums ${isIncome ? "text-primary" : "text-foreground"}`}
                  >
                    {formatSigned(signed, t.currency)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
