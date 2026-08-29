"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Wallet,
  PieChart,
  TrendingUp,
  Settings,
  Plus,
  Landmark,
  Tags,
  Target,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";

import { TransactionSheet } from "@/components/transaction-sheet";

const NAV_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Inicio", exact: true },
  { href: "/dashboard/gastos", icon: Wallet, label: "Gastos" },
  { href: "/dashboard/presupuestos", icon: PieChart, label: "Presupuestos" },
  { href: "/dashboard/metas", icon: Target, label: "Metas" },
  { href: "/dashboard/suscripciones", icon: RefreshCw, label: "Suscripciones" },
  { href: "/dashboard/reportes", icon: TrendingUp, label: "Reportes" },
  { href: "/dashboard/cuentas", icon: Landmark, label: "Cuentas" },
  { href: "/dashboard/categorias", icon: Tags, label: "Categorías" },
  { href: "/dashboard/ajustes", icon: Settings, label: "Ajustes" },
];

type Account = { id: string; name: string; type: string; currency: string; balance: number };
type Category = {
  id: string;
  name: string;
  kind: string;
  parent_id: string | null;
  icon: string | null;
  color: string;
  is_predefined: boolean;
};

export function Sidebar({
  accounts,
  categories,
  baseCurrency,
}: {
  accounts: Account[];
  categories: Category[];
  baseCurrency: string;
}) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <aside className="border-border/50 glass-panel z-20 hidden w-[260px] shrink-0 flex-col border-r p-4 shadow-xl shadow-black/5 lg:fixed lg:inset-y-0 lg:left-0 lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <Image src="/logo.png" alt="" width={40} height={40} priority className="h-10 w-10" />
          <span className="text-lg font-semibold tracking-tight">Guita</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="bg-primary/10 dark:bg-primary/20 absolute inset-0 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={`z-10 h-5 w-5 transition-transform group-hover:scale-110 ${isActive ? "fill-primary/20" : ""}`}
                />
                <span className="z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSheetOpen(true)}
          className="bg-gradient-premium text-primary-foreground shadow-primary/25 hover:shadow-primary/40 mt-6 flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium shadow-lg transition-shadow"
        >
          <Plus className="h-5 w-5" />
          Agregar movimiento
        </motion.button>
      </aside>

      <TransactionSheet
        open={sheetOpen}
        onOpenChange={(o) => {
          if (!o) setSheetOpen(false);
        }}
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
      />
    </>
  );
}
