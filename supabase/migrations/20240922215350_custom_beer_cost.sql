ALTER TABLE public.profiles
ADD COLUMN custom_beer_cost DECIMAL(10, 2) DEFAULT 16.2;

-- Set default value for existing users
UPDATE public.profiles
SET custom_beer_cost = 16.2
WHERE custom_beer_cost IS NULL;
