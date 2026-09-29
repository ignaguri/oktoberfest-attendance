import { type WrappedData, WrappedDataSchema } from "@prostcounter/shared";

/**
 * get_wrapped_data returns snake_case JSON; this is its only translation to the
 * camelCase contract. Every field is listed so a key the DB stops (or starts)
 * returning fails WrappedDataSchema here, not as a blank slide.
 */
// The RPC result is untyped jsonb; `any` is confined to this function.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapToWrappedData(raw: any): WrappedData {
  const peak = raw?.peak_moments;
  const vsAvg = raw?.comparisons?.vs_festival_avg;
  const vsLastYear = raw?.comparisons?.vs_last_year;

  return WrappedDataSchema.parse({
    userInfo: {
      username: raw.user_info.username,
      fullName: raw.user_info.full_name,
      avatarUrl: raw.user_info.avatar_url,
    },
    festivalInfo: {
      name: raw.festival_info.name,
      startDate: raw.festival_info.start_date,
      endDate: raw.festival_info.end_date,
      location: raw.festival_info.location,
      festivalType: raw.festival_info.festival_type,
    },
    basicStats: {
      totalBeers: raw.basic_stats.total_beers,
      daysAttended: raw.basic_stats.days_attended,
      avgBeers: raw.basic_stats.avg_beers,
      totalSpent: raw.basic_stats.total_spent,
      beerCost: raw.basic_stats.beer_cost,
    },
    tentStats: {
      uniqueTents: raw.tent_stats.unique_tents,
      favoriteTent: raw.tent_stats.favorite_tent,
      tentDiversityPct: raw.tent_stats.tent_diversity_pct,
      tentBreakdown: raw.tent_stats.tent_breakdown.map((tent: any) => ({
        tentName: tent.tent_name,
        visitCount: tent.visit_count,
      })),
    },
    peakMoments: {
      bestDay: peak.best_day
        ? {
            date: peak.best_day.date,
            beerCount: peak.best_day.beer_count,
            tentsVisited: peak.best_day.tents_visited,
            spent: peak.best_day.spent,
          }
        : null,
      maxSingleSession: peak.max_single_session ?? 0,
      mostExpensiveDay: peak.most_expensive_day
        ? { date: peak.most_expensive_day.date, amount: peak.most_expensive_day.amount }
        : null,
    },
    socialStats: {
      groupsJoined: raw.social_stats.groups_joined,
      topRankings: raw.social_stats.top_3_rankings.map((ranking: any) => ({
        groupName: ranking.group_name,
        position: ranking.position,
      })),
      photosUploaded: raw.social_stats.photos_uploaded,
      totalGroupMembers: raw.social_stats.total_group_members,
      pictures: raw.social_stats.pictures.map((picture: any) => ({
        id: picture.id,
        pictureUrl: picture.picture_url,
        createdAt: picture.created_at,
        attendanceDate: picture.attendance_date,
      })),
    },
    globalLeaderboardPositions: {
      daysAttended: raw.global_leaderboard_positions.days_attended,
      totalBeers: raw.global_leaderboard_positions.total_beers,
      avgBeers: raw.global_leaderboard_positions.avg_beers,
    },
    achievements: raw.achievements.map((achievement: any) => ({
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      tier: achievement.tier,
      points: achievement.points,
      rarity: achievement.rarity,
      unlockedAt: achievement.unlocked_at,
    })),
    timeline: raw.timeline.map((day: any) => ({
      date: day.date,
      beerCount: day.beer_count,
      spent: day.spent,
      tentsVisited: day.tents_visited,
    })),
    comparisons: {
      vsFestivalAvg: {
        beersDiffPct: vsAvg.beers_diff_pct,
        daysDiffPct: vsAvg.days_diff_pct,
        avgBeers: vsAvg.avg_beers,
        avgDays: vsAvg.avg_days,
        medianBeers: vsAvg.median_beers,
        medianDays: vsAvg.median_days,
        beersPercentile: vsAvg.beers_percentile,
        daysPercentile: vsAvg.days_percentile,
        attendeeCount: vsAvg.attendee_count,
      },
      vsLastYear: vsLastYear
        ? {
            beersDiff: vsLastYear.beers_diff,
            daysDiff: vsLastYear.days_diff,
            spentDiff: vsLastYear.spent_diff,
            prevBeers: vsLastYear.prev_beers,
            prevDays: vsLastYear.prev_days,
            prevFestivalName: vsLastYear.prev_festival_name,
          }
        : null,
    },
    personality: {
      type: raw.personality.type,
      // The SQL builds traits from CASEs without ELSE and its `- ARRAY[NULL]`
      // does not strip nulls from a jsonb array, so unmet traits arrive as null.
      traits: raw.personality.traits.filter((trait: unknown) => trait !== null),
    },
    drinkStats: {
      totalDrinks: raw.drink_stats.total_drinks,
      topDrinkType: raw.drink_stats.top_drink_type,
      breakdown: raw.drink_stats.breakdown.map((drink: any) => ({
        drinkType: drink.drink_type,
        count: drink.count,
        percentage: drink.percentage,
      })),
    },
    timing: {
      timedDays: raw.timing.timed_days,
      medianFirstHour: raw.timing.median_first_hour,
      medianLastHour: raw.timing.median_last_hour,
      peakHour: raw.timing.peak_hour,
      weekendShare: raw.timing.weekend_share,
    },
  });
}
