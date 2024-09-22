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
          operationName?: string;
          query?: string;
          variables?: Json;
          extensions?: Json;
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
          id: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          beer_count?: number;
          created_at?: string | null;
          date: string;
          id?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          beer_count?: number;
          created_at?: string | null;
          date?: string;
          id?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "attendances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
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
          {
            foreignKeyName: "beer_pictures_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
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
          {
            foreignKeyName: "group_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          description: string | null;
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
            foreignKeyName: "groups_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
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
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      tent_visits: {
        Row: {
          id: string;
          tent_id: string;
          user_id: string;
          visit_date: string | null;
        };
        Insert: {
          id: string;
          tent_id: string;
          user_id: string;
          visit_date?: string | null;
        };
        Update: {
          id?: string;
          tent_id?: string;
          user_id?: string;
          visit_date?: string | null;
        };
        Relationships: [
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
          full_name: string | null;
          group_id: string | null;
          group_name: string | null;
          total_beers: number | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [];
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
          p_user_id: string;
          p_attendance_id: string;
          p_picture_url: string;
        };
        Returns: string;
      };
      add_or_update_attendance_with_tents: {
        Args: {
          p_user_id: string;
          p_date: string;
          p_beer_count: number;
          p_tent_ids: string[];
        };
        Returns: string;
      };
      create_group_with_member: {
        Args: {
          p_group_name: string;
          p_password: string;
          p_user_id: string;
        };
        Returns: {
          group_id: string;
          group_name: string;
        };
      };
      fetch_group_gallery: {
        Args: {
          p_group_id: string;
        };
        Returns: {
          date: string;
          user_id: string;
          username: string;
          full_name: string;
          picture_data: Json;
        }[];
      };
      get_global_leaderboard: {
        Args: {
          p_winning_criteria_id: number;
        };
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
      get_user_groups: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      get_user_stats: {
        Args: {
          input_user_id: string;
        };
        Returns: {
          top_positions: Json;
          total_beers: number;
          days_attended: number;
        }[];
      };
      is_group_member: {
        Args: {
          group_id: string;
          user_id: string;
        };
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      join_group: {
        Args: {
          p_user_id: string;
          p_group_name: string;
          p_password: string;
        };
        Returns: string;
      };
      join_group_with_token: {
        Args: {
          p_user_id: string;
          p_token: string;
        };
        Returns: string;
      };
      renew_group_token: {
        Args: {
          p_group_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey";
            columns: ["upload_id"];
            isOneToOne: false;
            referencedRelation: "s3_multipart_uploads";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_insert_object: {
        Args: {
          bucketid: string;
          name: string;
          owner: string;
          metadata: Json;
        };
        Returns: undefined;
      };
      extension: {
        Args: {
          name: string;
        };
        Returns: string;
      };
      filename: {
        Args: {
          name: string;
        };
        Returns: string;
      };
      foldername: {
        Args: {
          name: string;
        };
        Returns: string[];
      };
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>;
        Returns: {
          size: number;
          bucket_id: string;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          prefix_param: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
        };
        Returns: {
          key: string;
          id: string;
          created_at: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string;
          prefix_param: string;
          delimiter_param: string;
          max_keys?: number;
          start_after?: string;
          next_token?: string;
        };
        Returns: {
          name: string;
          id: string;
          metadata: Json;
          updated_at: string;
        }[];
      };
      operation: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      search: {
        Args: {
          prefix: string;
          bucketname: string;
          limits?: number;
          levels?: number;
          offsets?: number;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          name: string;
          id: string;
          updated_at: string;
          created_at: string;
          last_accessed_at: string;
          metadata: Json;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;
