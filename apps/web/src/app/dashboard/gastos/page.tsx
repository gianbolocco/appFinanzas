import { getTransactions, getCategories, getAccounts } from "@/lib/queries";
import { TransactionList } from "./transaction-list";

export default async function GastosPage() {
  const [transactions, categories, accounts] = await Promise.all([
    getTransactions({ limit: 100 }),
    getCategories(),
    getAccounts(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Movimientos</h1>
        <p className="text-sm text-muted-foreground">{transactions.length} en total</p>
      </header>

      <TransactionList
        transactions={transactions}
        categories={categories}
        accounts={accounts}
      />
    </div>
  );
}
