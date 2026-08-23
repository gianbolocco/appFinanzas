export default function ReportesPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Reportes</h1>
        <p className="text-sm text-muted-foreground">Disponible en Fase 4</p>
      </header>
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">
          Acá vas a ver gráficos: desglose por categoría, tendencias, avance vs presupuesto y más.
        </p>
      </div>
    </div>
  );
}
