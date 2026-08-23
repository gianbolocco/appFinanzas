import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

import { getCurrentUser } from "@/lib/dal";
import { getAccounts, getTransactions, getMonthlySummary, getTotalBalance } from "@/lib/queries";
import { formatMoney, formatSigned, formatShortDate } from "@/lib/format";

export default async function DashboardPage() {
  const { profile } = await getCurrentUser();

  if (!profile.onboarded) {
    redirect("/onboarding");
  }

  const [accounts, transactions, summary] = await Promise.all([
    getAccounts(),
    getTransactions({ limit: 5 }),
    getMonthlySummary(),
  ]);

  const totalBalance = getTotalBalance(
    accounts.map((a) => ({ balance: a.balance, currency: a.currency })),
  );
  const baseCurrency = profile.base_currency;
  const initial = (profile.full_name ?? profile.email ?? "?").charAt(0).toUpperCase();

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

      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm lg:p-6">
        <p className="text-sm/none opacity-80">Saldo total</p>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums lg:text-4xl">
          {formatMoney(totalBalance, baseCurrency)}
        </p>
        <p className="mt-2 text-sm opacity-80">
          {accounts.length} {accounts.length === 1 ? "cuenta" : "cuentas"}
        </p>
      </section>

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

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Últimos movimientos</h2>
          <a href="/dashboard/gastos" className="text-sm font-medium text-primary">Ver todo</a>
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
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${t.category?.color ?? "oklch(0.556 0 0)"} 15%, transparent)`,
                    }}
                  >
                    {t.category?.icon ? iconFor(t.category.icon) : "💰"}
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

function iconFor(icon: string) {
  return <span>{icon}</span>;
}
