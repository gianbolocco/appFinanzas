import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  if (profile.onboarded) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-6 py-10">
      <header className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <span className="text-lg font-bold">G</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bienvenido a Guita</h1>
          <p className="text-sm text-muted-foreground">Tres pasos y listo.</p>
        </div>
      </header>

      <OnboardingForm userId={user.id} />
    </main>
  );
}
