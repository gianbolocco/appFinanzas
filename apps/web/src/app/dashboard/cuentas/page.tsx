import { getAccounts, getAccountMonthlyStats, getRates } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";
import { convert } from "@/lib/money";
import { AccountList } from "./account-list";

export default async function CuentasPage() {
  const { profile } = await getCurrentUser();
  const baseCurrency = profile.base_currency;
  const [accounts, rates] = await Promise.all([getAccounts(), getRates()]);

  const accountsWithStats = await Promise.all(
    accounts.map(async (a) => ({
      ...a,
      stats: await getAccountMonthlyStats(a.id),
      // null cuando falta la cotización: la tarjeta lo omite en vez de mentir.
      balanceBase: convert(a.balance, a.currency, baseCurrency, rates),
    })),
  );

  // Las cuentas grandes primero: con siete cuentas, el orden de creación no dice nada.
  accountsWithStats.sort((a, b) => (b.balanceBase ?? 0) - (a.balanceBase ?? 0));

  const patrimonio = accountsWithStats.reduce((s, a) => s + (a.balanceBase ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold lg:text-2xl">Cuentas</h1>
        <p className="text-muted-foreground text-sm">{accounts.length} cuentas activas</p>
      </header>

      <AccountList
        accounts={accountsWithStats}
        baseCurrency={baseCurrency}
        patrimonio={patrimonio}
      />
    </div>
  );
}
