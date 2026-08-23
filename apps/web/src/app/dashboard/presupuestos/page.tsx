export default function PresupuestosPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Presupuestos</h1>
        <p className="text-sm text-muted-foreground">Disponible en Fase 3</p>
      </header>
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">
          Acá vas a poder definir presupuestos mensuales por categoría y seguir tu avance.
        </p>
      </div>
    </div>
  );
}
