import Link from "next/link";
import { Banknote, Landmark, CreditCard, Smartphone, PiggyBank, ChevronRight } from "lucide-react";

import { getAccounts } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";
import { formatMoney } from "@/lib/format";
import { AccountList } from "./account-list";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cash: Banknote,
  bank: Landmark,
  credit_card: CreditCard,
  debit_card: CreditCard,
  wallet: Smartphone,
  savings: PiggyBank,
};

const TYPE_LABELS: Record<string, string> = {
  cash: "Efectivo",
  bank: "Banco",
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
  wallet: "Billetera",
  savings: "Ahorro",
};

export default async function CuentasPage() {
  const { profile } = await getCurrentUser();
  const accounts = await getAccounts();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Cuentas</h1>
        <p className="text-sm text-muted-foreground">{accounts.length} cuentas</p>
      </header>

      {/* Tarjetas con resumen */}
      <div className="flex flex-col gap-2">
        {accounts.map((a) => {
          const Icon = TYPE_ICONS[a.type] ?? Banknote;
          return (
            <Link
              key={a.id}
              href={`/dashboard/cuentas/${a.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {TYPE_LABELS[a.type] ?? a.type} · {a.currency}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold tabular-nums">
                  {formatMoney(a.balance, a.currency)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
            </Link>
          );
        })}
      </div>

      <AccountList accounts={accounts} baseCurrency={profile.base_currency} typeLabels={TYPE_LABELS} />
    </div>
  );
}
