"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Datum = { month: string; ingresos: number; gastos: number; ahorro: number };

export function TrendsLineChart({ data }: { data: Datum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin datos para mostrar
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <Tooltip
          formatter={(value) => Number(value).toLocaleString("es-AR", { minimumFractionDigits: 0 })}
          contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="ingresos" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="gastos" stroke="var(--destructive)" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="ahorro" stroke="oklch(0.65 0.15 240)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
