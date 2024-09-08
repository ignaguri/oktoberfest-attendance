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
    -- Insert the group
    INSERT INTO groups (name, password, created_by)
    VALUES (p_group_name, p_password, p_user_id)
    RETURNING id INTO v_group_id;
    
    -- Insert the creator as a member of the group
    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, p_user_id);
    
    -- Set the OUT parameters
    group_id := v_group_id;
    group_name := p_group_name;
END;
$$ LANGUAGE plpgsql;