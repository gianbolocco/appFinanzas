"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function getTelegramStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { linked: false };

  const { data: link } = await supabase
    .from("bot_links")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (link) {
    return { linked: true, username: link.telegram_user_id || "Bot" };
  }

  // Verificar si hay un código pendiente
  const { data: code } = await supabase
    .from("pair_codes")
    .select("code, expires_at")
    .eq("user_id", user.id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { linked: false, pendingCode: code?.code || null };
}

export async function generatePairCode() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Generar un código alfanumérico aleatorio de 6 caracteres
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Expira en 10 minutos
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  const { error } = await supabase.from("pair_codes").insert({
    user_id: user.id,
    code,
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw error;
  
  revalidatePath("/dashboard/ajustes");
  return code;
}

export async function unlinkTelegram() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  await supabase.from("bot_links").delete().eq("user_id", user.id);
  
  revalidatePath("/dashboard/ajustes");
}
