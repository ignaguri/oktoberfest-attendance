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

/* TODO: manually change the type in generated code for function:
          create_group_with_member: {
                  Args: {
                    p_group_name: string
                    p_password: string
                    p_user_id: string
                  }
                  Returns: {
                    group_id: string
                    group_name: string
                  }
                }
      */
