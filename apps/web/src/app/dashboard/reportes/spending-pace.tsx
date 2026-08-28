import { formatMoneyRound } from "@/lib/format";
import { monthPace } from "@/lib/period";

/**
 * "¿Voy bien este mes?" en un bloque: cuánto llevás gastado contra el
 * presupuesto, dónde deberías ir a esta altura del mes, y a cuánto cerrás si
 * seguís a este ritmo. Es siempre el mes calendario en curso: no depende del
 * período ni de los filtros de abajo, que son para explorar, no para medirse.
 */
export function SpendingPace({
  spent,
  budget,
  currency,
}: {
  spent: number;
  budget: number | null;
  currency: string;
}) {
  const { day, daysInMonth, projected } = monthPace(spent);
  const elapsedPct = (day / daysInMonth) * 100;

  if (!budget) {
    return (
      <div className="border-border bg-card rounded-2xl border p-4 shadow-sm">
        <p className="text-muted-foreground text-xs">Gastado este mes</p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
          {formatMoneyRound(spent, currency)}
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          Día {day} de {daysInMonth} · a este ritmo cerrás en{" "}
          <span className="font-mono tabular-nums">{formatMoneyRound(projected, currency)}</span>.
          Cargá presupuestos para saber si eso está bien.
        </p>
      </div>
    );
  }

  const spentPct = (spent / budget) * 100;
  const over = projected - budget;

  // Verde si proyectás cerrar dentro del presupuesto, ámbar si lo rozás,
  // rojo si ya te pasaste.
  const color =
    spent > budget
      ? "var(--destructive)"
      : projected > budget
        ? "var(--chart-2)"
        : "var(--primary)";

  return (
    <div className="border-border bg-card rounded-2xl border p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-muted-foreground text-xs">Gastado este mes</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          Día {day} de {daysInMonth}
        </p>
      </div>

      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {formatMoneyRound(spent, currency)}
        </span>
        <span className="text-muted-foreground text-sm">
          de {formatMoneyRound(budget, currency)}
        </span>
      </p>

      <div className="bg-muted relative mt-3 h-2.5 w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, spentPct)}%`, backgroundColor: color }}
        />
        {/* Dónde deberías ir si gastaras parejo todo el mes. */}
        <div
          aria-hidden
          className="bg-foreground/40 absolute inset-y-0 w-0.5"
          style={{ left: `${elapsedPct}%` }}
        />
      </div>

      <p className="text-muted-foreground mt-2 text-xs">
        {spentPct.toFixed(0)}% del presupuesto · a este ritmo cerrás en{" "}
        <span className="font-mono tabular-nums">{formatMoneyRound(projected, currency)}</span>
        {over > 0 ? (
          <span className="text-destructive font-medium">
            {" "}
            ({formatMoneyRound(over, currency)} de más)
          </span>
        ) : (
          <span className="text-primary font-medium">
            {" "}
            ({formatMoneyRound(-over, currency)} de margen)
          </span>
        )}
      </p>
    </div>
  );
}
