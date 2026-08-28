import Link from "next/link";

import { Delta } from "@/components/delta";
import { formatMoneyRound } from "@/lib/format";
import { pctChange } from "@/lib/period";

export type BreakdownRow = {
  id: string;
  name: string;
  total: number;
  color?: string;
  /** Mismo concepto en el período anterior, para el delta. */
  previous?: number;
  href?: string;
};

/**
 * Lista ordenada con barra de proporción inline. Reemplaza a torta + tabla +
 * Pareto: los tres mostraban el mismo dato, y una lista se lee mejor que un
 * gráfico de 260px en un teléfono, sin necesitar tabla accesible aparte.
 */
export function BreakdownList({
  rows,
  currency,
  emptyLabel,
  max = 7,
}: {
  rows: BreakdownRow[];
  currency: string;
  emptyLabel: string;
  max?: number;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{emptyLabel}</p>;
  }

  const total = rows.reduce((s, r) => s + r.total, 0);
  const shown = rows.slice(0, max);
  const rest = rows.slice(max);

  const items: BreakdownRow[] = rest.length
    ? [
        ...shown,
        {
          id: "otros",
          name: `Otros (${rest.length})`,
          total: rest.reduce((s, r) => s + r.total, 0),
          previous: rest.reduce((s, r) => s + (r.previous ?? 0), 0),
        },
      ]
    : shown;

  return (
    <ul className="flex flex-col">
      {items.map((row) => {
        const pct = total > 0 ? (row.total / total) * 100 : 0;
        const color = row.color ?? "var(--primary)";

        const content = (
          <>
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-lg opacity-10"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
            <span
              aria-hidden
              className="relative h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="relative flex-1 truncate text-sm">{row.name}</span>
            <Delta
              value={row.previous === undefined ? null : pctChange(row.total, row.previous)}
              goodWhenUp={false}
              className="relative"
            />
            <span className="relative font-mono text-sm tabular-nums">
              {formatMoneyRound(row.total, currency)}
            </span>
            <span className="text-muted-foreground relative w-9 shrink-0 text-right text-xs tabular-nums">
              {pct.toFixed(0)}%
            </span>
          </>
        );

        const className =
          "relative flex items-center gap-2.5 overflow-hidden rounded-lg px-2 py-2.5 transition-colors";

        return (
          <li key={row.id}>
            {row.href ? (
              <Link href={row.href} className={`${className} hover:bg-muted/60`}>
                {content}
              </Link>
            ) : (
              <div className={className}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
