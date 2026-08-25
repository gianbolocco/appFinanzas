"use client";

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";

type Transaction = {
  id: string;
  type: string;
  amount: number;
  date: string;
};

export function DashboardChart({
  transactions,
  baseCurrency,
}: {
  transactions: Transaction[];
  baseCurrency: string;
}) {
  const data = useMemo(() => {
    // Generate dummy historical data for the last 7 days for the chart
    // since we only get 5 recent transactions from the API.
    // In a real scenario, you'd fetch an aggregated summary per day.
    const today = new Date();
    const result = [];
    let cumulative = 50000; // Starting dummy baseline
    const variations = [5000, -2000, 15000, -8000, 3000, -1000, 12000];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString('es-AR', { weekday: 'short' });
      
      const variation = variations[i];
      cumulative += variation;
      
      result.push({
        name: dayStr,
        balance: cumulative,
      });
    }
    return result;
  }, []);

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} 
            dy={10} 
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-xl glass border border-border p-2 shadow-lg">
                    <p className="text-sm font-medium">{payload[0].payload.name}</p>
                    <p className="text-sm font-bold text-primary font-mono">
                      {formatMoney(payload[0].value as number, baseCurrency)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="var(--primary)"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorBalance)"
            activeDot={{ r: 6, strokeWidth: 0, fill: "var(--primary)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
