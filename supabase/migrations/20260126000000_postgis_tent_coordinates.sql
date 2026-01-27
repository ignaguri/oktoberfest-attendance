-- Enable PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Add latitude and longitude columns to tents table
ALTER TABLE public.tents
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision;

-- Add geometry column for spatial operations (using PostGIS)
ALTER TABLE public.tents
ADD COLUMN IF NOT EXISTS location extensions.geometry(Point, 4326);

-- Create spatial index for efficient proximity queries
CREATE INDEX IF NOT EXISTS idx_tents_location_gist
ON public.tents USING GIST (location);

-- Create trigger function to auto-update geometry from lat/long
CREATE OR REPLACE FUNCTION public.update_tent_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := extensions.ST_SetSRID(
      extensions.ST_MakePoint(NEW.longitude, NEW.latitude), 4326
    );
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update geometry on insert/update
DROP TRIGGER IF EXISTS tent_location_trigger ON public.tents;
CREATE TRIGGER tent_location_trigger
BEFORE INSERT OR UPDATE ON public.tents
FOR EACH ROW EXECUTE FUNCTION public.update_tent_location();

-- RPC function to find nearby tents using PostGIS
-- Uses ST_Distance for accurate distance calculation and ST_DWithin for efficient filtering
CREATE OR REPLACE FUNCTION public.get_nearby_tents(
  input_latitude double precision,
  input_longitude double precision,
  radius_meters integer DEFAULT 100,
  input_festival_id uuid DEFAULT NULL
)
RETURNS TABLE (
  tent_id uuid,
  tent_name varchar,
  category varchar,
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  beer_price numeric
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    t.id as tent_id,
    t.name as tent_name,
    t.category,
    t.latitude,
    t.longitude,
    extensions.ST_Distance(
      t.location::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(input_longitude, input_latitude), 4326)::extensions.geography
    ) as distance_meters,
    ft.beer_price
  FROM public.tents t
  LEFT JOIN public.festival_tents ft ON ft.tent_id = t.id
    AND (input_festival_id IS NULL OR ft.festival_id = input_festival_id)
  WHERE t.location IS NOT NULL
    AND extensions.ST_DWithin(
      t.location::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(input_longitude, input_latitude), 4326)::extensions.geography,
      radius_meters
    )
  ORDER BY extensions.ST_Distance(
    t.location::extensions.geography,
    extensions.ST_SetSRID(extensions.ST_MakePoint(input_longitude, input_latitude), 4326)::extensions.geography
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_nearby_tents TO authenticated;

-- Update existing tents with Oktoberfest Theresienwiese coordinates
-- These are approximate coordinates for the various tents at Oktoberfest
-- Theresienwiese center: ~48.1314°N, 11.5498°E

-- Large tents (Hauptzelte) - northern section
UPDATE public.tents SET latitude = 48.13265, longitude = 11.54652
WHERE id = '9eb72005-8026-4665-be77-4a61fbcc3fa1'; -- Festhalle Schottenhamel (main tent, tapping ceremony)

UPDATE public.tents SET latitude = 48.13195, longitude = 11.54718
WHERE id = '253eb29d-8efe-4095-9671-4eff02704c4a'; -- Hofbräu-Festzelt

UPDATE public.tents SET latitude = 48.13148, longitude = 11.54795
WHERE id = '631abb99-4237-4bbc-94d7-2a6c18e11e25'; -- Augustiner-Festhalle

UPDATE public.tents SET latitude = 48.13102, longitude = 11.54868
WHERE id = '0935a117-4fe2-46fb-b8fa-fc45d9496af9'; -- Paulaner Festzelt

UPDATE public.tents SET latitude = 48.13055, longitude = 11.54942
WHERE id = 'dd7b4b6d-7a57-411a-baf8-8c0d20682b64'; -- Löwenbräu-Festzelt

UPDATE public.tents SET latitude = 48.13008, longitude = 11.55015
WHERE id = '282d326c-0e14-43e2-b8c6-9bf098a0fde6'; -- Hacker-Festzelt

UPDATE public.tents SET latitude = 48.12962, longitude = 11.55088
WHERE id = '4d140654-f235-44b8-8d6e-8f23e57274a2'; -- Pschorr-Festzelt Bräurosl

UPDATE public.tents SET latitude = 48.12915, longitude = 11.55162
WHERE id = '017977ea-a9c3-4865-b494-edc49efc6212'; -- Ochsenbraterei

UPDATE public.tents SET latitude = 48.12868, longitude = 11.55235
WHERE id = '55ff3af6-f1d6-481a-a8f4-58fa23f00f68'; -- Armbrustschützen Festzelt

UPDATE public.tents SET latitude = 48.12822, longitude = 11.55308
WHERE id = '5deac267-6401-437f-adae-e81769e4e781'; -- Schützen-Festzelt

UPDATE public.tents SET latitude = 48.12775, longitude = 11.55382
WHERE id = '49449d2f-c9b7-4b8b-9ed7-889690493c3d'; -- Marstall-Festzelt

UPDATE public.tents SET latitude = 48.12728, longitude = 11.55455
WHERE id = 'da36b13f-1e75-4299-9f75-1de4eb38b416'; -- Fischer-Vroni

UPDATE public.tents SET latitude = 48.12682, longitude = 11.55528
WHERE id = '37ad3fc4-9d52-4e19-91c7-a01ed11c6854'; -- Käfer Wiesn-Schänke

UPDATE public.tents SET latitude = 48.12635, longitude = 11.55602
WHERE id = '2661d289-5ecd-42a0-9a59-eaf5ef94f92d'; -- Kufflers Weinzelt

-- Small tents (Kleine Zelte) - scattered around
UPDATE public.tents SET latitude = 48.13218, longitude = 11.54580
WHERE id = 'bbbf2c29-7b2e-487a-bcfc-c4b75547f83a'; -- Bodo's Cafézelt & Cocktailbar

UPDATE public.tents SET latitude = 48.13175, longitude = 11.54525
WHERE id = '1764c5e2-6f01-4119-a55a-7d0efe3ae861'; -- Café Theres'

UPDATE public.tents SET latitude = 48.13132, longitude = 11.54610
WHERE id = '28a517af-f440-4102-9ad3-beaed8347061'; -- Feisingers Kas- und Weinstubn

UPDATE public.tents SET latitude = 48.13088, longitude = 11.54555
WHERE id = 'f8e94181-3a63-4e68-9285-588038be343f'; -- Fisch-Bäda

UPDATE public.tents SET latitude = 48.13042, longitude = 11.54498
WHERE id = '6fcea9eb-c5c5-4d8f-9363-cbd86119128e'; -- Glöckle-Wirt

UPDATE public.tents SET latitude = 48.12998, longitude = 11.54442
WHERE id = 'f02ae7eb-3c8c-4e38-ae4a-7b0f9fc5e404'; -- Goldener Hahn

UPDATE public.tents SET latitude = 48.12952, longitude = 11.54385
WHERE id = '6d4e022d-c033-4a56-a19b-441dfe8430fd'; -- Heimer Enten- und Hühnerbraterei

UPDATE public.tents SET latitude = 48.12908, longitude = 11.54328
WHERE id = 'e2eae4f6-8da8-46db-b76a-d1fb50eca8f6'; -- Heinz Wurst- und Hühnerbraterei

UPDATE public.tents SET latitude = 48.12862, longitude = 11.54272
WHERE id = 'ecaae5eb-9745-4359-826a-9a14aa91591b'; -- Hochreiters Haxnbraterei

UPDATE public.tents SET latitude = 48.12818, longitude = 11.54215
WHERE id = '24b50db1-f7c1-4132-a07c-00ad2cb8c2e1'; -- Hühner- und Entenbraterei Ammer

UPDATE public.tents SET latitude = 48.12772, longitude = 11.54158
WHERE id = '2196e0ea-1262-4f2c-97ef-bcd67104ae72'; -- Kalbsbraterei

UPDATE public.tents SET latitude = 48.12728, longitude = 11.54102
WHERE id = '0898010d-693f-47be-b8f2-5916ad5a56d0'; -- Münchner Knödelei

UPDATE public.tents SET latitude = 48.12682, longitude = 11.54045
WHERE id = 'ce088585-ac22-447f-817d-1c4a28779d07'; -- Münchner Stubn

UPDATE public.tents SET latitude = 48.12638, longitude = 11.53988
WHERE id = 'a20effb6-612e-4085-8de0-6fbc0dff1dc1'; -- Münchner Weißbiergarten

UPDATE public.tents SET latitude = 48.12592, longitude = 11.53932
WHERE id = 'cb0a2849-159f-48f6-902f-fba73ae9c9a2'; -- Rischart's Café Kaiserschmarrn

UPDATE public.tents SET latitude = 48.12548, longitude = 11.53875
WHERE id = '014c7c7e-f904-4fcc-931f-2b80c9ceff2b'; -- Schiebl's Kaffeehaferl

UPDATE public.tents SET latitude = 48.12502, longitude = 11.53818
WHERE id = '949ee890-ee80-406c-af23-ded34e838b44'; -- Vinzenzmurr Metzger Stubn

UPDATE public.tents SET latitude = 48.12458, longitude = 11.53762
WHERE id = '7b91d421-5052-4109-b47f-8136f3bb9a89'; -- Wiesn Guglhupf

UPDATE public.tents SET latitude = 48.12412, longitude = 11.53705
WHERE id = '5162f382-2321-495c-b723-942a4708811e'; -- Wildstuben

UPDATE public.tents SET latitude = 48.12368, longitude = 11.53648
WHERE id = 'b349fe59-e104-42f1-9157-1859d829c1fa'; -- Wirtshaus im Schichtl

UPDATE public.tents SET latitude = 48.12322, longitude = 11.53592
WHERE id = '387574a0-8c63-4bf0-a4d0-a0bc37158ddd'; -- Zur Bratwurst

-- Old/Traditional tents (Oide Wiesn)
UPDATE public.tents SET latitude = 48.12985, longitude = 11.55425
WHERE id = '907342a2-ab22-4b27-8ebd-f7225a4d13e7'; -- Boandlkramerei

UPDATE public.tents SET latitude = 48.12942, longitude = 11.55482
WHERE id = 'f2df3186-ec0d-467f-a560-fffa48a72897'; -- Festzelt Tradition

UPDATE public.tents SET latitude = 48.12898, longitude = 11.55538
WHERE id = '668a1446-8af3-44a5-92c5-8c04bccd80e3'; -- Herzkasperlzelt

UPDATE public.tents SET latitude = 48.12855, longitude = 11.55595
WHERE id = '655190b1-ca0d-4d5a-8def-74f8a20f1e2b'; -- Museumzelt

UPDATE public.tents SET latitude = 48.12812, longitude = 11.55652
WHERE id = 'e61d04d2-6a16-4069-bf79-85dcf4827c94'; -- Volkssängerzelt Schützenlisl

UPDATE public.tents SET latitude = 48.12768, longitude = 11.55708
WHERE id = '2b8dcaaf-b24b-4f8e-8496-012120df341c'; -- Zur Schönheitskönigin
