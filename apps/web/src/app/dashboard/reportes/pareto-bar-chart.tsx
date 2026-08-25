"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Datum = { name: string; total: number; color: string };

export function ParetoBarChart({ data }: { data: Datum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin datos para mostrar
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.total, 0);
  // Calcular acumulado de forma inmutable
  const withPct = data.reduce<
    { name: string; total: number; color: string; pct: number; acum: number }[]
  >((arr, d) => {
    const prev = arr.length > 0 ? arr[arr.length - 1].acum : 0;
    const acum = prev + d.total;
    arr.push({
      name: d.name,
      total: d.total,
      color: d.color,
      pct: total > 0 ? (d.total / total) * 100 : 0,
      acum: total > 0 ? (acum / total) * 100 : 0,
    });
    return arr;
  }, []);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={withPct} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          stroke="var(--muted-foreground)"
          width={90}
        />
        <Tooltip
          formatter={(value) => Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
            color: "var(--card-foreground)",
            fontSize: 12,
          }}
          itemStyle={{ color: "var(--card-foreground)" }}
          labelStyle={{ color: "var(--muted-foreground)" }}
        />
        <Bar dataKey="total" radius={[0, 6, 6, 0]}>
          {withPct.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
