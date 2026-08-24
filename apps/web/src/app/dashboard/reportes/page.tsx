import { TrendingUp, TrendingDown, Wallet, ArrowUp, ArrowDown } from "lucide-react";

import { getCurrentUser } from "@/lib/dal";
import {
  getCategoryBreakdown,
  getMonthlyTrends,
  getMonthComparison,
  getBreakdownByAccount,
} from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { CategoryPieChart } from "./category-pie-chart";
import { TrendsLineChart } from "./trends-line-chart";
import { ParetoBarChart } from "./pareto-bar-chart";
import { AccountBarChart } from "./account-bar-chart";

function pctChange(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

export default async function ReportesPage() {
  const { profile } = await getCurrentUser();
  const baseCurrency = profile.base_currency;

  const [categories, trends, comparison, byAccount] = await Promise.all([
    getCategoryBreakdown(),
    getMonthlyTrends(),
    getMonthComparison(),
    getBreakdownByAccount(),
  ]);

  const totalExpense = categories.reduce((s, c) => s + c.total, 0);
  const incomeChange = pctChange(comparison.current.income, comparison.previous.income);
  const expenseChange = pctChange(comparison.current.expense, comparison.previous.expense);
  const ahorroChange = pctChange(comparison.current.ahorro, comparison.previous.ahorro);

  const pieData = categories.slice(0, 8).map((c) => ({
    name: c.name,
    total: c.total,
    color: c.color,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Reportes</h1>
        <p className="text-sm text-muted-foreground">Análisis de tus finanzas</p>
      </header>

      {/* Comparativa mes actual vs anterior */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Este mes vs mes anterior</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Ingresos</p>
            </div>
            <p className="mt-1.5 font-mono text-base font-semibold text-primary tabular-nums">
              {formatMoney(comparison.current.income, baseCurrency)}
            </p>
            {comparison.previous.income > 0 && (
              <p className={`mt-0.5 flex items-center gap-0.5 text-xs ${incomeChange >= 0 ? "text-primary" : "text-destructive"}`}>
                {incomeChange >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(incomeChange).toFixed(0)}%
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Gastos</p>
            </div>
            <p className="mt-1.5 font-mono text-base font-semibold tabular-nums">
              {formatMoney(comparison.current.expense, baseCurrency)}
            </p>
            {comparison.previous.expense > 0 && (
              <p className={`mt-0.5 flex items-center gap-0.5 text-xs ${expenseChange <= 0 ? "text-primary" : "text-destructive"}`}>
                {expenseChange <= 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                {Math.abs(expenseChange).toFixed(0)}%
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              <p className="text-xs text-muted-foreground">Ahorro</p>
            </div>
            <p className="mt-1.5 font-mono text-base font-semibold tabular-nums">
              {formatMoney(comparison.current.ahorro, baseCurrency)}
            </p>
            {comparison.previous.ahorro > 0 && (
              <p className={`mt-0.5 flex items-center gap-0.5 text-xs ${ahorroChange >= 0 ? "text-primary" : "text-destructive"}`}>
                {ahorroChange >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(ahorroChange).toFixed(0)}%
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Tendencias temporales */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tendencias (6 meses)</h2>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <TrendsLineChart data={trends} />
        </div>
      </section>

      {/* Desglose por categoría + tabla */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Desglose por categoría</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <CategoryPieChart data={pieData} />
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-2">
              {categories.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin gastos en este período
                </p>
              ) : (
                categories.slice(0, 10).map((c, i) => {
                  const pct = totalExpense > 0 ? (c.total / totalExpense) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="flex-1 truncate text-sm">{c.name}</span>
                      <span className="font-mono text-sm tabular-nums">
                        {formatMoney(c.total, baseCurrency)}
                      </span>
                      <span className="w-12 text-right text-xs text-muted-foreground">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Top gastos / Pareto */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Top gastos (Pareto)</h2>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <ParetoBarChart data={categories.slice(0, 8).map((c) => ({ name: c.name, total: c.total, color: c.color }))} />
        </div>
      </section>

      {/* Por método de pago */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Por cuenta / método de pago</h2>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <AccountBarChart
            data={byAccount.map((a) => ({ name: a.name, income: a.income, expense: a.expense }))}
          />
        </div>
      </section>
    </div>
  );
}
