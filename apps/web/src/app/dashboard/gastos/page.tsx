import { getTransactions, getCategories, getAccounts } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";
import { TransactionList } from "./transaction-list";

export default async function GastosPage({ searchParams }: PageProps<"/dashboard/gastos">) {
  const sp = await searchParams;
  const categoria = typeof sp.categoria === "string" ? sp.categoria : "";

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
    balance: a.balance,
  }));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Movimientos</h1>
        <p className="text-muted-foreground text-sm">{transactions.length} en total</p>
      </header>

      <TransactionList
        transactions={transactions}
        categories={categories}
        accounts={slimAccounts}
        baseCurrency={profile.base_currency}
        initialCategory={categoria}
      />
    </div>
  );
}
