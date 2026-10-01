-- tents.id was uuid NOT NULL with no default, so every insert had to supply
-- its own id (admin.repository.ts generates one with crypto.randomUUID()).
alter table public.tents alter column id set default gen_random_uuid();
