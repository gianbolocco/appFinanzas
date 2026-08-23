"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="h-11 w-full rounded-xl border border-border bg-card text-sm font-medium text-destructive transition hover:bg-destructive/5 disabled:opacity-50"
    >
      {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Cerrar sesión"}
    </button>
  );
}
