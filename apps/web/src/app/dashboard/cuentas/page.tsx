import Link from "next/link";
import { Banknote, Landmark, CreditCard, Smartphone, PiggyBank } from "lucide-react";

import { getAccounts, getAccountMonthlyStats } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";
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

  const accountsWithStats = await Promise.all(
    accounts.map(async (a) => {
      const stats = await getAccountMonthlyStats(a.id);
      return { ...a, stats };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold lg:text-2xl">Cuentas</h1>
        <p className="text-sm text-muted-foreground">{accounts.length} cuentas activas</p>
      </header>

      <AccountList accounts={accountsWithStats} baseCurrency={profile.base_currency} typeLabels={TYPE_LABELS} />
    </div>
  );
}
