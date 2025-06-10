export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      jobs: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          department: string | null
          description: string | null
          hiring_team: Json | null
          id: string
          level: Database["public"]["Enums"]["job_level"]
          location: string | null
          organization_id: string
          salary_max: number | null
          salary_min: number | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          department?: string | null
          description?: string | null
          hiring_team?: Json | null
          id?: string
          level: Database["public"]["Enums"]["job_level"]
          location?: string | null
          organization_id: string
          salary_max?: number | null
          salary_min?: number | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          department?: string | null
          description?: string | null
          hiring_team?: Json | null
          id?: string
          level?: Database["public"]["Enums"]["job_level"]
          location?: string | null
          organization_id?: string
          salary_max?: number | null
          salary_min?: number | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string | null
          id: string
          member_role: Database["public"]["Enums"]["member_role"]
          organization_id: string | null
          updated_at: string | null
          user_id: string | null
          user_status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_role: Database["public"]["Enums"]["member_role"]
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          member_role?: Database["public"]["Enums"]["member_role"]
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string
          created_at: string
          id: string
          name: string
          owner_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_type: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      job_level:
        | "L1 - Specialists"
        | "L2 - Managers"
        | "L3 - Directors / VPs / Executive Search"
        | "L4 - C-Level"
      job_status: "draft" | "open" | "closed" | "archived"
      member_role:
        | "recruiter"
        | "customer_success"
        | "billing"
        | "sales"
        | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      job_level: [
        "L1 - Specialists",
        "L2 - Managers",
        "L3 - Directors / VPs / Executive Search",
        "L4 - C-Level",
      ],
      job_status: ["draft", "open", "closed", "archived"],
      member_role: [
        "recruiter",
        "customer_success",
        "billing",
        "sales",
        "admin",
      ],
    },
  },
} as const
