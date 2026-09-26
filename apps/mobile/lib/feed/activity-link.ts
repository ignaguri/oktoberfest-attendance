import type { Href } from "expo-router";

interface LinkableActivity {
  activity_type: string;
  activity_data: unknown;
}

const ACHIEVEMENT_NAME_KEY = /^achievements\.(.+)\.name$/;

function dataOf(activity: LinkableActivity): Record<string, unknown> {
  const { activity_data } = activity;
  return activity_data && typeof activity_data === "object"
    ? (activity_data as Record<string, unknown>)
    : {};
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * The achievement slug behind a feed item. The feed only carries the name's
 * i18n key, which every achievement builds as `achievements.<slug>.name`.
 */
export function achievementSlugFromName(name: unknown): string | undefined {
  if (typeof name !== "string") {
    return undefined;
  }
  return ACHIEVEMENT_NAME_KEY.exec(name)?.[1];
}

/**
 * Where tapping a feed item takes the viewer, or null when it has nowhere to
 * go. Photos are left out: the thumbnail has its own tap target.
 *
 * @param memberGroupIds - Groups the viewer belongs to. A friend joining a
 *   group the viewer is not in has no page the viewer can open.
 */
export function getActivityLink(
  activity: LinkableActivity,
  memberGroupIds: ReadonlySet<string>,
): Href | null {
  const data = dataOf(activity);

  switch (activity.activity_type) {
    case "achievement_unlock": {
      const slug = achievementSlugFromName(data.achievement_name);
      return slug ? { pathname: "/achievements", params: { highlight: slug } } : "/achievements";
    }

    case "group_join": {
      const groupId = stringField(data, "group_id");
      return groupId && memberGroupIds.has(groupId) ? `/group-detail/${groupId}` : null;
    }

    case "beer_count_update":
    case "tent_checkin":
    case "tent_reservation": {
      const tentId = stringField(data, "tent_id");
      return tentId ? { pathname: "/map", params: { tentId } } : null;
    }

    case "day_plan": {
      const dates = Array.isArray(data.dates) ? data.dates : [];
      const firstDate = [...dates].filter((date) => typeof date === "string").sort()[0];
      return firstDate ? { pathname: "/attendance", params: { date: firstDate } } : null;
    }

    default:
      return null;
  }
}
