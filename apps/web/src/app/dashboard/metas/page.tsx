import { getGoals, getAccounts } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";
import { formatMoney } from "@/lib/format";
import { GoalList } from "./goal-list";

export default async function MetasPage() {
  const { profile } = await getCurrentUser();
  const [goals, accounts] = await Promise.all([getGoals(), getAccounts()]);
  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);

  const totalTarget = active.reduce((s, g) => s + g.target_amount, 0);
  const totalSaved = active.reduce((s, g) => s + g.current_amount, 0);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Metas de ahorro</h1>
        <p className="text-sm text-muted-foreground">{active.length} activas · {archived.length} archivadas</p>
      </header>

      {/* Resumen */}
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Ahorrado</p>
          <p className="mt-1 font-mono text-sm font-semibold text-primary tabular-nums">
            {formatMoney(totalSaved, profile.base_currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Objetivo</p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
            {formatMoney(totalTarget, profile.base_currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Restante</p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
            {formatMoney(totalTarget - totalSaved, profile.base_currency)}
          </p>
        </div>
      </section>

      <GoalList
        goals={goals}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
        baseCurrency={profile.base_currency}
      />
    </div>
  );
}
