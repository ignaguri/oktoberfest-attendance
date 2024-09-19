-- Create the super_admin role
CREATE ROLE super_admin;

-- Grant all privileges on all tables, sequences, and functions in the public schema to super_admin
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO super_admin;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO super_admin;

GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO super_admin;

-- Add the is_super_admin column to the profiles table
ALTER TABLE public.profiles
ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;

-- Create or replace the is_super_admin function
CREATE
OR REPLACE FUNCTION public.is_super_admin () RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Loop through all tables in the public schema
    FOR r IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        -- Construct and execute the policy creation statement
        EXECUTE format('
            CREATE POLICY "Super admins can do anything" ON public.%I
            USING (public.is_super_admin())
            WITH CHECK (public.is_super_admin());', r.table_name);
        
        -- Enable row-level security for the table
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.table_name);
    END LOOP;
END $$;
