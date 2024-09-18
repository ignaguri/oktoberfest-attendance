-- Creating Tents table with a name and a category
CREATE TABLE tents (
  id uuid NOT NULL PRIMARY KEY,
  name character varying NOT NULL,
  category character varying CHECK (category IN ('large', 'small', 'old'))
);

-- Inserting data into the tents table

-- Large Tents
INSERT INTO tents (id, name, category) VALUES
  (uuid_generate_v4(), 'Armbrustschützenzelt', 'large'),
  (uuid_generate_v4(), 'Augustiner-Festhalle', 'large'),
  (uuid_generate_v4(), 'Bräurosl', 'large'),
  (uuid_generate_v4(), 'Fischer-Vroni', 'large'),
  (uuid_generate_v4(), 'Käfer Wiesnschänke', 'large'),
  (uuid_generate_v4(), 'Hacker-Festzelt', 'large'),
  (uuid_generate_v4(), 'Hofbräu-Festzelt', 'large'),
  (uuid_generate_v4(), 'Löwenbräu-Festzelt', 'large'),
  (uuid_generate_v4(), 'Marstall-Festzelt', 'large'),
  (uuid_generate_v4(), 'Ochsenbraterei', 'large'),
  (uuid_generate_v4(), 'Schottenhamel-Festhalle', 'large'),
  (uuid_generate_v4(), 'Schützenfestzelt', 'large'),
  (uuid_generate_v4(), 'Weinzelt', 'large'),
  (uuid_generate_v4(), 'Winzerer Fähndl (Paulaner Festzelt)', 'large');

-- Small Tents
INSERT INTO tents (id, name, category) VALUES
  (uuid_generate_v4(), 'Ammers Hühnerbraterei', 'small'),
  (uuid_generate_v4(), 'Bodos Cafézelt', 'small'),
  (uuid_generate_v4(), 'Café Kaiserschmarrn', 'small'),
  (uuid_generate_v4(), 'Feisingers Kas- und Weinstubn', 'small'),
  (uuid_generate_v4(), 'Glöckle-Wirt', 'small'),
  (uuid_generate_v4(), 'Kalbsbraterei', 'small'),
  (uuid_generate_v4(), 'Münchner Weißbiergarten', 'small'),
  (uuid_generate_v4(), 'Wildstuben', 'small'),
  (uuid_generate_v4(), 'Zur Bratwurst', 'small');

-- Old Tents
INSERT INTO tents (id, name, category) VALUES
  (uuid_generate_v4(), 'Tradition Tent (Festzelt Tradition)', 'old'),
  (uuid_generate_v4(), 'Herzkasperlzelt', 'old'),
  (uuid_generate_v4(), 'Museumzelt', 'old'),
  (uuid_generate_v4(), 'Zur Schönheitskönigin', 'old');

create table tent_visits(
  id uuid not null,
  user_id uuid not null,
  tent_id uuid not null,
  visit_date date not null,
  primary key (id),
  foreign key (user_id) references profiles(id),
  foreign key (tent_id) references tents(id)
);


CREATE OR REPLACE FUNCTION add_or_update_attendance_with_tents(
  p_user_id UUID,
  p_date DATE,
  p_beer_count INTEGER,
  p_tent_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_tent_id UUID;
BEGIN
  -- Insert or update the attendance record
  INSERT INTO attendances (user_id, date, beer_count)
  VALUES (p_user_id, p_date, p_beer_count)
  ON CONFLICT (user_id, date)
  DO UPDATE SET beer_count = p_beer_count;

  -- Delete existing tent visits for this date
  DELETE FROM tent_visits
  WHERE user_id = p_user_id AND visit_date = p_date;

  -- Insert new tent visits
  FOREACH v_tent_id IN ARRAY p_tent_ids
  LOOP
    INSERT INTO tent_visits (id, user_id, tent_id, visit_date)
    VALUES (uuid_generate_v4(), p_user_id, v_tent_id, p_date);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- First, drop the existing incorrect constraint
ALTER TABLE public.attendances
DROP CONSTRAINT IF EXISTS unique_date;

-- Then, add the correct constraint
ALTER TABLE public.attendances
ADD CONSTRAINT unique_user_date UNIQUE (user_id, date);

-- Optionally, you might want to drop the existing index on date if it's no longer needed
DROP INDEX IF EXISTS idx_attendances_date;

-- Instead, create a new index on (user_id, date) if it doesn't already exist
CREATE INDEX IF NOT EXISTS idx_attendances_user_date ON public.attendances (user_id, date);
