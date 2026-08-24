import { getTransactions, getCategories, getAccounts } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";
import { TransactionList } from "./transaction-list";

export default async function GastosPage() {
  const { profile } = await getCurrentUser();
  const [transactions, categories, accounts] = await Promise.all([
    getTransactions({ limit: 100 }),
    getCategories(),
    getAccounts(),
  ]);

  const slimAccounts = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
  }));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Movimientos</h1>
        <p className="text-sm text-muted-foreground">{transactions.length} en total</p>
      </header>

      <TransactionList
        transactions={transactions}
        categories={categories}
        accounts={slimAccounts}
        baseCurrency={profile.base_currency}
      />
    </div>
  );
}
