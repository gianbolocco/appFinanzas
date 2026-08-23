export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">AppFinanzas</h1>
        <p className="text-muted-foreground">
          Finanzas personales · carga desde Telegram y foto de tickets.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">Setup completo — Fase 0 finalizada.</p>
    </main>
  );
}
