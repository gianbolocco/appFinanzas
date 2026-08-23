import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-8 px-6 lg:max-w-lg">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 7V4a1 1 0 0 0-1-1H6a2 2 0 0 0 0 4h13a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V4" />
            <path d="M19 12v7a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2v-3" />
          </svg>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Guita</h1>
          <p className="text-sm text-muted-foreground">Tu guita, en claro.</p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <LoginForm />
        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Al ingresar aceptás nuestros términos y la política de privacidad.
      </p>
    </main>
  );
}
