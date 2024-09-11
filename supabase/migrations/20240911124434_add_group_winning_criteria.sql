ALTER TABLE public.groups
ADD COLUMN description TEXT,
ADD COLUMN winning_criteria VARCHAR(20) CHECK (winning_criteria IN ('days_attended', 'total_beers', 'avg_beers'));

-- Update existing groups to have a default winning criteria
UPDATE public.groups
SET winning_criteria = 'total_beers'
WHERE winning_criteria IS NULL;

-- Make winning_criteria NOT NULL for future inserts
ALTER TABLE public.groups
ALTER COLUMN winning_criteria SET NOT NULL;

CREATE OR REPLACE FUNCTION create_group_with_member(
    p_group_name VARCHAR,
    p_password VARCHAR,
    p_user_id UUID,
    OUT group_id UUID,
    OUT group_name VARCHAR
) AS $$
DECLARE
    v_group_id UUID;
BEGIN
    -- Insert the group with default winning_criteria
    INSERT INTO groups (name, password, created_by, winning_criteria)
    VALUES (p_group_name, p_password, p_user_id, 'total_beers')
    RETURNING id INTO v_group_id;
    
    -- Insert the creator as a member of the group
    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, p_user_id);
    
    -- Set the OUT parameters
    group_id := v_group_id;
    group_name := p_group_name;
END;
$$ LANGUAGE plpgsql;
