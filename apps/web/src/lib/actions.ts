"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase-server";
import {
  accountFormSchema,
  categoryFormSchema,
  transactionFormSchema,
  budgetFormSchema,
  goalFormSchema,
  contributionFormSchema,
  subscriptionFormSchema,
  profileFormSchema,
} from "@/lib/schemas";
import { todayLocal, addCadenceIso } from "@/lib/dates";
import { splitInstallments, installmentDates, dueThrough } from "@/lib/money";

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
  const rate = parsed.currency === baseCurrency ? 1 : await fetchRate(supabase, parsed.currency, baseCurrency, parsed.date);
  const amountBase = parsed.amount * rate;

  const installments = parsed.installments_total && parsed.installments_total > 1;
  const installmentsCount = parsed.installments_total ?? 1;

  if (installments) {
    // El padre guarda la compra original: monto total, sin número de cuota.
    // is_installment_parent (columna generada) lo excluye de listas y agregados.
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

    const amounts = splitInstallments(parsed.amount, installmentsCount);
    const bases = splitInstallments(amountBase, installmentsCount);
    const dates = installmentDates(parsed.date, installmentsCount);

    const children = amounts.map((amount, i) => ({
      user_id: user.id,
      type: parsed.type,
      amount,
      currency: parsed.currency,
      amount_base: bases[i],
      exchange_rate: rate,
      category_id: parsed.category_id,
      account_id: parsed.account_id,
      note: parsed.note
        ? `${parsed.note} (cuota ${i + 1}/${installmentsCount})`
        : `Cuota ${i + 1}/${installmentsCount}`,
      date: dates[i],
      source: "manual",
      installments_total: installmentsCount,
      installment_number: i + 1,
      parent_transaction_id: parent.id,
    }));

    const { error: childErr } = await supabase.from("transactions").insert(children);
    if (childErr) throw childErr;

    // El saldo se mueve por cuota vencida, no por el total de la compra.
    const vencidas = dueThrough(dates, todayLocal());
    const montoVencido = amounts.slice(0, vencidas).reduce((s, a) => s + a, 0);
    const sign = parsed.type === "income" ? 1 : -1;
    await applyBalance(supabase, parsed.account_id, sign * montoVencido);
  } else if (parsed.type === "transfer" && parsed.to_account_id) {
    // Una transferencia es UNA fila: origen en account_id, destino en to_account_id.
    // amount queda en la moneda del origen; dest_amount en la del destino.
    const destRate = Number(formData.get("dest_rate") ?? "1") || 1;
    const destAmount = Math.round(parsed.amount * destRate * 100) / 100;

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "transfer",
      amount: parsed.amount,
      currency: parsed.currency,
      dest_amount: destAmount,
      amount_base: amountBase,
      exchange_rate: rate,
      account_id: parsed.account_id,
      to_account_id: parsed.to_account_id,
      note: parsed.note,
      date: parsed.date,
      source: "manual",
    });
    if (error) throw error;
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

  // Ajustar saldos
  if (parsed.type === "transfer" && parsed.to_account_id) {
    const destRate = Number(formData.get("dest_rate") ?? "1") || 1;
    const destAmount = Math.round(parsed.amount * destRate * 100) / 100;
    await applyBalance(supabase, parsed.account_id, -parsed.amount);
    await applyBalance(supabase, parsed.to_account_id, destAmount);
  } else if (!installments) {
    const sign = parsed.type === "income" ? 1 : -1;
    await applyBalance(supabase, parsed.account_id, sign * parsed.amount);
  }
  // El caso `installments` ajusta su propio saldo en la Task 4.

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

  // Revertir saldos.
  if (tx.is_installment_parent) {
    // Se restaron solo las cuotas vencidas al crear: hay que devolver eso mismo,
    // no el total de la compra. Las hijas se van por cascade.
    const { data: children } = await supabase
      .from("transactions")
      .select("amount, date")
      .eq("parent_transaction_id", tx.id);

    const today = todayLocal();
    const montoVencido = (children ?? [])
      .filter((c) => c.date <= today)
      .reduce((s, c) => s + c.amount, 0);
    const sign = tx.type === "income" ? -1 : 1;
    await applyBalance(supabase, tx.account_id, sign * montoVencido);
  } else if (tx.type === "transfer") {
    await applyBalance(supabase, tx.account_id, tx.amount);
    await applyBalance(supabase, tx.to_account_id, -(tx.dest_amount ?? tx.amount));
  } else {
    const sign = tx.type === "income" ? -1 : 1;
    await applyBalance(supabase, tx.account_id, sign * tx.amount);
  }

  const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
  if (error) throw error;

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
  const rate = parsed.currency === baseCurrency ? 1 : await fetchRate(supabase, parsed.currency, baseCurrency, parsed.date);
  const amountBase = parsed.amount * rate;

  // 1. Revertir el efecto de la transacción original sobre los saldos
  if (original.type === "transfer") {
    await applyBalance(supabase, original.account_id, original.amount);
    await applyBalance(supabase, original.to_account_id, -(original.dest_amount ?? original.amount));
  } else {
    const origSign = original.type === "income" ? -1 : 1;
    await applyBalance(supabase, original.account_id, origSign * original.amount);
  }

  // 2. Actualizar la fila
  const destRate = Number(formData.get("dest_rate") ?? "1") || 1;
  const destAmount = Math.round(parsed.amount * destRate * 100) / 100;
  const isTransfer = parsed.type === "transfer" && !!parsed.to_account_id;

  const { error: updateErr } = await supabase
    .from("transactions")
    .update({
      type: parsed.type,
      amount: parsed.amount,
      currency: parsed.currency,
      dest_amount: isTransfer ? destAmount : null,
      amount_base: amountBase,
      exchange_rate: rate,
      category_id: isTransfer ? null : parsed.category_id,
      account_id: parsed.account_id,
      to_account_id: isTransfer ? parsed.to_account_id : null,
      note: parsed.note,
      date: parsed.date,
    })
    .eq("id", transactionId);
  if (updateErr) throw updateErr;

  // 3. Aplicar el efecto de la transacción actualizada
  if (isTransfer) {
    await applyBalance(supabase, parsed.account_id, -parsed.amount);
    await applyBalance(supabase, parsed.to_account_id ?? null, destAmount);
  } else {
    const newSign = parsed.type === "income" ? 1 : -1;
    await applyBalance(supabase, parsed.account_id, newSign * parsed.amount);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/gastos");
  revalidatePath(`/dashboard/cuentas/${parsed.account_id}`);
}

// ----------------------------------------------------------------------------
// Presupuestos
// ----------------------------------------------------------------------------
export async function createBudget(formData: FormData) {
  const parsed = budgetFormSchema.parse({
    category_id: formData.get("category_id"),
    period: formData.get("period") ?? "monthly",
    amount_limit: Number(formData.get("amount_limit")),
    currency: formData.get("currency") ?? "ARS",
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("budgets").insert({ user_id: user.id, ...parsed });
  if (error) throw error;

  revalidatePath("/dashboard/presupuestos");
}

export async function deleteBudget(budgetId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (error) throw error;
  revalidatePath("/dashboard/presupuestos");
}

// ----------------------------------------------------------------------------
// Metas de ahorro
// ----------------------------------------------------------------------------
export async function createGoal(formData: FormData) {
  const parsed = goalFormSchema.parse({
    name: formData.get("name"),
    target_amount: Number(formData.get("target_amount")),
    target_date: formData.get("target_date") || undefined,
    currency: formData.get("currency") ?? "ARS",
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("goals").insert({ user_id: user.id, ...parsed });
  if (error) throw error;

  revalidatePath("/dashboard/metas");
}

export async function deleteGoal(goalId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw error;
  revalidatePath("/dashboard/metas");
}

export async function archiveGoal(goalId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").update({ archived: true }).eq("id", goalId);
  if (error) throw error;
  revalidatePath("/dashboard/metas");
}

export async function contributeToGoal(goalId: string, formData: FormData) {
  const parsed = contributionFormSchema.parse({
    amount: Number(formData.get("amount")),
    account_id: formData.get("account_id"),
    note: formData.get("note") || undefined,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: goal } = await supabase
    .from("goals")
    .select("current_amount, target_amount, currency, name")
    .eq("id", goalId)
    .single();
  if (!goal) throw new Error("Meta no encontrada");

  const { data: profile } = await supabase
    .from("users")
    .select("base_currency")
    .eq("id", user.id)
    .single();
  const baseCurrency = profile?.base_currency ?? "ARS";
  const date = todayLocal();
  const rate = await fetchRate(supabase, goal.currency, baseCurrency, date);

  // El aporte sale de una cuenta real y deja rastro como transacción.
  // goal_id la marca como ahorro: no se cuenta como gasto del mes.
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: "expense",
      amount: parsed.amount,
      currency: goal.currency,
      amount_base: parsed.amount * rate,
      exchange_rate: rate,
      account_id: parsed.account_id,
      goal_id: goalId,
      note: parsed.note ? `Meta ${goal.name}: ${parsed.note}` : `Aporte a meta: ${goal.name}`,
      date,
      source: "manual",
    })
    .select()
    .single();
  if (txErr) throw txErr;

  const { error: contribErr } = await supabase.from("goal_contributions").insert({
    goal_id: goalId,
    user_id: user.id,
    amount: parsed.amount,
    transaction_id: tx.id,
    note: parsed.note,
  });
  if (contribErr) throw contribErr;

  await applyBalance(supabase, parsed.account_id, -parsed.amount);

  // Completar una meta no la archiva: archivar es una decisión del usuario.
  await supabase
    .from("goals")
    .update({ current_amount: goal.current_amount + parsed.amount })
    .eq("id", goalId);

  revalidatePath("/dashboard/metas");
  revalidatePath("/dashboard");
}

// ----------------------------------------------------------------------------
// Suscripciones
// ----------------------------------------------------------------------------
export async function createSubscription(formData: FormData) {
  const parsed = subscriptionFormSchema.parse({
    name: formData.get("name"),
    amount: Number(formData.get("amount")),
    currency: formData.get("currency") ?? "ARS",
    cadence: formData.get("cadence") ?? "monthly",
    next_date: formData.get("next_date"),
    category_id: formData.get("category_id") || null,
    account_id: formData.get("account_id") || null,
    active: true,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("subscriptions").insert({ user_id: user.id, ...parsed });
  if (error) throw error;

  revalidatePath("/dashboard/suscripciones");
}

export async function deleteSubscription(subscriptionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("subscriptions").delete().eq("id", subscriptionId);
  if (error) throw error;
  revalidatePath("/dashboard/suscripciones");
}

export async function updateSubscription(subscriptionId: string, formData: FormData) {
  const parsed = subscriptionFormSchema.parse({
    name: formData.get("name"),
    amount: Number(formData.get("amount")),
    currency: formData.get("currency") ?? "ARS",
    cadence: formData.get("cadence") ?? "monthly",
    next_date: formData.get("next_date"),
    category_id: formData.get("category_id") || null,
    account_id: formData.get("account_id") || null,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("subscriptions").update(parsed).eq("id", subscriptionId);
  if (error) throw error;
  revalidatePath("/dashboard/suscripciones");
}

export async function toggleSubscription(subscriptionId: string, currentActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ active: !currentActive })
    .eq("id", subscriptionId);
  if (error) throw error;
  revalidatePath("/dashboard/suscripciones");
}

export async function registerSubscriptionPayment(subscriptionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .single();
  if (subErr || !sub) throw new Error("Suscripción no encontrada");

  if (!sub.account_id) {
    throw new Error("Asignale una cuenta a la suscripción antes de registrar el pago");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("base_currency")
    .eq("id", user.id)
    .single();
  const baseCurrency = profile?.base_currency ?? "ARS";

  // El pago se fecha el día que vencía, no hoy: si registrás con atraso,
  // el gasto cae en el mes que corresponde.
  const paymentDate = sub.next_date;
  const rate = await fetchRate(supabase, sub.currency, baseCurrency, paymentDate);

  const { error: txErr } = await supabase.from("transactions").insert({
    user_id: user.id,
    type: "expense",
    amount: sub.amount,
    currency: sub.currency,
    amount_base: sub.amount * rate,
    exchange_rate: rate,
    category_id: sub.category_id,
    account_id: sub.account_id,
    note: `Suscripción: ${sub.name}`,
    date: paymentDate,
    source: "manual",
    subscription_id: subscriptionId,
  });

  if (txErr) {
    // uq_subscription_payment_per_day: la base rechaza el pago duplicado.
    if (txErr.code === "23505") {
      throw new Error("Ese pago ya estaba registrado");
    }
    throw txErr;
  }

  await applyBalance(supabase, sub.account_id, -sub.amount);

  await supabase
    .from("subscriptions")
    .update({ next_date: addCadenceIso(sub.next_date, sub.cadence) })
    .eq("id", subscriptionId);

  revalidatePath("/dashboard/suscripciones");
  revalidatePath("/dashboard");
}

// ----------------------------------------------------------------------------
// Perfil
// ----------------------------------------------------------------------------
export async function updateProfile(formData: FormData) {
  const parsed = profileFormSchema.parse({
    full_name: formData.get("full_name"),
    base_currency: formData.get("base_currency"),
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("users").update(parsed).eq("id", user.id);
  if (error) throw error;

  // La moneda base afecta todos los totales, no solo Ajustes.
  revalidatePath("/dashboard", "layout");
}

// ----------------------------------------------------------------------------
// Helper: buscar rate de conversión
// ----------------------------------------------------------------------------
/**
 * Busca la cotización vigente a la fecha de la transacción.
 * Si no hay ninguna, cae a 1 y lo deja registrado: un rate faltante
 * corrompe amount_base en silencio, así que al menos queda rastro.
 */
async function fetchRate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string,
  onDate?: string,
): Promise<number> {
  if (from === to) return 1;

  let q = supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base", from)
    .eq("quote", to)
    .order("date", { ascending: false })
    .limit(1);
  if (onDate) q = q.lte("date", onDate);

  const { data } = await q.maybeSingle();
  if (data?.rate) return data.rate;

  // Probar el par inverso antes de rendirse
  let inv = supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base", to)
    .eq("quote", from)
    .order("date", { ascending: false })
    .limit(1);
  if (onDate) inv = inv.lte("date", onDate);

  const { data: inverse } = await inv.maybeSingle();
  if (inverse?.rate) return 1 / inverse.rate;

  console.warn(`[guita] sin cotización ${from}->${to} al ${onDate ?? "hoy"}; usando 1`);
  return 1;
}

/**
 * Ajusta el saldo de una cuenta sumando `delta` (negativo para restar).
 * ponytail: read-modify-write sin transaccion; con un solo usuario alcanza.
 * Si algun dia hay escrituras concurrentes, mover a una funcion Postgres.
 */
async function applyBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string | null,
  delta: number,
): Promise<void> {
  if (!accountId || delta === 0) return;
  const { data: acc } = await supabase
    .from("accounts")
    .select("balance")
    .eq("id", accountId)
    .single();
  if (!acc) return;
  await supabase
    .from("accounts")
    .update({ balance: acc.balance + delta })
    .eq("id", accountId);
}

export async function setDefaultAccount(accountId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Primero desmarcamos todas las de este usuario
  await supabase
    .from("accounts")
    .update({ is_default: false })
    .eq("user_id", user.id);

  // Luego marcamos la seleccionada
  const { error } = await supabase
    .from("accounts")
    .update({ is_default: true })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cuentas");
}
