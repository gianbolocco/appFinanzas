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

export async function updateCategory(categoryId: string, formData: FormData) {
  const parsed = categoryFormSchema.parse({
    name: formData.get("name"),
    kind: formData.get("kind") ?? "expense",
    parent_id: formData.get("parent_id") || null,
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || "oklch(0.62 0.15 162)",
  });

  const supabase = await createClient();
  const { error } = await supabase.from("categories").update(parsed).eq("id", categoryId);
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
  } else if (parsed.type === "transfer" && parsed.to_account_id) {
    // Transferencia: crear DOS transacciones (gasto en origen + ingreso en destino)
    const destRate = Number(formData.get("dest_rate") ?? "1") || 1;
    const destAmount = parsed.amount * destRate;

    // Buscar info de las cuentas
    const { data: toAcc } = await supabase
      .from("accounts")
      .select("name, currency")
      .eq("id", parsed.to_account_id)
      .single();
    const { data: fromAcc } = await supabase
      .from("accounts")
      .select("name, currency")
      .eq("id", parsed.account_id)
      .single();

    const destCurrency = toAcc?.currency ?? parsed.currency;
    const destBase = destAmount * (destCurrency === baseCurrency ? 1 : rate);

    // Gasto en la cuenta origen
    const { error: outErr } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "expense",
      amount: parsed.amount,
      currency: parsed.currency,
      amount_base: amountBase,
      exchange_rate: rate,
      account_id: parsed.account_id,
      to_account_id: parsed.to_account_id,
      note: parsed.note ? `Transfer → ${toAcc?.name ?? ""}: ${parsed.note}` : `Transfer → ${toAcc?.name ?? ""}`,
      date: parsed.date,
      source: "manual",
    });
    if (outErr) throw outErr;

    // Ingreso en la cuenta destino
    const { error: inErr } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "income",
      amount: destAmount,
      currency: destCurrency,
      amount_base: destBase,
      exchange_rate: destRate,
      account_id: parsed.to_account_id,
      to_account_id: parsed.account_id,
      note: parsed.note ? `Transfer ← ${fromAcc?.name ?? ""}: ${parsed.note}` : `Transfer ← ${fromAcc?.name ?? ""}`,
      date: parsed.date,
      source: "manual",
    });
    if (inErr) throw inErr;
  } else {
    // Gasto o ingreso simple
    const { error } = await supabase.from("transactions").insert({
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
    });
    if (error) throw error;
  }

  // Ajustar saldos: ahora las transferencias son expense (origen) + income (destino),
  // así que se ajustan solas con la lógica de gasto/ingreso.
  if (parsed.type !== "transfer") {
    const sign = parsed.type === "income" ? 1 : -1;
    const delta = installments ? sign * (parsed.amount / installmentsCount) : sign * parsed.amount;
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
  } else if (parsed.to_account_id) {
    // Transferencia: restar del origen (gasto) y sumar al destino (ingreso)
    const destRate = Number(formData.get("dest_rate") ?? "1") || 1;
    const destAmount = parsed.amount * destRate;

    const { data: origAcc } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", parsed.account_id)
      .single();
    if (origAcc) {
      await supabase
        .from("accounts")
        .update({ balance: origAcc.balance - parsed.amount })
        .eq("id", parsed.account_id);
    }

    const { data: destAcc } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", parsed.to_account_id)
      .single();
    if (destAcc) {
      await supabase
        .from("accounts")
        .update({ balance: destAcc.balance + destAmount })
        .eq("id", parsed.to_account_id);
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

  // Buscar la transacción
  const { data: tx } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (!tx) return;
  if (tx.parent_transaction_id) throw new Error("No se pueden borrar cuotas individuales");

  // Si es parte de una transferencia (tiene to_account_id), buscar y borrar la contrapartida
  const pairedIds: string[] = [transactionId];
  if (tx.to_account_id) {
    const { data: paired } = await supabase
      .from("transactions")
      .select("id, type, amount, account_id, exchange_rate")
      .eq("to_account_id", tx.account_id)
      .eq("account_id", tx.to_account_id)
      .eq("date", tx.date)
      .neq("id", transactionId);
    for (const p of paired ?? []) {
      pairedIds.push(p.id);
      // Revertir saldo de la contrapartida
      const sign = p.type === "income" ? -1 : 1;
      const { data: acc } = await supabase.from("accounts").select("balance").eq("id", p.account_id).single();
      if (acc) {
        await supabase.from("accounts").update({ balance: acc.balance + sign * p.amount }).eq("id", p.account_id);
      }
    }
  }

  // Revertir saldo de la transacción principal
  const sign = tx.type === "income" ? -1 : 1;
  const { data: acc } = await supabase.from("accounts").select("balance").eq("id", tx.account_id).single();
  if (acc) {
    await supabase.from("accounts").update({ balance: acc.balance + sign * tx.amount }).eq("id", tx.account_id);
  }

  // Borrar todas (principal + contrapartidas + hijas de cuota por cascade)
  for (const id of pairedIds) {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/gastos");
  revalidatePath(`/dashboard/cuentas/${tx.account_id}`);
}

// ----------------------------------------------------------------------------
// Actualizar transacción (edición — soporta gastos, ingresos y transferencias)
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

  const { data: original, error: origErr } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
  if (origErr || !original) throw new Error("Transacción no encontrada");
  if (original.parent_transaction_id) throw new Error("No se pueden editar cuotas individuales");

  const { data: profile } = await supabase.from("users").select("base_currency").eq("id", user.id).single();
  const baseCurrency = profile?.base_currency ?? "ARS";
  const rate = parsed.currency === baseCurrency ? 1 : await fetchRate(supabase, parsed.currency, baseCurrency);
  const amountBase = parsed.amount * rate;

  // 1. Revertir saldo original + borrar contrapartida si era transferencia
  const origSign = original.type === "income" ? -1 : 1;
  const { data: origAcc } = await supabase.from("accounts").select("balance").eq("id", original.account_id).single();
  if (origAcc) {
    await supabase.from("accounts").update({ balance: origAcc.balance + origSign * original.amount }).eq("id", original.account_id);
  }

  if (original.to_account_id) {
    // Era transferencia: buscar y revertir+borrar la contrapartida
    const { data: paired } = await supabase
      .from("transactions")
      .select("*")
      .eq("to_account_id", original.account_id)
      .eq("account_id", original.to_account_id)
      .eq("date", original.date)
      .neq("id", transactionId);
    for (const p of paired ?? []) {
      const pSign = p.type === "income" ? -1 : 1;
      const { data: pAcc } = await supabase.from("accounts").select("balance").eq("id", p.account_id).single();
      if (pAcc) {
        await supabase.from("accounts").update({ balance: pAcc.balance + pSign * p.amount }).eq("id", p.account_id);
      }
      await supabase.from("transactions").delete().eq("id", p.id);
    }
  }

  // 2. Actualizar la transacción principal
  const { error: updateErr } = await supabase
    .from("transactions")
    .update({
      type: parsed.type === "transfer" ? "expense" : parsed.type,
      amount: parsed.amount,
      currency: parsed.currency,
      amount_base: amountBase,
      exchange_rate: rate,
      category_id: parsed.category_id,
      account_id: parsed.account_id,
      to_account_id: parsed.type === "transfer" ? parsed.to_account_id : null,
      note: parsed.note,
      date: parsed.date,
    })
    .eq("id", transactionId);
  if (updateErr) throw updateErr;

  // 3. Si es transferencia, crear la contrapartida (ingreso en destino)
  if (parsed.type === "transfer" && parsed.to_account_id) {
    const { data: accounts } = await supabase.from("accounts").select("id, name, currency").eq("id", parsed.to_account_id).single();
    const destRate = Number(formData.get("dest_rate") ?? "1") || 1;
    const destAmount = parsed.amount * destRate;
    const destCurrency = accounts?.currency ?? parsed.currency;
    const destBase = destAmount * (destCurrency === baseCurrency ? 1 : rate);

    const { data: origAccount } = await supabase.from("accounts").select("name").eq("id", parsed.account_id).single();

    await supabase.from("transactions").insert({
      user_id: user.id,
      type: "income",
      amount: destAmount,
      currency: destCurrency,
      amount_base: destBase,
      exchange_rate: destRate,
      account_id: parsed.to_account_id,
      to_account_id: parsed.account_id,
      note: parsed.note
        ? `Transfer ← ${origAccount?.name ?? ""}: ${parsed.note}`
        : `Transfer ← ${origAccount?.name ?? ""}`,
      date: parsed.date,
      source: "manual",
    });
  }

  // 4. Aplicar nuevos saldos
  const newSign = parsed.type === "income" ? 1 : -1;
  const { data: newAcc } = await supabase.from("accounts").select("balance").eq("id", parsed.account_id).single();
  if (newAcc) {
    await supabase.from("accounts").update({ balance: newAcc.balance + newSign * parsed.amount }).eq("id", parsed.account_id);
  }

  if (parsed.type === "transfer" && parsed.to_account_id) {
    const destRate = Number(formData.get("dest_rate") ?? "1") || 1;
    const destAmount = parsed.amount * destRate;
    const { data: destAcc } = await supabase.from("accounts").select("balance").eq("id", parsed.to_account_id).single();
    if (destAcc) {
      await supabase.from("accounts").update({ balance: destAcc.balance + destAmount }).eq("id", parsed.to_account_id);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/gastos");
  revalidatePath(`/dashboard/cuentas/${parsed.account_id}`);
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
