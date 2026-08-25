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
import { getAccounts, getTransactions, getMonthlySummary, getSubscriptions } from "@/lib/queries";
import { formatMoney, formatSigned, formatShortDate } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";
import { DashboardChart } from "@/components/dashboard-chart";
import { DueSubscriptions } from "@/components/due-subscriptions";

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

  const [accounts, transactions, summary, subscriptions] = await Promise.all([
    getAccounts(),
    getTransactions({ limit: 5 }),
    getMonthlySummary(),
    getSubscriptions(),
  ]);

  const dueSubscriptions = subscriptions.filter((s) => s.active && s.daysUntil <= 3);

  const baseCurrency = profile.base_currency;
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
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800/50 bg-zinc-950 p-6 text-zinc-50 shadow-2xl lg:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/20 via-transparent to-transparent"></div>
        
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Patrimonio Neto</p>
          <div className="mt-6 flex flex-col gap-5">
            {Object.keys(byCurrency).length > 0 ? (
              Object.entries(byCurrency).map(([cur, bal], i, arr) => (
                <div key={cur} className={`flex items-end justify-between ${i !== arr.length - 1 ? "border-b border-zinc-800/50 pb-5" : ""}`}>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-zinc-400">Total en {cur}</p>
                    <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                      {formatMoney(bal, cur)}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800/50 text-zinc-300 shadow-inner">
                    <span className="text-[10px] font-bold">{cur}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-end justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-zinc-400">Total en {baseCurrency}</p>
                  <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                    {formatMoney(0, baseCurrency)}
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800/50 text-zinc-300 shadow-inner">
                  <span className="text-[10px] font-bold">{baseCurrency}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Cuentas individuales — compactas */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tus cuentas</h2>
        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              No tenés cuentas. Andá a la pestaña Cuentas para crear una.
            </p>
          </div>
        ) : (
          <div className="flex flex-col rounded-2xl glass p-2 shadow-sm">
            {accounts.slice(0, 4).map((a, i, arr) => {
              const Icon = ACCOUNT_ICONS[a.type] ?? Banknote;
              const isPositive = a.balance >= 0;
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/cuentas/${a.id}`}
                  className={`group flex items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/50 rounded-xl ${i !== Math.min(accounts.length, 4) - 1 ? "border-b border-border/50 rounded-b-none" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold leading-tight">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACCOUNT_LABELS[a.type] ?? a.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={`font-mono text-sm font-bold tabular-nums ${isPositive ? "text-foreground" : "text-destructive"}`}>
                      {formatMoney(a.balance, a.currency)}
                    </p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                </Link>
              );
            })}
            <Link
              href="/dashboard/cuentas"
              className="mt-1 flex w-full items-center justify-center rounded-xl p-3 text-sm font-medium text-primary hover:bg-muted/50 transition-colors"
            >
              Ver todas las cuentas
            </Link>
          </div>
        )}
      </section>

      {/* Resumen del mes */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Resumen del mes</h2>
        
        {/* Gráfico de tendencia */}
        <div className="mb-2 rounded-3xl glass p-4 pt-6 pb-2">
          <DashboardChart transactions={transactions} baseCurrency={baseCurrency} />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl glass p-4 transition-all hover:shadow-md">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Ingresos</p>
            </div>
            <p className="mt-1.5 font-mono text-lg font-semibold text-primary tabular-nums">
              {formatMoney(summary.income, baseCurrency)}
            </p>
          </div>
          <div className="rounded-2xl glass p-4 transition-all hover:shadow-md">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-xs font-medium text-muted-foreground">Gastos</p>
            </div>
            <p className="mt-1.5 font-mono text-lg font-bold tabular-nums">
              {formatMoney(summary.expense, baseCurrency)}
            </p>
          </div>
          <div className="hidden rounded-2xl glass p-4 transition-all hover:shadow-md lg:block">
            <div className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              <p className="text-xs text-muted-foreground">Ahorro</p>
            </div>
            <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums">
              {formatMoney(summary.income - summary.expense, baseCurrency)}
            </p>
          </div>
          <div className="hidden rounded-2xl glass p-4 transition-all hover:shadow-md lg:block">
            <p className="text-xs font-medium text-muted-foreground">Cuentas</p>
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
                  className="group flex items-center gap-4 rounded-2xl glass p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
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

      {/* Alertas de suscripciones */}
      {dueSubscriptions.length > 0 && (
        <DueSubscriptions subscriptions={dueSubscriptions} />
      )}
    </div>
  );
}
