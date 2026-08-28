import { ArrowDown, ArrowUp } from "lucide-react";

/**
 * Variación vs el período anterior. `goodWhenUp` decide el color:
 * subir ingresos es bueno, subir gastos no.
 */
export function Delta({
  value,
  goodWhenUp = true,
  className = "",
}: {
  value: number | null;
  goodWhenUp?: boolean;
  className?: string;
}) {
  if (value === null || !Number.isFinite(value)) return null;

  const up = value >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUp : ArrowDown;

  return (
    <span
      className={`flex shrink-0 items-center gap-0.5 text-xs tabular-nums ${good ? "text-primary" : "text-destructive"} ${className}`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}
