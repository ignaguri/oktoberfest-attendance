export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string;
          date: string;
          id: number;
          liters: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: number;
          liters?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: number;
          liters?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attendances: {
        Row: {
          beer_count: number;
          created_at: string | null;
          date: string;
          festival_id: string;
          id: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          beer_count?: number;
          created_at?: string | null;
          date: string;
          festival_id: string;
          id?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          beer_count?: number;
          created_at?: string | null;
          date?: string;
          festival_id?: string;
          id?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendances_festival_id_fkey";
            columns: ["festival_id"];
            isOneToOne: false;
            referencedRelation: "festivals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["user_id"];
          },
        ];
      };
      beer_pictures: {
        Row: {
          attendance_id: string;
          created_at: string;
          id: string;
          picture_url: string;
          user_id: string;
        };
        Insert: {
          attendance_id: string;
          created_at?: string;
          id?: string;
          picture_url: string;
          user_id: string;
        };
        Update: {
          attendance_id?: string;
          created_at?: string;
          id?: string;
          picture_url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "beer_pictures_attendance_id_fkey";
            columns: ["attendance_id"];
            isOneToOne: false;
            referencedRelation: "attendances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "beer_pictures_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["user_id"];
          },
        ];
      };
      festival_tent_pricing: {
        Row: {
          beer_price: number;
          created_at: string;
          currency: string;
          festival_id: string;
          id: string;
          price_end_date: string | null;
          price_start_date: string | null;
          tent_id: string;
          updated_at: string;
        };
        Insert: {
          beer_price: number;
          created_at?: string;
          currency?: string;
          festival_id: string;
          id?: string;
          price_end_date?: string | null;
          price_start_date?: string | null;
          tent_id: string;
          updated_at?: string;
        };
        Update: {
          beer_price?: number;
          created_at?: string;
          currency?: string;
          festival_id?: string;
          id?: string;
          price_end_date?: string | null;
          price_start_date?: string | null;
          tent_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "festival_tent_pricing_festival_id_fkey";
            columns: ["festival_id"];
            isOneToOne: false;
            referencedRelation: "festivals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "festival_tent_pricing_tent_id_fkey";
            columns: ["tent_id"];
            isOneToOne: false;
            referencedRelation: "tents";
            referencedColumns: ["id"];
          },
        ];
      };
      festivals: {
        Row: {
          created_at: string;
          description: string | null;
          end_date: string;
          festival_type: Database["public"]["Enums"]["festival_type_enum"];
          id: string;
          is_active: boolean;
          location: string;
          map_url: string | null;
          name: string;
          short_name: string;
          start_date: string;
          status: Database["public"]["Enums"]["festival_status_enum"];
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          end_date: string;
          festival_type: Database["public"]["Enums"]["festival_type_enum"];
          id?: string;
          is_active?: boolean;
          location: string;
          map_url?: string | null;
          name: string;
          short_name: string;
          start_date: string;
          status: Database["public"]["Enums"]["festival_status_enum"];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          end_date?: string;
          festival_type?: Database["public"]["Enums"]["festival_type_enum"];
          id?: string;
          is_active?: boolean;
          location?: string;
          map_url?: string | null;
          name?: string;
          short_name?: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["festival_status_enum"];
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          group_id: string | null;
          id: string;
          joined_at: string | null;
          user_id: string | null;
        };
        Insert: {
          group_id?: string | null;
          id?: string;
          joined_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          group_id?: string | null;
          id?: string;
          joined_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_user_id";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["group_id"];
          },
          {
            foreignKeyName: "group_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["user_id"];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          festival_id: string;
          id: string;
          invite_token: string | null;
          name: string;
          password: string;
          token_expiration: string | null;
          winning_criteria_id: number;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          festival_id: string;
          id?: string;
          invite_token?: string | null;
          name: string;
          password: string;
          token_expiration?: string | null;
          winning_criteria_id: number;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          festival_id?: string;
          id?: string;
          invite_token?: string | null;
          name?: string;
          password?: string;
          token_expiration?: string | null;
          winning_criteria_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "groups_festival_id_fkey";
            columns: ["festival_id"];
            isOneToOne: false;
            referencedRelation: "festivals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "groups_winning_criteria_id_fkey";
            columns: ["winning_criteria_id"];
            isOneToOne: false;
            referencedRelation: "winning_criteria";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          custom_beer_cost: number | null;
          full_name: string | null;
          id: string;
          is_super_admin: boolean | null;
          updated_at: string | null;
          username: string | null;
          website: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          custom_beer_cost?: number | null;
          full_name?: string | null;
          id: string;
          is_super_admin?: boolean | null;
          updated_at?: string | null;
          username?: string | null;
          website?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          custom_beer_cost?: number | null;
          full_name?: string | null;
          id?: string;
          is_super_admin?: boolean | null;
          updated_at?: string | null;
          username?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "leaderboard";
            referencedColumns: ["user_id"];
          },
        ];
      };
      tent_visits: {
        Row: {
          festival_id: string;
          id: string;
          tent_id: string;
          user_id: string;
          visit_date: string | null;
        };
        Insert: {
          festival_id: string;
          id: string;
          tent_id: string;
          user_id: string;
          visit_date?: string | null;
        };
        Update: {
          festival_id?: string;
          id?: string;
          tent_id?: string;
          user_id?: string;
          visit_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tent_visits_festival_id_fkey";
            columns: ["festival_id"];
            isOneToOne: false;
            referencedRelation: "festivals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tent_visits_tent_id_fkey";
            columns: ["tent_id"];
            isOneToOne: false;
            referencedRelation: "tents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tent_visits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tents: {
        Row: {
          category: string | null;
          id: string;
          name: string;
        };
        Insert: {
          category?: string | null;
          id: string;
          name: string;
        };
        Update: {
          category?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      winning_criteria: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      leaderboard: {
        Row: {
          avatar_url: string | null;
          avg_beers: number | null;
          days_attended: number | null;
          festival_id: string | null;
          festival_name: string | null;
          full_name: string | null;
          group_id: string | null;
          group_name: string | null;
          total_beers: number | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "groups_festival_id_fkey";
            columns: ["festival_id"];
            isOneToOne: false;
            referencedRelation: "festivals";
            referencedColumns: ["id"];
          },
        ];
      };
      results: {
        Row: {
          avatar_url: string | null;
          average_liters: number | null;
          email: string | null;
          full_name: string | null;
          total_days: number | null;
          total_liters: number | null;
          username: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      add_beer_picture: {
        Args: {
          p_attendance_id: string;
          p_picture_url: string;
          p_user_id: string;
        };
        Returns: string;
      };
      add_or_update_attendance_with_tents: {
        Args: {
          p_beer_count: number;
          p_date?: string;
          p_festival_id: string;
          p_tent_ids: string[];
          p_user_id: string;
        };
        Returns: string;
      };
      calculate_attendance_cost: {
        Args: { p_attendance_id: string };
        Returns: number;
      };
      create_group_with_member: {
        Args: { p_group_name: string; p_password: string; p_user_id: string };
        Returns: Record<string, unknown>;
      };
      delete_attendance: {
        Args: { p_attendance_id: string };
        Returns: undefined;
      };
      fetch_group_gallery: {
        Args: { p_festival_id?: string; p_group_id: string };
        Returns: {
          date: string;
          user_id: string;
          username: string;
          full_name: string;
          picture_data: Json;
        }[];
      };
      get_global_leaderboard: {
        Args: { p_festival_id?: string; p_winning_criteria_id: number };
        Returns: {
          user_id: string;
          username: string;
          full_name: string;
          avatar_url: string;
          days_attended: number;
          total_beers: number;
          avg_beers: number;
          group_count: number;
        }[];
      };
      get_group_leaderboard: {
        Args: { p_group_id: string; p_winning_criteria_id: number };
        Returns: {
          user_id: string;
          username: string;
          full_name: string;
          avatar_url: string;
          group_id: string;
          group_name: string;
          festival_id: string;
          festival_name: string;
          days_attended: number;
          total_beers: number;
          avg_beers: number;
        }[];
      };
      get_user_festival_stats: {
        Args: { p_festival_id: string; p_user_id: string };
        Returns: {
          total_beers: number;
          days_attended: number;
          avg_beers: number;
          total_spent: number;
          favorite_tent: string;
          most_expensive_day: number;
        }[];
      };
      get_user_festival_stats_with_positions: {
        Args: { p_festival_id: string; p_user_id: string };
        Returns: {
          top_positions: Json;
          total_beers: number;
          days_attended: number;
        }[];
      };
      get_user_groups: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      get_user_stats: {
        Args: { input_user_id: string };
        Returns: {
          top_positions: Json;
          total_beers: number;
          days_attended: number;
        }[];
      };
      is_group_member: {
        Args: { group_id: string; user_id: string };
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      join_group: {
        Args: {
          p_festival_id?: string;
          p_group_name: string;
          p_password: string;
          p_user_id: string;
        };
        Returns: string;
      };
      join_group_with_token: {
        Args: { p_token: string; p_user_id: string };
        Returns: string;
      };
      renew_group_token: {
        Args: { p_group_id: string };
        Returns: string;
      };
    };
    Enums: {
      festival_status_enum: "upcoming" | "active" | "ended";
      festival_type_enum:
        | "oktoberfest"
        | "starkbierfest"
        | "fruehlingsfest"
        | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      festival_status_enum: ["upcoming", "active", "ended"],
      festival_type_enum: [
        "oktoberfest",
        "starkbierfest",
        "fruehlingsfest",
        "other",
      ],
    },
  },
} as const;
