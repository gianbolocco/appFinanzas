"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, PieChart, TrendingUp, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";

import { TransactionSheet } from "@/components/transaction-sheet";
import { MoreSheet } from "@/components/more-sheet";

const TABS = [
  { href: "/dashboard", icon: Home, label: "Inicio", exact: true },
  { href: "/dashboard/gastos", icon: Wallet, label: "Gastos" },
  { href: "/dashboard/presupuestos", icon: PieChart, label: "Presup." },
  { href: "/dashboard/reportes", icon: TrendingUp, label: "Reportes" },
];

// Rutas que viven detrás del botón "Más": el tab se marca activo si estás en una.
const MORE_ROUTES = [
  "/dashboard/metas",
  "/dashboard/suscripciones",
  "/dashboard/cuentas",
  "/dashboard/categorias",
  "/dashboard/ajustes",
];

type Account = { id: string; name: string; type: string; currency: string };
type Category = {
  id: string;
  name: string;
  kind: string;
  parent_id: string | null;
  icon: string | null;
  color: string;
  is_predefined: boolean;
};

export function BottomNav({
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
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md lg:hidden">
        <button
          onClick={() => setSheetOpen(true)}
          className="pointer-events-auto absolute -top-6 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 active:scale-95"
          aria-label="Agregar movimiento"
        >
          <Plus className="h-6 w-6" />
        </button>
        <nav className="pointer-events-auto mx-3 mb-3 flex items-center justify-around rounded-full border border-border bg-card/90 p-1.5 shadow-lg backdrop-blur-md">
          {TABS.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium transition ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <tab.icon className={`h-5 w-5 ${isActive ? "fill-primary/20" : ""}`} />
                {tab.label}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium transition ${MORE_ROUTES.some((r) => pathname.startsWith(r)) ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="Más secciones"
          >
            <MoreHorizontal className="h-5 w-5" />
            Más
          </button>
        </nav>
      </div>

      <TransactionSheet
        open={sheetOpen}
        onOpenChange={(o) => { if (!o) setSheetOpen(false) }}
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
      />

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
