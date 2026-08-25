-- Make category_id nullable since transfers don't have categories
alter table public.pending_bot_transactions alter column category_id drop not null;

-- Add to_account_id to support transfers
alter table public.pending_bot_transactions add column if not exists to_account_id uuid references public.accounts(id);
