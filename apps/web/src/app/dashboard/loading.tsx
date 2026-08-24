export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 px-5 pt-8 lg:px-8 lg:pt-10">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Saldo skeleton */}
      <div className="h-32 animate-pulse rounded-3xl bg-muted" />

      {/* Cuentas skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>

      {/* Resumen skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>

      {/* Movimientos skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
