-- Who a plan's owner is going with: friends, group-mates, or whole groups.
--
-- Tags are display only (no notification). Each row names exactly one person or
-- one group. Rows follow their plan: they're deleted with it, and readable by
-- whoever can read it.

CREATE TABLE public.day_plan_companions (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  plan_id uuid NOT NULL REFERENCES public.day_plans(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT day_plan_companions_one_target CHECK (num_nonnulls(user_id, group_id) = 1)
);

CREATE UNIQUE INDEX day_plan_companions_plan_user
  ON public.day_plan_companions (plan_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX day_plan_companions_plan_group
  ON public.day_plan_companions (plan_id, group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_day_plan_companions_user ON public.day_plan_companions (user_id);
CREATE INDEX idx_day_plan_companions_group ON public.day_plan_companions (group_id);

ALTER TABLE public.day_plan_companions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.day_plan_companions FROM anon;
GRANT SELECT, INSERT, DELETE ON public.day_plan_companions TO authenticated;
GRANT ALL ON public.day_plan_companions TO service_role;

-- The subquery runs under day_plans' own policies, so a tag is visible exactly
-- when its plan is: to the owner, and to friends and group-mates when visible.
CREATE POLICY "Users can view companions of plans they can see"
  ON public.day_plan_companions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.day_plans p WHERE p.id = day_plan_companions.plan_id)
  );

-- Only the plan's owner tags, and only people they know in that festival: an
-- accepted friend or someone sharing a group, or a group they're in.
CREATE POLICY "Plan owners can tag friends, group-mates and their groups"
  ON public.day_plan_companions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.day_plans p
      WHERE p.id = day_plan_companions.plan_id
        AND p.user_id = (SELECT auth.uid())
        AND (
          (
            day_plan_companions.user_id IS NOT NULL
            AND day_plan_companions.user_id <> (SELECT auth.uid())
            AND (
              public.is_friend((SELECT auth.uid()), day_plan_companions.user_id)
              OR EXISTS (
                SELECT 1 FROM public.v_user_shared_group_members v
                WHERE v.owner_id = day_plan_companions.user_id
                  AND v.viewer_id = (SELECT auth.uid())
                  AND v.festival_id = p.festival_id
              )
            )
          )
          OR (
            day_plan_companions.group_id IS NOT NULL
            AND public.is_group_member(day_plan_companions.group_id, (SELECT auth.uid()))
            AND EXISTS (
              SELECT 1 FROM public.groups g
              WHERE g.id = day_plan_companions.group_id
                AND g.festival_id = p.festival_id
            )
          )
        )
    )
  );

CREATE POLICY "Plan owners can remove companions"
  ON public.day_plan_companions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.day_plans p
      WHERE p.id = day_plan_companions.plan_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

-- Replaces a plan's tags in one transaction, so a rejected tag leaves the old
-- set in place. SECURITY INVOKER: the policies above do the checking.
CREATE OR REPLACE FUNCTION public.set_day_plan_companions(
  p_plan_id uuid,
  p_user_ids uuid[],
  p_group_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM day_plan_companions WHERE plan_id = p_plan_id;

  INSERT INTO day_plan_companions (plan_id, user_id)
  SELECT p_plan_id, u FROM unnest(COALESCE(p_user_ids, '{}')) AS u GROUP BY u;

  INSERT INTO day_plan_companions (plan_id, group_id)
  SELECT p_plan_id, g FROM unnest(COALESCE(p_group_ids, '{}')) AS g GROUP BY g;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_day_plan_companions(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_day_plan_companions(uuid, uuid[], uuid[]) TO authenticated, service_role;
