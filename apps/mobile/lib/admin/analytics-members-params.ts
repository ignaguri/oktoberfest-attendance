import {
  type AnalyticsCohortMembersQuery,
  AnalyticsCohortMembersQuerySchema,
  type AnalyticsFunnelMembersQuery,
  AnalyticsFunnelMembersQuerySchema,
  type AnalyticsScorecardMembersQuery,
  AnalyticsScorecardMembersQuerySchema,
} from "@prostcounter/shared/schemas";

/** What the members screen lists; carried in its route params. */
export type MembersTarget =
  | ({ metric: "funnel" } & AnalyticsFunnelMembersQuery)
  | ({ metric: "scorecard"; festivalName?: string } & AnalyticsScorecardMembersQuery)
  | ({ metric: "cohorts" } & AnalyticsCohortMembersQuery);

type RouteParams = Record<string, string | string[] | undefined>;

/** A usable single param value; arrays and empty strings count as missing. */
function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** Drops keys whose value is undefined, so toEqual and route params stay clean. */
function defined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

/** The target in a deep link or push, or null when the params do not describe one. */
export function parseMembersParams(params: RouteParams): MembersTarget | null {
  const metric = single(params.metric);
  if (metric === "funnel") {
    const parsed = AnalyticsFunnelMembersQuerySchema.safeParse(
      defined({
        from: single(params.from),
        to: single(params.to),
        platform: single(params.platform),
        step: single(params.step),
      }),
    );
    return parsed.success ? defined({ metric: "funnel" as const, ...parsed.data }) : null;
  }
  if (metric === "scorecard") {
    const parsed = AnalyticsScorecardMembersQuerySchema.safeParse(
      defined({
        festivalId: single(params.festivalId),
        feature: single(params.feature),
        segment: single(params.segment),
      }),
    );
    return parsed.success
      ? defined({
          metric: "scorecard" as const,
          ...parsed.data,
          festivalName: single(params.festivalName),
        })
      : null;
  }
  if (metric === "cohorts") {
    const parsed = AnalyticsCohortMembersQuerySchema.safeParse(
      defined({ month: single(params.month), step: single(params.step) }),
    );
    return parsed.success ? defined({ metric: "cohorts" as const, ...parsed.data }) : null;
  }
  return null;
}

/** Route params for a target: strings only, no undefined values. */
export function membersRouteParams(target: MembersTarget): Record<string, string> {
  return defined(target as Record<string, string | undefined>) as Record<string, string>;
}
