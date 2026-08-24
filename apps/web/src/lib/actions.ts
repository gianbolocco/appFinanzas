"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase-server";
import { accountFormSchema, categoryFormSchema, transactionFormSchema } from "@/lib/schemas";

// ----------------------------------------------------------------------------
// Cuentas
// ----------------------------------------------------------------------------
export async function createAccount(formData: FormData) {
  const parsed = accountFormSchema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
    currency: formData.get("currency"),
    balance: Number(formData.get("balance") ?? 0),
    credit_limit: formData.get("credit_limit") ? Number(formData.get("credit_limit")) : undefined,
    archived: false,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    ...parsed,
    balance: parsed.balance,
  });
  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cuentas");
}

export async function deleteAccount(accountId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", accountId);
  if (error) throw error;
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/cuentas");
}

// ----------------------------------------------------------------------------
// Categorías
// ----------------------------------------------------------------------------
export async function createCategory(formData: FormData) {
  const parsed = categoryFormSchema.parse({
    name: formData.get("name"),
    kind: formData.get("kind") ?? "expense",
    parent_id: formData.get("parent_id") || null,
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || "oklch(0.62 0.15 162)",
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("categories").insert({ user_id: user.id, ...parsed });
  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/categorias");
}

export async function deleteCategory(categoryId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) throw error;
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/categorias");
}

// ----------------------------------------------------------------------------
// Transacciones
// ----------------------------------------------------------------------------
export async function createTransaction(formData: FormData) {
  const parsed = transactionFormSchema.parse({
    type: formData.get("type"),
    amount: Number(formData.get("amount")),
    currency: formData.get("currency"),
    category_id: formData.get("category_id") || null,
    account_id: formData.get("account_id"),
    to_account_id: formData.get("to_account_id") || null,
    note: formData.get("note") || undefined,
    date: formData.get("date"),
    installments_total: formData.get("installments_total")
      ? Number(formData.get("installments_total"))
      : undefined,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Buscar rate de conversión (por ahora 1 si es la moneda base)
  const { data: profile } = await supabase
    .from("users")
    .select("base_currency")
    .eq("id", user.id)
    .single();

  const baseCurrency = profile?.base_currency ?? "ARS";
  const rate = parsed.currency === baseCurrency ? 1 : await fetchRate(supabase, parsed.currency, baseCurrency);
  const amountBase = parsed.amount * rate;

  const installments = parsed.installments_total && parsed.installments_total > 1;
  const installmentsCount = parsed.installments_total ?? 1;

  if (installments) {
    // Crear transacción padre (sin amount imputado) + N hijas
    const { data: parent, error: parentErr } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        amount_base: amountBase,
        exchange_rate: rate,
        category_id: parsed.category_id,
        account_id: parsed.account_id,
        note: parsed.note,
        date: parsed.date,
        source: "manual",
        installments_total: installmentsCount,
      })
      .select()
      .single();
    if (parentErr) throw parentErr;

    const installmentAmount = parsed.amount / installmentsCount;
    const installmentBase = amountBase / installmentsCount;
    const baseDate = new Date(parsed.date + "T00:00:00");

    const children = Array.from({ length: installmentsCount }, (_, i) => {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      return {
        user_id: user.id,
        type: parsed.type,
        amount: Math.round(installmentAmount * 100) / 100,
        currency: parsed.currency,
        amount_base: Math.round(installmentBase * 100) / 100,
        exchange_rate: rate,
        category_id: parsed.category_id,
        account_id: parsed.account_id,
        note: parsed.note ? `${parsed.note} (cuota ${i + 1}/${installmentsCount})` : `Cuota ${i + 1}/${installmentsCount}`,
        date: d.toISOString().slice(0, 10),
        source: "manual",
        installments_total: installmentsCount,
        installment_number: i + 1,
        parent_transaction_id: parent.id,
      };
    });

    const { error: childErr } = await supabase.from("transactions").insert(children);
    if (childErr) throw childErr;
  } else {
    // Transacción simple
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: parsed.type,
      amount: parsed.amount,
      currency: parsed.currency,
      amount_base: amountBase,
      exchange_rate: rate,
      category_id: parsed.category_id,
      account_id: parsed.account_id,
      to_account_id: parsed.to_account_id,
      note: parsed.note,
      date: parsed.date,
      source: "manual",
    });
    if (error) throw error;

    // Si es transferencia, registrar contrapartida en la cuenta destino
    if (parsed.type === "transfer" && parsed.to_account_id) {
      const { error: t2Err } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: "transfer",
        amount: parsed.amount,
        currency: parsed.currency,
        amount_base: amountBase,
        exchange_rate: rate,
        account_id: parsed.to_account_id,
        to_account_id: parsed.account_id,
        note: parsed.note,
        date: parsed.date,
        source: "manual",
      });
      if (t2Err) throw t2Err;
    }
  }

  // Actualizar saldo de cuenta (excepto transferencias que se compensan)
  if (parsed.type !== "transfer") {
    const sign = parsed.type === "income" ? 1 : -1;
    const delta = installments ? sign * (parsed.amount / installmentsCount) : sign * parsed.amount;
    // Leer saldo actual y actualizar (RLS permite porque el usuario es dueño)
    const { data: acc } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", parsed.account_id)
      .single();
    if (acc) {
      await supabase
        .from("accounts")
        .update({ balance: acc.balance + delta })
        .eq("id", parsed.account_id);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/gastos");
}

export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Buscar la transacción para revertir saldo (excepto hijas de cuota y transferencias)
  const { data: tx } = await supabase
    .from("transactions")
    .select("type, amount, account_id, installment_number, parent_transaction_id")
    .eq("id", transactionId)
    .single();

  if (tx && tx.type !== "transfer" && !tx.parent_transaction_id) {
    const sign = tx.type === "income" ? -1 : 1; // revertir
    const { data: acc } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", tx.account_id)
      .single();
    if (acc) {
      await supabase.from("accounts").update({ balance: acc.balance + sign * tx.amount }).eq("id", tx.account_id);
    }
  }

  // Borra padre + hijas (cascade por on delete cascade)
  const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
  if (error) throw error;
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/gastos");
}

// ----------------------------------------------------------------------------
// Actualizar transacción (edición simple — no cuotas ni transferencias)
// ----------------------------------------------------------------------------
export async function updateTransaction(transactionId: string, formData: FormData) {
  const parsed = transactionFormSchema.parse({
    type: formData.get("type"),
    amount: Number(formData.get("amount")),
    currency: formData.get("currency"),
    category_id: formData.get("category_id") || null,
    account_id: formData.get("account_id"),
    to_account_id: formData.get("to_account_id") || null,
    note: formData.get("note") || undefined,
    date: formData.get("date"),
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Buscar la transacción original (no permitir editar hijas de cuota)
  const { data: original, error: origErr } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
  if (origErr || !original) throw new Error("Transacción no encontrada");
  if (original.parent_transaction_id) throw new Error("No se pueden editar cuotas individuales");

  // Recalcular rate y amount_base
  const { data: profile } = await supabase
    .from("users")
    .select("base_currency")
    .eq("id", user.id)
    .single();
  const baseCurrency = profile?.base_currency ?? "ARS";
  const rate = parsed.currency === baseCurrency ? 1 : await fetchRate(supabase, parsed.currency, baseCurrency);
  const amountBase = parsed.amount * rate;

  // Actualizar la transacción
  const { error: updateErr } = await supabase
    .from("transactions")
    .update({
      type: parsed.type,
      amount: parsed.amount,
      currency: parsed.currency,
      amount_base: amountBase,
      exchange_rate: rate,
      category_id: parsed.category_id,
      account_id: parsed.account_id,
      note: parsed.note,
      date: parsed.date,
    })
    .eq("id", transactionId);
  if (updateErr) throw updateErr;

  // Ajustar saldo: revertir original + aplicar nuevo (excepto transferencias)
  if (original.type !== "transfer") {
    const origSign = original.type === "income" ? -1 : 1;
    const { data: origAcc } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", original.account_id)
      .single();
    if (origAcc) {
      await supabase
        .from("accounts")
        .update({ balance: origAcc.balance + origSign * original.amount })
        .eq("id", original.account_id);
    }
  }

  if (parsed.type !== "transfer") {
    const newSign = parsed.type === "income" ? 1 : -1;
    const { data: newAcc } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", parsed.account_id)
      .single();
    if (newAcc) {
      await supabase
        .from("accounts")
        .update({ balance: newAcc.balance + newSign * parsed.amount })
        .eq("id", parsed.account_id);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/gastos");
}

// ----------------------------------------------------------------------------
// Helper: buscar rate de conversión
// ----------------------------------------------------------------------------
async function fetchRate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string,
): Promise<number> {
  if (from === to) return 1;
  const { data } = await supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base", from)
    .eq("quote", to)
    .order("date", { ascending: false })
    .limit(1)
    .single();
  return data?.rate ?? 1;
}
