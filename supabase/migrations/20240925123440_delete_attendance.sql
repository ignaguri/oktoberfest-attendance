CREATE
OR REPLACE FUNCTION delete_attendance (p_attendance_id UUID) RETURNS VOID AS $$
BEGIN
    -- Delete associated beer pictures
    DELETE FROM public.beer_pictures
    WHERE attendance_id = p_attendance_id;

    -- Delete associated tent visits
    DELETE FROM public.tent_visits
    WHERE user_id IN (SELECT user_id FROM public.attendances WHERE id = p_attendance_id)
      AND visit_date::date = (SELECT date FROM public.attendances WHERE id = p_attendance_id)::date;

    -- Delete the attendance entry
    DELETE FROM public.attendances
    WHERE id = p_attendance_id;
END;
$$ LANGUAGE plpgsql;
