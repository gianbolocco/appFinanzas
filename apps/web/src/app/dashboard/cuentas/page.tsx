import { getAccounts } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";
import { AccountList } from "./account-list";

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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold lg:text-2xl">Cuentas</h1>
          <p className="text-sm text-muted-foreground">{accounts.length} cuentas</p>
        </div>
      </header>

      <AccountList accounts={accounts} baseCurrency={profile.base_currency} typeLabels={TYPE_LABELS} />
    </div>
  );
}
