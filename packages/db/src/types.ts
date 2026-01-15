export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievement_events: {
        Row: {
          achievement_id: string
          created_at: string
          festival_id: string
          group_notified_at: string | null
          id: string
          rarity: Database["public"]["Enums"]["achievement_rarity_enum"]
          user_id: string
          user_notified_at: string | null
        }
        Insert: {
          achievement_id: string
          created_at?: string
          festival_id: string
          group_notified_at?: string | null
          id?: string
          rarity: Database["public"]["Enums"]["achievement_rarity_enum"]
          user_id: string
          user_notified_at?: string | null
        }
        Update: {
          achievement_id?: string
          created_at?: string
          festival_id?: string
          group_notified_at?: string | null
          id?: string
          rarity?: Database["public"]["Enums"]["achievement_rarity_enum"]
          user_id?: string
          user_notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achievement_events_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_events_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "achievement_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          category: Database["public"]["Enums"]["achievement_category_enum"]
          conditions: Json
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          points: number
          rarity: Database["public"]["Enums"]["achievement_rarity_enum"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["achievement_category_enum"]
          conditions?: Json
          created_at?: string
          description: string
          icon: string
          id?: string
          is_active?: boolean
          name: string
          points?: number
          rarity?: Database["public"]["Enums"]["achievement_rarity_enum"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["achievement_category_enum"]
          conditions?: Json
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          points?: number
          rarity?: Database["public"]["Enums"]["achievement_rarity_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      attendances: {
        Row: {
          beer_count: number
          created_at: string | null
          date: string
          festival_id: string
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          beer_count?: number
          created_at?: string | null
          date: string
          festival_id: string
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          beer_count?: number
          created_at?: string | null
          date?: string
          festival_id?: string
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendances_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
        ]
      }
      beer_pictures: {
        Row: {
          attendance_id: string
          created_at: string
          id: string
          picture_url: string
          user_id: string
          visibility: Database["public"]["Enums"]["photo_visibility_enum"]
        }
        Insert: {
          attendance_id: string
          created_at?: string
          id?: string
          picture_url: string
          user_id: string
          visibility?: Database["public"]["Enums"]["photo_visibility_enum"]
        }
        Update: {
          attendance_id?: string
          created_at?: string
          id?: string
          picture_url?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["photo_visibility_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "beer_pictures_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance_with_totals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beer_pictures_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beer_pictures_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "beer_pictures_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consumptions: {
        Row: {
          attendance_id: string
          base_price_cents: number
          created_at: string
          drink_name: string | null
          drink_type: Database["public"]["Enums"]["drink_type"]
          id: string
          idempotency_key: string | null
          price_paid_cents: number
          recorded_at: string
          tent_id: string | null
          tip_cents: number | null
          updated_at: string
          volume_ml: number | null
        }
        Insert: {
          attendance_id: string
          base_price_cents: number
          created_at?: string
          drink_name?: string | null
          drink_type?: Database["public"]["Enums"]["drink_type"]
          id?: string
          idempotency_key?: string | null
          price_paid_cents: number
          recorded_at?: string
          tent_id?: string | null
          tip_cents?: number | null
          updated_at?: string
          volume_ml?: number | null
        }
        Update: {
          attendance_id?: string
          base_price_cents?: number
          created_at?: string
          drink_name?: string | null
          drink_type?: Database["public"]["Enums"]["drink_type"]
          id?: string
          idempotency_key?: string | null
          price_paid_cents?: number
          recorded_at?: string
          tent_id?: string | null
          tip_cents?: number | null
          updated_at?: string
          volume_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consumptions_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance_with_totals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumptions_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumptions_tent_id_fkey"
            columns: ["tent_id"]
            isOneToOne: false
            referencedRelation: "tents"
            referencedColumns: ["id"]
          },
        ]
      }
      drink_type_prices: {
        Row: {
          created_at: string
          drink_type: Database["public"]["Enums"]["drink_type"]
          festival_id: string | null
          festival_tent_id: string | null
          id: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          drink_type: Database["public"]["Enums"]["drink_type"]
          festival_id?: string | null
          festival_tent_id?: string | null
          id?: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          drink_type?: Database["public"]["Enums"]["drink_type"]
          festival_id?: string | null
          festival_tent_id?: string | null
          id?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drink_type_prices_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drink_type_prices_festival_tent_id_fkey"
            columns: ["festival_tent_id"]
            isOneToOne: false
            referencedRelation: "festival_tents"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_tents: {
        Row: {
          beer_price: number | null
          beer_price_cents: number | null
          created_at: string | null
          festival_id: string
          id: string
          tent_id: string
          updated_at: string | null
        }
        Insert: {
          beer_price?: number | null
          beer_price_cents?: number | null
          created_at?: string | null
          festival_id: string
          id?: string
          tent_id: string
          updated_at?: string | null
        }
        Update: {
          beer_price?: number | null
          beer_price_cents?: number | null
          created_at?: string | null
          festival_id?: string
          id?: string
          tent_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_tents_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_tents_tent_id_fkey"
            columns: ["tent_id"]
            isOneToOne: false
            referencedRelation: "tents"
            referencedColumns: ["id"]
          },
        ]
      }
      festivals: {
        Row: {
          beer_cost: number | null
          created_at: string
          default_beer_price_cents: number | null
          description: string | null
          end_date: string
          festival_type: Database["public"]["Enums"]["festival_type_enum"]
          id: string
          is_active: boolean
          location: string
          map_url: string | null
          name: string
          short_name: string
          start_date: string
          status: Database["public"]["Enums"]["festival_status_enum"]
          timezone: string
          updated_at: string
        }
        Insert: {
          beer_cost?: number | null
          created_at?: string
          default_beer_price_cents?: number | null
          description?: string | null
          end_date: string
          festival_type: Database["public"]["Enums"]["festival_type_enum"]
          id?: string
          is_active?: boolean
          location: string
          map_url?: string | null
          name: string
          short_name: string
          start_date: string
          status: Database["public"]["Enums"]["festival_status_enum"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          beer_cost?: number | null
          created_at?: string
          default_beer_price_cents?: number | null
          description?: string | null
          end_date?: string
          festival_type?: Database["public"]["Enums"]["festival_type_enum"]
          id?: string
          is_active?: boolean
          location?: string
          map_url?: string | null
          name?: string
          short_name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["festival_status_enum"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string | null
          id: string
          joined_at: string | null
          user_id: string | null
        }
        Insert: {
          group_id?: string | null
          id?: string
          joined_at?: string | null
          user_id?: string | null
        }
        Update: {
          group_id?: string | null
          id?: string
          joined_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["group_id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          festival_id: string
          id: string
          invite_token: string | null
          name: string
          password: string
          token_expiration: string | null
          winning_criteria_id: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          festival_id: string
          id?: string
          invite_token?: string | null
          name: string
          password: string
          token_expiration?: string | null
          winning_criteria_id: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          festival_id?: string
          id?: string
          invite_token?: string | null
          name?: string
          password?: string
          token_expiration?: string | null
          winning_criteria_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "groups_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_winning_criteria_id_fkey"
            columns: ["winning_criteria_id"]
            isOneToOne: false
            referencedRelation: "winning_criteria"
            referencedColumns: ["id"]
          },
        ]
      }
      location_points: {
        Row: {
          accuracy: number | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          session_id: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          session_id: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_points_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "location_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      location_session_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          session_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_session_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_session_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "location_session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "location_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      location_sessions: {
        Row: {
          created_at: string
          expires_at: string
          festival_id: string
          id: string
          is_active: boolean
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          festival_id: string
          id?: string
          is_active?: boolean
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          festival_id?: string
          id?: string
          is_active?: boolean
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_sessions_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rate_limit: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          notification_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          notification_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          notification_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rate_limit_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rate_limit_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "notification_rate_limit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notification_rate_limit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          is_super_admin: boolean | null
          preferred_language: string | null
          tutorial_completed: boolean | null
          tutorial_completed_at: string | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          is_super_admin?: boolean | null
          preferred_language?: string | null
          tutorial_completed?: boolean | null
          tutorial_completed_at?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          is_super_admin?: boolean | null
          preferred_language?: string | null
          tutorial_completed?: boolean | null
          tutorial_completed_at?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          auto_checkin: boolean
          created_at: string | null
          end_at: string | null
          festival_id: string
          id: string
          note: string | null
          processed_at: string | null
          prompt_sent_at: string | null
          reminder_offset_minutes: number
          reminder_sent_at: string | null
          start_at: string
          status: string
          tent_id: string
          updated_at: string | null
          user_id: string
          visible_to_groups: boolean
        }
        Insert: {
          auto_checkin?: boolean
          created_at?: string | null
          end_at?: string | null
          festival_id: string
          id?: string
          note?: string | null
          processed_at?: string | null
          prompt_sent_at?: string | null
          reminder_offset_minutes?: number
          reminder_sent_at?: string | null
          start_at: string
          status?: string
          tent_id: string
          updated_at?: string | null
          user_id: string
          visible_to_groups?: boolean
        }
        Update: {
          auto_checkin?: boolean
          created_at?: string | null
          end_at?: string | null
          festival_id?: string
          id?: string
          note?: string | null
          processed_at?: string | null
          prompt_sent_at?: string | null
          reminder_offset_minutes?: number
          reminder_sent_at?: string | null
          start_at?: string
          status?: string
          tent_id?: string
          updated_at?: string | null
          user_id?: string
          visible_to_groups?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reservations_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_tent_id_fkey"
            columns: ["tent_id"]
            isOneToOne: false
            referencedRelation: "tents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      tent_visits: {
        Row: {
          festival_id: string
          id: string
          tent_id: string
          user_id: string
          visit_date: string | null
        }
        Insert: {
          festival_id: string
          id: string
          tent_id: string
          user_id: string
          visit_date?: string | null
        }
        Update: {
          festival_id?: string
          id?: string
          tent_id?: string
          user_id?: string
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tent_visits_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tent_visits_tent_id_fkey"
            columns: ["tent_id"]
            isOneToOne: false
            referencedRelation: "tents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tent_visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tent_visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tents: {
        Row: {
          category: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          id: string
          name: string
        }
        Update: {
          category?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          festival_id: string
          id: string
          progress: Json | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          festival_id: string
          id?: string
          progress?: Json | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          festival_id?: string
          id?: string
          progress?: Json | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_photo_settings: {
        Row: {
          created_at: string
          group_id: string
          hide_photos_from_group: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          hide_photos_from_group?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          hide_photos_from_group?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_photo_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_photo_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["group_id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          achievement_notifications_enabled: boolean | null
          checkin_enabled: boolean | null
          created_at: string | null
          group_join_enabled: boolean | null
          group_notifications_enabled: boolean | null
          id: string
          push_enabled: boolean | null
          reminders_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          achievement_notifications_enabled?: boolean | null
          checkin_enabled?: boolean | null
          created_at?: string | null
          group_join_enabled?: boolean | null
          group_notifications_enabled?: boolean | null
          id?: string
          push_enabled?: boolean | null
          reminders_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          achievement_notifications_enabled?: boolean | null
          checkin_enabled?: boolean | null
          created_at?: string | null
          group_join_enabled?: boolean | null
          group_notifications_enabled?: boolean | null
          id?: string
          push_enabled?: boolean | null
          reminders_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_photo_global_settings: {
        Row: {
          created_at: string
          hide_photos_from_all_groups: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hide_photos_from_all_groups?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hide_photos_from_all_groups?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      winning_criteria: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      wrapped_data_cache: {
        Row: {
          created_at: string
          festival_id: string
          generated_by: string
          id: string
          updated_at: string
          user_id: string
          wrapped_data: Json
        }
        Insert: {
          created_at?: string
          festival_id: string
          generated_by?: string
          id?: string
          updated_at?: string
          user_id: string
          wrapped_data: Json
        }
        Update: {
          created_at?: string
          festival_id?: string
          generated_by?: string
          id?: string
          updated_at?: string
          user_id?: string
          wrapped_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "wrapped_data_cache_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrapped_data_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wrapped_data_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      activity_feed: {
        Row: {
          activity_data: Json | null
          activity_time: string | null
          activity_type:
            | Database["public"]["Enums"]["activity_type_enum"]
            | null
          avatar_url: string | null
          festival_id: string | null
          full_name: string | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      attendance_with_totals: {
        Row: {
          avg_price_cents: number | null
          beer_count: number | null
          created_at: string | null
          date: string | null
          drink_count: number | null
          festival_id: string | null
          id: string | null
          total_base_cents: number | null
          total_spent_cents: number | null
          total_tip_cents: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendances_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard: {
        Row: {
          avatar_url: string | null
          avg_beers: number | null
          days_attended: number | null
          full_name: string | null
          group_id: string | null
          group_name: string | null
          total_beers: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      user_festival_spending_stats: {
        Row: {
          avg_spent_per_day_cents: number | null
          avg_tip_per_drink_cents: number | null
          days_attended: number | null
          festival_id: string | null
          total_base_cents: number | null
          total_beers: number | null
          total_drinks: number | null
          total_spent_cents: number | null
          total_tips_cents: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendances_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_festival_stats: {
        Row: {
          avg_beers: number | null
          days_attended: number | null
          festival_id: string | null
          total_base_cents: number | null
          total_beers: number | null
          total_spent_cents: number | null
          total_tips_cents: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendances_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
        ]
      }
      v_user_shared_group_members: {
        Row: {
          festival_id: string | null
          owner_id: string | null
          viewer_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_id"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_user_id"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_user_id"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_id"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_beer_picture: {
        Args: {
          p_attendance_id: string
          p_picture_url: string
          p_user_id: string
          p_visibility?: Database["public"]["Enums"]["photo_visibility_enum"]
        }
        Returns: string
      }
      add_or_update_attendance_with_tents: {
        Args: {
          p_beer_count: number
          p_date: string
          p_festival_id: string
          p_tent_ids: string[]
          p_user_id: string
        }
        Returns: {
          attendance_id: string
          tents_changed: boolean
        }[]
      }
      calculate_achievement_progress: {
        Args: {
          p_achievement_id: string
          p_festival_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      calculate_attendance_cost: {
        Args: { p_attendance_id: string }
        Returns: number
      }
      check_achievement_conditions: {
        Args: {
          p_achievement_id: string
          p_festival_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      check_notification_rate_limit: {
        Args: {
          p_group_id: string
          p_minutes_ago: number
          p_notification_type: string
          p_user_id: string
        }
        Returns: number
      }
      cleanup_old_location_points: { Args: never; Returns: undefined }
      cleanup_old_rate_limit_records: { Args: never; Returns: undefined }
      create_group_with_member: {
        Args: {
          p_festival_id: string
          p_group_name: string
          p_invite_token?: string
          p_password?: string
          p_user_id: string
          p_winning_criteria_id?: number
        }
        Returns: {
          created_at: string
          created_by: string
          festival_id: string
          group_id: string
          group_name: string
          invite_token: string
          winning_criteria_id: number
        }[]
      }
      delete_attendance: {
        Args: { p_attendance_id: string }
        Returns: undefined
      }
      evaluate_achievement_progress: {
        Args: {
          p_achievement_id: string
          p_festival_id: string
          p_user_id: string
        }
        Returns: Json
      }
      evaluate_user_achievements: {
        Args: { p_festival_id: string; p_user_id: string }
        Returns: undefined
      }
      expire_old_location_sessions: { Args: never; Returns: undefined }
      expire_old_locations: { Args: never; Returns: undefined }
      fetch_group_gallery: {
        Args: {
          p_festival_id?: string
          p_group_id: string
          p_viewing_user_id?: string
        }
        Returns: {
          date: string
          full_name: string
          picture_data: Json
          user_id: string
          username: string
        }[]
      }
      get_achievement_leaderboard: {
        Args: { p_festival_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          total_achievements: number
          total_points: number
          user_id: string
          username: string
        }[]
      }
      get_drink_price_cents: {
        Args: {
          p_drink_type?: Database["public"]["Enums"]["drink_type"]
          p_festival_id: string
          p_tent_id?: string
        }
        Returns: number
      }
      get_festival_beer_cost: {
        Args: { p_festival_id: string }
        Returns: number
      }
      get_global_leaderboard: {
        Args: { p_festival_id?: string; p_winning_criteria_id: number }
        Returns: {
          avatar_url: string
          avg_beers: number
          days_attended: number
          full_name: string
          group_count: number
          total_beers: number
          user_id: string
          username: string
        }[]
      }
      get_group_achievement_recipients: {
        Args: { p_festival_ids: string[]; p_user_ids: string[] }
        Returns: {
          festival_id: string
          recipient_ids: string[]
          user_id: string
        }[]
      }
      get_group_leaderboard: {
        Args: { p_group_id: string; p_winning_criteria_id: number }
        Returns: {
          avatar_url: string
          avg_beers: number
          days_attended: number
          festival_id: string
          festival_name: string
          full_name: string
          group_id: string
          group_name: string
          total_beers: number
          user_id: string
          username: string
        }[]
      }
      get_nearby_group_members: {
        Args: {
          input_festival_id: string
          input_user_id: string
          radius_meters?: number
        }
        Returns: {
          avatar_url: string
          distance_meters: number
          full_name: string
          group_names: string[]
          last_updated: string
          latitude: number
          longitude: number
          user_id: string
          username: string
        }[]
      }
      get_user_achievements: {
        Args: { p_festival_id: string; p_user_id: string }
        Returns: {
          achievement_id: string
          category: Database["public"]["Enums"]["achievement_category_enum"]
          current_progress: Json
          description: string
          icon: string
          is_unlocked: boolean
          name: string
          points: number
          rarity: Database["public"]["Enums"]["achievement_rarity_enum"]
          unlocked_at: string
        }[]
      }
      get_user_all_group_photo_settings: {
        Args: { p_user_id: string }
        Returns: {
          group_id: string
          group_name: string
          hide_photos_from_group: boolean
        }[]
      }
      get_user_festival_stats: {
        Args: { p_festival_id: string; p_user_id: string }
        Returns: {
          avg_beers: number
          days_attended: number
          favorite_tent: string
          most_expensive_day: number
          total_beers: number
          total_spent: number
        }[]
      }
      get_user_festival_stats_with_positions: {
        Args: { p_festival_id: string; p_user_id: string }
        Returns: {
          days_attended: number
          top_positions: Json
          total_beers: number
        }[]
      }
      get_user_group_photo_settings: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: {
          group_id: string
          hide_photos_from_group: boolean
          user_id: string
        }[]
      }
      get_user_groups: { Args: never; Returns: string[] }
      get_user_photo_global_settings: {
        Args: { p_user_id: string }
        Returns: {
          hide_photos_from_all_groups: boolean
          user_id: string
        }[]
      }
      get_user_stats: {
        Args: { input_user_id: string }
        Returns: {
          days_attended: number
          top_positions: Json
          total_beers: number
        }[]
      }
      get_wrapped_data: {
        Args: { p_festival_id: string; p_user_id: string }
        Returns: Json
      }
      get_wrapped_data_cached: {
        Args: { p_festival_id: string; p_user_id: string }
        Returns: Json
      }
      invalidate_festival_wrapped_cache: {
        Args: { p_festival_id: string }
        Returns: number
      }
      invalidate_wrapped_cache: {
        Args: { p_festival_id?: string; p_user_id: string }
        Returns: number
      }
      is_group_member: {
        Args: { group_id: string; user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      join_group: {
        Args: {
          p_festival_id?: string
          p_group_name: string
          p_password: string
          p_user_id: string
        }
        Returns: string
      }
      join_group_with_token: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      record_notification_rate_limit: {
        Args: {
          p_group_id: string
          p_notification_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      regenerate_wrapped_data_cache: {
        Args: {
          p_admin_user_id?: string
          p_festival_id?: string
          p_user_id?: string
        }
        Returns: number
      }
      renew_group_token: { Args: { p_group_id: string }; Returns: string }
      rpc_due_reservation_prompts: {
        Args: { p_now: string }
        Returns: {
          festival_id: string
          id: string
          start_at: string
          tent_id: string
          user_id: string
        }[]
      }
      rpc_due_reservation_reminders: {
        Args: { p_now: string }
        Returns: {
          festival_id: string
          id: string
          reminder_offset_minutes: number
          start_at: string
          tent_id: string
          user_id: string
        }[]
      }
      unlock_achievement: {
        Args: {
          p_achievement_id: string
          p_festival_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      update_personal_attendance_with_tents: {
        Args: {
          p_beer_count: number
          p_date: string
          p_festival_id: string
          p_tent_ids: string[]
          p_user_id: string
        }
        Returns: {
          attendance_id: string
          tents_added: string[]
          tents_removed: string[]
        }[]
      }
      update_user_group_photo_settings: {
        Args: {
          p_group_id: string
          p_hide_photos_from_group: boolean
          p_user_id: string
        }
        Returns: undefined
      }
      update_user_photo_global_settings: {
        Args: { p_hide_photos_from_all_groups: boolean; p_user_id: string }
        Returns: undefined
      }
      upsert_attendance_record: {
        Args: {
          p_beer_count: number
          p_date: string
          p_festival_id: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      achievement_category_enum:
        | "consumption"
        | "attendance"
        | "explorer"
        | "social"
        | "competitive"
        | "special"
      achievement_rarity_enum: "common" | "rare" | "epic" | "legendary"
      activity_type_enum:
        | "beer_count_update"
        | "tent_checkin"
        | "photo_upload"
        | "group_join"
        | "achievement_unlock"
      drink_type:
        | "beer"
        | "radler"
        | "alcohol_free"
        | "wine"
        | "soft_drink"
        | "other"
      festival_status_enum: "upcoming" | "active" | "ended"
      festival_type_enum:
        | "oktoberfest"
        | "starkbierfest"
        | "fruehlingsfest"
        | "other"
      location_sharing_status_enum: "active" | "paused" | "expired"
      photo_visibility_enum: "public" | "private"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      achievement_category_enum: [
        "consumption",
        "attendance",
        "explorer",
        "social",
        "competitive",
        "special",
      ],
      achievement_rarity_enum: ["common", "rare", "epic", "legendary"],
      activity_type_enum: [
        "beer_count_update",
        "tent_checkin",
        "photo_upload",
        "group_join",
        "achievement_unlock",
      ],
      drink_type: [
        "beer",
        "radler",
        "alcohol_free",
        "wine",
        "soft_drink",
        "other",
      ],
      festival_status_enum: ["upcoming", "active", "ended"],
      festival_type_enum: [
        "oktoberfest",
        "starkbierfest",
        "fruehlingsfest",
        "other",
      ],
      location_sharing_status_enum: ["active", "paused", "expired"],
      photo_visibility_enum: ["public", "private"],
    },
  },
} as const

