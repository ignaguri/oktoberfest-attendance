CREATE TABLE IF NOT EXISTS public.winning_criteria (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL
);

INSERT INTO public.winning_criteria (name) VALUES
('days_attended'),
('total_beers'),
('avg_beers')
ON CONFLICT (name) DO NOTHING;  -- Prevent duplicates

ALTER TABLE public.groups
ADD COLUMN winning_criteria_id INT REFERENCES public.winning_criteria(id) ON DELETE CASCADE;

-- Optionally, drop the old column if it exists
ALTER TABLE public.groups DROP COLUMN winning_criteria;

-- Update existing groups to use the new winning_criteria_id
UPDATE public.groups
SET winning_criteria_id = (SELECT id FROM public.winning_criteria WHERE name = 'total_beers');
