export default function ReportesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="bg-muted h-6 w-32 animate-pulse rounded" />
        <div className="bg-muted h-[86px] animate-pulse rounded-xl" />
      </div>

      {/* Ritmo */}
      <div className="bg-muted h-28 animate-pulse rounded-2xl" />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted h-16 animate-pulse rounded-2xl sm:h-24" />
        ))}
      </div>

      {/* Desglose + evolución */}
      {[1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="bg-muted h-5 w-40 animate-pulse rounded" />
          <div className="bg-muted h-64 animate-pulse rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
