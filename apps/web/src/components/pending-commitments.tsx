import { CreditCard } from "lucide-react";

import { DueSubscriptions } from "@/components/due-subscriptions";
import { formatMoneyRound, formatShortDate } from "@/lib/format";

type Installment = {
  id: string;
  note: string | null;
  amount: number;
  currency: string;
  date: string;
};

type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  daysUntil: number;
  isOverdue: boolean;
  next_date: string;
};

/**
 * Lo que ya debés y todavía no salió de la cuenta: cuotas y suscripciones que
 * vencen en los próximos 30 días. El saldo de las cuentas no las refleja
 * todavía, así que sin este bloque el patrimonio se lee optimista.
 */
export function PendingCommitments({
  installments,
  subscriptions,
  total,
  partial,
  currency,
}: {
  installments: Installment[];
  subscriptions: Subscription[];
  total: number;
  partial: boolean;
  currency: string;
}) {
  if (installments.length === 0 && subscriptions.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Próximos pagos{" "}
          <span className="text-muted-foreground text-sm font-normal">· 30 días</span>
        </h2>
        <p className="shrink-0 font-mono text-sm font-semibold tabular-nums">
          {formatMoneyRound(total, currency)}
          {partial && <span className="text-muted-foreground">*</span>}
        </p>
      </div>

      {installments.length > 0 && (
        <ul className="border-border bg-card flex flex-col rounded-2xl border p-2 shadow-sm">
          {installments.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-2 py-2.5">
              <div className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.note ?? "Cuota"}</p>
                <p className="text-muted-foreground text-xs">Vence {formatShortDate(i.date)}</p>
              </div>
              <p className="shrink-0 font-mono text-sm tabular-nums">
                {formatMoneyRound(i.amount, i.currency)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <DueSubscriptions subscriptions={subscriptions} />

      {partial && (
        <p className="text-muted-foreground text-xs">
          * Falta alguna cotización: el total está incompleto.
        </p>
      )}
    </section>
  );
}
