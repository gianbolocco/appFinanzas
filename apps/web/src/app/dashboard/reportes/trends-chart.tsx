"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompact, formatMoneyRound } from "@/lib/format";

type Datum = { month: string; ingresos: number; gastos: number; balance: number };

/**
 * Barras de ingresos y gastos + línea de balance. Antes eran tres líneas
 * superpuestas: en mobile no se distinguía cuál era cuál.
 */
export function TrendsChart({ data, currency }: { data: Datum[]; currency: string }) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
        Sin datos para mostrar
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="var(--muted-foreground)"
          tickFormatter={formatCompact}
          width={48}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="border-border bg-card rounded-xl border p-2.5 text-xs shadow-lg">
                <p className="text-muted-foreground mb-1 font-medium capitalize">{label}</p>
                {payload.map((p, i) => (
                  <p key={i} className="flex items-center justify-between gap-4">
                    <span style={{ color: p.color }}>{p.name}</span>
                    <span className="font-mono tabular-nums">
                      {formatMoneyRound(Number(p.value), currency)}
                    </span>
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ingresos" name="Ingresos" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="gastos" name="Gastos" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
        <Line
          type="monotone"
          dataKey="balance"
          name="Balance"
          stroke="var(--chart-3)"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
