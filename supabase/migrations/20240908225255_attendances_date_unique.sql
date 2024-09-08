ALTER TABLE public.attendances
ADD CONSTRAINT unique_date UNIQUE (date);
