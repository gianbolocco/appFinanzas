"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { PERIODS } from "@/lib/period";

type Option = { id: string; name: string };

export function FiltersBar({ accounts, categories }: { accounts: Option[]; categories: Option[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const periodo = params.get("periodo") ?? "mes";
  const cuenta = params.get("cuenta") ?? "";
  const categoria = params.get("categoria") ?? "";
  const hasFilters = Boolean(cuenta || categoria);

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    // "mes" es el default: no ensucia la URL.
    if (!value || (key === "periodo" && value === "mes")) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `/dashboard/reportes?${qs}` : "/dashboard/reportes");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-muted flex flex-wrap gap-1 rounded-xl p-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => set("periodo", p.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm ${
              periodo === p.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <select
          value={cuenta}
          onChange={(e) => set("cuenta", e.target.value)}
          className="border-input bg-card focus:border-primary h-9 flex-1 rounded-lg border px-2 text-xs outline-none"
        >
          <option value="">Todas las cuentas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={categoria}
          onChange={(e) => set("categoria", e.target.value)}
          className="border-input bg-card focus:border-primary h-9 flex-1 rounded-lg border px-2 text-xs outline-none"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              const next = new URLSearchParams(params.toString());
              next.delete("cuenta");
              next.delete("categoria");
              const qs = next.toString();
              router.push(qs ? `/dashboard/reportes?${qs}` : "/dashboard/reportes");
            }}
            className="border-border text-muted-foreground hover:bg-accent flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2 text-xs"
          >
            <X className="h-3 w-3" /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
