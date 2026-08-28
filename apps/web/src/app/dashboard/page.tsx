import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Landmark,
  CreditCard,
  Smartphone,
  PiggyBank,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { getCurrentUser } from "@/lib/dal";
import {
  getAccounts,
  getBudgets,
  getPendingInstallments,
  getPeriodTotals,
  getRates,
  getSubscriptions,
  getTotalBalance,
  getTransactions,
} from "@/lib/queries";
import { addMonthsIso, monthEndLocal, monthStartLocal, todayLocal } from "@/lib/dates";
import { sumInBase } from "@/lib/money";
import { formatMoney, formatSigned, formatShortDate } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";
import { KpiRow } from "@/components/kpi-row";
import { PendingCommitments } from "@/components/pending-commitments";

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

  const baseCurrency = profile.base_currency;
  const monthFrom = monthStartLocal();
  const monthTo = monthEndLocal();

  const [accounts, transactions, totals, prevTotals, subscriptions, installments, budgets, rates] =
    await Promise.all([
      getAccounts(),
      getTransactions({ limit: 5 }),
      getPeriodTotals({ from: monthFrom, to: monthTo }),
      getPeriodTotals({ from: addMonthsIso(monthFrom, -1), to: addMonthsIso(monthTo, -1) }),
      getSubscriptions(),
      getPendingInstallments(),
      getBudgets(),
      getRates(),
    ]);

  // Mismo horizonte rodante que las cuotas, vencidas incluidas.
  const horizon = addMonthsIso(todayLocal(), 1);
  const dueSubscriptions = subscriptions.filter((s) => s.active && s.next_date <= horizon);
  const overBudget = budgets.filter((b) => b.limitBase !== null && b.spent > b.limitBase);

  const { total: pendingTotal, partial: pendingPartial } = sumInBase(
    [
      ...installments.map((i) => ({ balance: i.amount, currency: i.currency })),
      ...dueSubscriptions.map((s) => ({ balance: s.amount, currency: s.currency })),
    ],
    baseCurrency,
    rates,
  );

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

  const arsRate = rates.find((r) => r.base === "USD" && r.quote === "ARS");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Hola,</p>
          <h1 className="text-xl font-semibold lg:text-2xl">
            {profile.full_name ?? profile.email}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {arsRate && (
            <div className="border-border bg-card/50 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur-md">
              <span className="text-muted-foreground">USD/ARS</span>
              <span className="font-mono font-medium tabular-nums">
                {formatMoney(arsRate.rate, "ARS")}
              </span>
            </div>
          )}
          <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
            <span className="text-sm font-semibold">{initial}</span>
          </div>
        </div>
      </header>

      {/* Saldo total neto */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800/50 bg-zinc-950 p-6 text-zinc-50 shadow-2xl lg:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/20 via-transparent to-transparent"></div>

        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Patrimonio Neto Total
          </p>
          <div className="mb-6 mt-2">
            <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
              {formatMoney(totalBalance, baseCurrency)}
            </p>
            {partial && (
              <p className="mt-2 text-xs font-medium text-amber-500/80">
                Faltan cotizaciones: total incompleto.
              </p>
            )}
          </div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Desglose por moneda
          </p>
          <div className="flex flex-col gap-5">
            {Object.keys(byCurrency).length > 0 ? (
              Object.entries(byCurrency).map(([cur, bal], i, arr) => (
                <div
                  key={cur}
                  className={`flex items-end justify-between ${i !== arr.length - 1 ? "border-b border-zinc-800/50 pb-5" : ""}`}
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-zinc-400">Total en {cur}</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                      {formatMoney(bal, cur)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800/50 text-zinc-300 shadow-inner">
                    <span className="text-[10px] font-bold">{cur}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-end justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-zinc-400">Total en {baseCurrency}</p>
                  <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                    {formatMoney(0, baseCurrency)}
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800/50 text-zinc-300 shadow-inner">
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
          <div className="border-border bg-card rounded-2xl border p-6 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">
              No tenés cuentas. Andá a la pestaña Cuentas para crear una.
            </p>
          </div>
        ) : (
          <div className="glass flex flex-col rounded-2xl p-2 shadow-sm">
            {accounts.slice(0, 4).map((a, i, arr) => {
              const Icon = ACCOUNT_ICONS[a.type] ?? Banknote;
              const isPositive = a.balance >= 0;
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/cuentas/${a.id}`}
                  className={`hover:bg-muted/50 group flex items-center justify-between gap-3 rounded-xl p-3 transition-colors ${i !== Math.min(accounts.length, 4) - 1 ? "border-border/50 rounded-b-none border-b" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold leading-tight">{a.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {ACCOUNT_LABELS[a.type] ?? a.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p
                      className={`font-mono text-sm font-bold tabular-nums ${isPositive ? "text-foreground" : "text-destructive"}`}
                    >
                      {formatMoney(a.balance, a.currency)}
                    </p>
                    <ChevronRight className="text-muted-foreground/50 group-hover:text-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
            <Link
              href="/dashboard/cuentas"
              className="text-primary hover:bg-muted/50 mt-1 flex w-full items-center justify-center rounded-xl p-3 text-sm font-medium transition-colors"
            >
              Ver todas las cuentas
            </Link>
          </div>
        )}
      </section>

      {/* Resumen del mes */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Resumen del mes{" "}
          <span className="text-muted-foreground text-sm font-normal">· vs mes anterior</span>
        </h2>
        <KpiRow totals={totals} previous={prevTotals} currency={baseCurrency} />
        {overBudget.length > 0 && (
          <Link
            href="/dashboard/presupuestos"
            className="border-destructive/30 bg-destructive/5 flex items-center gap-2 rounded-2xl border p-3 text-sm"
          >
            <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
            <span className="flex-1">
              {overBudget.length === 1
                ? "Un presupuesto excedido este mes"
                : `${overBudget.length} presupuestos excedidos este mes`}
            </span>
            <ChevronRight className="text-muted-foreground/50 h-4 w-4" />
          </Link>
        )}
      </section>

      <PendingCommitments
        installments={installments}
        subscriptions={dueSubscriptions}
        total={pendingTotal}
        partial={pendingPartial}
        currency={baseCurrency}
      />

      {/* Últimos movimientos */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Últimos movimientos</h2>
          <Link href="/dashboard/gastos" className="text-primary text-sm font-medium">
            Ver todo
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="border-border bg-card rounded-2xl border p-6 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">
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
                  className="glass group flex cursor-pointer items-center gap-4 rounded-2xl p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md"
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
                    <p className="text-muted-foreground truncate text-xs">
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
