import { Suspense } from "react";

import { BreakdownList } from "@/components/breakdown-list";
import { KpiRow } from "@/components/kpi-row";
import { getCurrentUser } from "@/lib/dal";
import { monthEndLocal, monthStartLocal } from "@/lib/dates";
import { resolvePeriod } from "@/lib/period";
import {
  getAccounts,
  getBreakdownByAccount,
  getBudgets,
  getCategories,
  getCategoryBreakdown,
  getMonthlyTrends,
  getPeriodTotals,
} from "@/lib/queries";
import { CategoryPieChart } from "./category-pie-chart";
import { FiltersBar } from "./filters-bar";
import { SpendingPace } from "./spending-pace";
import { TrendsChart } from "./trends-chart";

export default async function ReportesPage({ searchParams }: PageProps<"/dashboard/reportes">) {
  const sp = await searchParams;
  const { profile } = await getCurrentUser();
  const currency = profile.base_currency;

  const periodo = typeof sp.periodo === "string" ? sp.periodo : undefined;
  const cuenta = typeof sp.cuenta === "string" ? sp.cuenta : undefined;
  const categoria = typeof sp.categoria === "string" ? sp.categoria : undefined;
  const { from, to, prevFrom, prevTo, label, months } = resolvePeriod(periodo);

  const filters = { from, to, accountId: cuenta, categoryId: categoria };
  const prevFilters = { from: prevFrom, to: prevTo, accountId: cuenta, categoryId: categoria };

  const [
    totals,
    prevTotals,
    categories,
    prevCategories,
    trends,
    byAccount,
    accounts,
    allCategories,
    budgets,
    monthTotals,
  ] = await Promise.all([
    getPeriodTotals(filters),
    prevFrom ? getPeriodTotals(prevFilters) : null,
    getCategoryBreakdown(filters),
    prevFrom ? getCategoryBreakdown(prevFilters) : [],
    getMonthlyTrends(months, filters),
    getBreakdownByAccount(filters),
    getAccounts(),
    getCategories(),
    getBudgets(),
    // El ritmo es siempre el mes calendario y sin filtros: es la medida de
    // "¿voy bien?", no parte de la exploración de abajo.
    getPeriodTotals({ from: monthStartLocal(), to: monthEndLocal() }),
  ]);

  const prevByCategory = new Map(prevCategories.map((c) => [c.id, c.total]));
  const categoryRows = categories.map((c) => ({
    id: c.id,
    name: c.name,
    total: c.total,
    color: c.color,
    previous: prevFrom ? (prevByCategory.get(c.id) ?? 0) : undefined,
    href: `/dashboard/gastos?categoria=${c.id}`,
  }));

  const accountRows = byAccount
    .filter((a) => a.expense > 0)
    .map((a) => ({ id: a.id, name: a.name, total: a.expense }));

  const monthlyBudget =
    budgets.filter((b) => b.period === "monthly").reduce((sum, b) => sum + (b.limitBase ?? 0), 0) ||
    null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold lg:text-2xl">Reportes</h1>
          <p className="text-muted-foreground text-sm">{label}</p>
        </div>
        <Suspense fallback={<div className="bg-muted h-[86px] rounded-xl" />}>
          <FiltersBar
            accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
            categories={allCategories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </Suspense>
      </header>

      {/* ¿Voy bien este mes? */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ritmo de este mes</h2>
        <SpendingPace spent={monthTotals.expense} budget={monthlyBudget} currency={currency} />
      </section>

      {/* Los números del período elegido */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {label}{" "}
          {prevTotals && (
            <span className="text-muted-foreground text-sm font-normal">· vs período anterior</span>
          )}
        </h2>
        <KpiRow totals={totals} previous={prevTotals} currency={currency} />
      </section>

      {/* ¿En qué se me va? */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          En qué se te va{" "}
          <span className="text-muted-foreground text-sm font-normal">· {label}</span>
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="border-border bg-card rounded-2xl border p-3 shadow-sm">
            <BreakdownList
              rows={categoryRows}
              currency={currency}
              emptyLabel="Sin gastos en este período"
            />
          </div>
          {/* La lista alcanza en mobile; la torta acompaña solo en pantalla grande. */}
          <div className="border-border bg-card hidden rounded-2xl border p-4 shadow-sm lg:block">
            <CategoryPieChart
              data={categories.slice(0, 8).map((c) => ({
                name: c.name,
                total: c.total,
                color: c.color,
              }))}
            />
          </div>
        </div>
      </section>

      {/* ¿Estoy mejor que antes? */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Evolución ({months} meses)</h2>
        <div className="border-border bg-card rounded-2xl border p-4 shadow-sm">
          <TrendsChart data={trends} currency={currency} />
        </div>
      </section>

      {/* Por dónde sale la plata */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Por cuenta <span className="text-muted-foreground text-sm font-normal">· {label}</span>
        </h2>
        <div className="border-border bg-card rounded-2xl border p-3 shadow-sm">
          <BreakdownList
            rows={accountRows}
            currency={currency}
            emptyLabel="Sin gastos en este período"
            max={8}
          />
        </div>
      </section>
    </div>
  );
}
