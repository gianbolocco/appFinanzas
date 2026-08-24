import { getBudgets, getCategories } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";
import { formatMoney } from "@/lib/format";
import { BudgetList } from "./budget-list";

export default async function PresupuestosPage() {
  const { profile } = await getCurrentUser();
  const [budgets, categories] = await Promise.all([getBudgets(), getCategories()]);

  const totalLimit = budgets.reduce((s, b) => s + b.amount_limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const baseCurrency = profile.base_currency;

  const expenseCategories = categories.filter((c) => c.kind === "expense");

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Presupuestos</h1>
        <p className="text-sm text-muted-foreground">Gastos del mes por categoría</p>
      </header>

      {/* Resumen */}
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Presupuestado</p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
            {formatMoney(totalLimit, baseCurrency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Gastado</p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
            {formatMoney(totalSpent, baseCurrency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Restante</p>
          <p
            className={`mt-1 font-mono text-sm font-semibold tabular-nums ${totalLimit - totalSpent >= 0 ? "text-primary" : "text-destructive"}`}
          >
            {formatMoney(totalLimit - totalSpent, baseCurrency)}
          </p>
        </div>
      </section>

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
      />
    </div>
  );
}
