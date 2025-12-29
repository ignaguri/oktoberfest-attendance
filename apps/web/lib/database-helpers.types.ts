import type { Database } from "./database.types";

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Views<
  PublicViewNameOrOptions extends
    | keyof PublicSchema["Views"]
    | { schema: keyof Database },
  ViewName extends PublicViewNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicViewNameOrOptions["schema"]]["Views"]
    : never = never,
> = PublicViewNameOrOptions extends { schema: keyof Database }
  ? Database[PublicViewNameOrOptions["schema"]]["Views"][ViewName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicViewNameOrOptions extends keyof PublicSchema["Views"]
    ? PublicSchema["Views"][PublicViewNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

/* Manual type fixes applied:
   ✅ create_group_with_member: Returns { group_id: string, group_name: string }
   ✅ get_user_festival_stats: Returns single object (not array)
   
   NOTE: Re-apply these fixes after running `pnpm sup:db:types`
*/

/**
 * Helper type to extract return types from database functions
 * Usage: FunctionReturns<"get_user_achievements"> or FunctionReturns<"get_user_achievements", 0> for array elements
 */
export type FunctionReturns<
  FunctionName extends keyof PublicSchema["Functions"],
  Index extends number = never,
> = PublicSchema["Functions"][FunctionName] extends {
  Returns: infer R;
}
  ? Index extends never
    ? R
    : R extends any[]
      ? R[0]
      : never
  : never;
