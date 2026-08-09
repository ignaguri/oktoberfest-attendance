import type { AchievementMetrics } from "@prostcounter/shared/achievements";

/** Every metric at its zero value, for tests that care about only one or two. */
export function emptyMetrics(overrides: Partial<AchievementMetrics> = {}): AchievementMetrics {
  return {
    drinks_total: 0,
    drinks_day_max: 0,
    drink_types_distinct: 0,
    volume_ml_total: 0,
    tip_cents_total: 0,
    spend_cents_total: 0,
    days_attended: 0,
    attendance_streak_max: 0,
    tents_distinct: 0,
    groups_joined: 0,
    photos_uploaded: 0,
    reactions_given: 0,
    crowd_reports: 0,
    festivals_attended: 0,
    festival_types_distinct: 0,
    friends_accepted: 0,
    group_wins: 0,
    podium_finishes: 0,
    active_days_total: 0,
    active_day_streak_max: 0,
    attended_opening_day: false,
    attended_closing_day: false,
    attended_every_day: false,
    attended_every_weekend_day: false,
    visited_all_large_tents: false,
    created_group: false,
    logged_first_drink: false,
    uploaded_first_photo: false,
    profile_complete: false,
    wrapped_viewed: false,
    ...overrides,
  };
}
