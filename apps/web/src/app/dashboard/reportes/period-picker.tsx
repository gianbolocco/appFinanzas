"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { PERIODS } from "@/lib/period";

export function PeriodPicker() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("periodo") ?? "mes";

  function select(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "mes") next.delete("periodo");
    else next.set("periodo", key);
    const qs = next.toString();
    router.push(qs ? `/dashboard/reportes?${qs}` : "/dashboard/reportes");
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => select(p.key)}
          className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs sm:text-sm font-medium transition ${current === p.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50"}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
