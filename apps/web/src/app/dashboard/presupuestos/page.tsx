import { getBudgets, getCategories, getCategoryBreakdown } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";
import { addMonthsIso, monthEndLocal, monthEndOfIso, monthStartLocal } from "@/lib/dates";
import { formatMoneyRound } from "@/lib/format";
import { roundBudget } from "@/lib/money";
import { BudgetList } from "./budget-list";

export default async function PresupuestosPage() {
  const { profile } = await getCurrentUser();
  const baseCurrency = profile.base_currency;

  const prevFrom = addMonthsIso(monthStartLocal(), -1);
  const [budgets, categories, prevMonth] = await Promise.all([
    getBudgets(),
    getCategories(),
    getCategoryBreakdown({ from: prevFrom, to: monthEndOfIso(prevFrom) }),
  ]);

  // Con un solo mes de historia el mes anterior está vacío y la sugerencia
  // saldría en blanco: se cae al mes en curso y el copy lo aclara.
  const usePrev = prevMonth.length > 0;
  const reference = usePrev
    ? prevMonth
    : await getCategoryBreakdown({ from: monthStartLocal(), to: monthEndLocal() });

  const withBudget = new Set(budgets.map((b) => b.category_id));
  const suggestions = reference
    .filter((c) => !withBudget.has(c.id) && c.total > 0)
    .map((c) => ({
      category_id: c.id,
      name: c.name,
      color: c.color,
      spent: c.total,
      suggested: roundBudget(c.total),
    }));

  // Todo en moneda base: `spent` ya viene convertido y el límite puede estar en otra.
  const totalLimit = budgets.reduce((s, b) => s + (b.limitBase ?? 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const expenseCategories = categories.filter((c) => c.kind === "expense");

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Presupuestos</h1>
        <p className="text-muted-foreground text-sm">Gastos del mes por categoría</p>
      </header>

      {budgets.length > 0 && (
        <section className="grid grid-cols-3 gap-3">
          <Tile label="Presupuestado" value={formatMoneyRound(totalLimit, baseCurrency)} />
          <Tile label="Gastado" value={formatMoneyRound(totalSpent, baseCurrency)} />
          <Tile
            label="Restante"
            value={formatMoneyRound(totalLimit - totalSpent, baseCurrency)}
            valueClass={totalLimit - totalSpent >= 0 ? "text-primary" : "text-destructive"}
          />
        </section>
      )}

      <BudgetList
        budgets={budgets}
        categories={expenseCategories.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          color: c.color,
          is_predefined: c.is_predefined,
        }))}
        baseCurrency={baseCurrency}
        suggestions={suggestions}
        suggestionsFromPreviousMonth={usePrev}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="border-border bg-card rounded-2xl border p-4 shadow-sm">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`mt-1 font-mono text-sm font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
