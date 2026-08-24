"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-svh bg-background text-foreground">
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Error inesperado</h2>
            <p className="text-sm text-muted-foreground">
              Algo falló. Probá recargar la página.
            </p>
          </div>
          <Button onClick={reset} variant="default" size="default">
            Reintentar
          </Button>
        </div>
      </body>
    </html>
  );
}
