import { Scale, TrendingDown, TrendingUp } from "lucide-react";

import { Delta } from "@/components/delta";
import { formatMoneyRound } from "@/lib/format";
import { pctChange } from "@/lib/period";

type Totals = { income: number; expense: number; balance: number };

/**
 * Ingresos / Gastos / Balance del período.
 * Montos sin centavos: en un total del mes los decimales solo roban ancho, y en
 * mobile eran la diferencia entre que el número entrara o se cortara.
 */
export function KpiRow({
  totals,
  previous,
  currency,
}: {
  totals: Totals;
  previous?: Totals | null;
  currency: string;
}) {
  const savingsRate = totals.income > 0 ? (totals.balance / totals.income) * 100 : null;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
      <Tile
        icon={<TrendingUp className="text-primary h-4 w-4" />}
        label="Ingresos"
        value={formatMoneyRound(totals.income, currency)}
        valueClass="text-primary"
        delta={previous ? pctChange(totals.income, previous.income) : null}
        goodWhenUp
      />
      <Tile
        icon={<TrendingDown className="text-destructive h-4 w-4" />}
        label="Gastos"
        value={formatMoneyRound(totals.expense, currency)}
        delta={previous ? pctChange(totals.expense, previous.expense) : null}
        goodWhenUp={false}
      />
      <Tile
        icon={<Scale className="h-4 w-4" />}
        label="Balance"
        value={formatMoneyRound(totals.balance, currency)}
        valueClass={totals.balance < 0 ? "text-destructive" : "text-primary"}
        delta={previous ? pctChange(totals.balance, previous.balance) : null}
        goodWhenUp
        footnote={savingsRate === null ? null : `Tasa de ahorro ${savingsRate.toFixed(0)}%`}
      />
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  valueClass = "",
  delta,
  goodWhenUp,
  footnote,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  delta: number | null;
  goodWhenUp: boolean;
  footnote?: string | null;
}) {
  return (
    <div className="border-border bg-card flex items-center justify-between gap-2 rounded-2xl border p-4 shadow-sm sm:flex-col sm:items-start sm:gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:flex-col sm:items-start sm:gap-0.5">
        <p
          className={`truncate font-mono text-base font-semibold tabular-nums sm:text-lg ${valueClass}`}
        >
          {value}
        </p>
        <Delta value={delta} goodWhenUp={goodWhenUp} />
        {footnote && <p className="text-muted-foreground hidden text-xs sm:block">{footnote}</p>}
      </div>
    </div>
  );
}
