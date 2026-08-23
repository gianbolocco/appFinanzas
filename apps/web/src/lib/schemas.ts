import { z } from "zod";

// ----------------------------------------------------------------------------
// Enums (espejo de los enums de Postgres)
// ----------------------------------------------------------------------------
export const transactionTypeSchema = z.enum(["expense", "income", "transfer", "subscription"]);
export const accountTypeSchema = z.enum([
  "cash",
  "bank",
  "credit_card",
  "debit_card",
  "wallet",
  "savings",
]);
export const categoryKindSchema = z.enum(["expense", "income", "transfer"]);
export const cadenceSchema = z.enum(["weekly", "monthly", "quarterly", "yearly"]);
export const transactionSourceSchema = z.enum(["manual", "bot", "receipt", "import"]);
export const budgetPeriodSchema = z.enum(["monthly", "yearly"]);

// ----------------------------------------------------------------------------
// Cuenta
// ----------------------------------------------------------------------------
export const accountFormSchema = z.object({
  name: z.string().min(1, "Poné un nombre").max(60),
  type: accountTypeSchema,
  currency: z.string().min(3).max(3),
  balance: z.number().finite(),
  credit_limit: z.number().finite().optional(),
  archived: z.boolean().default(false),
});

export type AccountForm = z.infer<typeof accountFormSchema>;

// ----------------------------------------------------------------------------
// Categoría
// ----------------------------------------------------------------------------
export const categoryFormSchema = z.object({
  name: z.string().min(1, "Poné un nombre").max(60),
  kind: categoryKindSchema.default("expense"),
  parent_id: z.string().uuid().optional().nullable(),
  icon: z.string().optional(),
  color: z.string().default("oklch(0.62 0.15 162)"),
});

export type CategoryForm = z.infer<typeof categoryFormSchema>;

// ----------------------------------------------------------------------------
// Transacción
// ----------------------------------------------------------------------------
export const transactionFormSchema = z
  .object({
    type: transactionTypeSchema,
    amount: z.number().positive("El monto tiene que ser positivo"),
    currency: z.string().min(3).max(3),
    category_id: z.string().uuid().optional().nullable(),
    account_id: z.string().uuid().min(1, "Elegí una cuenta"),
    to_account_id: z.string().uuid().optional().nullable(),
    note: z.string().max(200).optional(),
    date: z.string().min(1, "Elegí una fecha"),
    tags: z.array(z.string()).default([]),
    // Cuotas
    installments_total: z.number().int().min(1).max(60).optional(),
  })
  .refine((d) => d.type !== "transfer" || !!d.to_account_id, {
    message: "Elegí la cuenta destino",
    path: ["to_account_id"],
  });

export type TransactionForm = z.infer<typeof transactionFormSchema>;

// ----------------------------------------------------------------------------
// Filtros de lista
// ----------------------------------------------------------------------------
export const transactionFiltersSchema = z.object({
  type: transactionTypeSchema.optional(),
  category_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
