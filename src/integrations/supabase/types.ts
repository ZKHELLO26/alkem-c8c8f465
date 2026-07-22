export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      doctors_master: {
        Row: {
          created_at: string
          org_code: string
          division: string | null
          doctor_code: string | null
          doctor_name: string
          emp_code: string
          grade: string | null
          hq: string | null
          id: string
          qualification: string | null
          region: string | null
          speciality: string | null
          subarea: string | null
        }
        Insert: {
          created_at?: string
          org_code?: string
          division?: string | null
          doctor_code?: string | null
          doctor_name: string
          emp_code: string
          grade?: string | null
          hq?: string | null
          id?: string
          qualification?: string | null
          region?: string | null
          speciality?: string | null
          subarea?: string | null
        }
        Update: {
          created_at?: string
          org_code?: string
          division?: string | null
          doctor_code?: string | null
          doctor_name?: string
          emp_code?: string
          grade?: string | null
          hq?: string | null
          id?: string
          qualification?: string | null
          region?: string | null
          speciality?: string | null
          subarea?: string | null
        }
        Relationships: []
      }
      employees_master: {
        Row: {
          created_at: string
          designation: string | null
          org_code: string
          emp_code: string
          emp_name: string
          hq: string | null
          region: string | null
          state: string | null
          zone: string | null
        }
        Insert: {
          created_at?: string
          designation?: string | null
          org_code?: string
          emp_code: string
          emp_name: string
          hq?: string | null
          region?: string | null
          state?: string | null
          zone?: string | null
        }
        Update: {
          created_at?: string
          designation?: string | null
          org_code?: string
          emp_code?: string
          emp_name?: string
          hq?: string | null
          region?: string | null
          state?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          retention_days: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          retention_days?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          retention_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      scan_submissions: {
        Row: {
          age: number | null
          app_version: string | null
          confidence: string | null
          consent_text_hash: string | null
          consent_version: string
          consented: boolean
          consented_at: string | null
          consented_comms: boolean
          created_at: string
          duration_s: number | null
          doctor_city: string | null
          doctor_code: string | null
          doctor_name: string | null
          doctor_speciality: string | null
          employee_code: string | null
          employee_hq: string | null
          employee_name: string | null
          employee_region: string | null
          scan_type: string
          expression: Json | null
          fps: number | null
          height_cm: number | null
          id: string
          ip_country: string | null
          lifestyle: Json | null
          lighting_score: number | null
          motion_score: number | null
          org_code: string | null
          org_id: string | null
          raw_inputs: Json | null
          ref_code: string
          results: Json | null
          sex: string | null
          signals_bytes: number | null
          signals_path: string | null
          snapshot_path: string | null
          source_mode: string | null
          user_agent: string | null
          user_id: string | null
          waist_in: number | null
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          app_version?: string | null
          confidence?: string | null
          consent_text_hash?: string | null
          consent_version: string
          consented: boolean
          consented_at?: string | null
          consented_comms?: boolean
          created_at?: string
          duration_s?: number | null
          doctor_city?: string | null
          doctor_code?: string | null
          doctor_name?: string | null
          doctor_speciality?: string | null
          employee_code?: string | null
          employee_hq?: string | null
          employee_name?: string | null
          employee_region?: string | null
          scan_type?: string
          expression?: Json | null
          fps?: number | null
          height_cm?: number | null
          id?: string
          ip_country?: string | null
          lifestyle?: Json | null
          lighting_score?: number | null
          motion_score?: number | null
          org_code?: string | null
          org_id?: string | null
          raw_inputs?: Json | null
          ref_code: string
          results?: Json | null
          sex?: string | null
          signals_bytes?: number | null
          signals_path?: string | null
          snapshot_path?: string | null
          source_mode?: string | null
          user_agent?: string | null
          user_id?: string | null
          waist_in?: number | null
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          app_version?: string | null
          confidence?: string | null
          consent_text_hash?: string | null
          consent_version?: string
          consented?: boolean
          consented_at?: string | null
          consented_comms?: boolean
          created_at?: string
          duration_s?: number | null
          doctor_city?: string | null
          doctor_code?: string | null
          doctor_name?: string | null
          doctor_speciality?: string | null
          employee_code?: string | null
          employee_hq?: string | null
          employee_name?: string | null
          employee_region?: string | null
          scan_type?: string
          expression?: Json | null
          fps?: number | null
          height_cm?: number | null
          id?: string
          ip_country?: string | null
          lifestyle?: Json | null
          lighting_score?: number | null
          motion_score?: number | null
          org_code?: string | null
          org_id?: string | null
          raw_inputs?: Json | null
          ref_code?: string
          results?: Json | null
          sex?: string | null
          signals_bytes?: number | null
          signals_path?: string | null
          snapshot_path?: string | null
          source_mode?: string | null
          user_agent?: string | null
          user_id?: string | null
          waist_in?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_submissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "scan_users"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_users: {
        Row: {
          country_code: string | null
          created_at: string
          email: string | null
          email_norm: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          mobile: string | null
          mobile_norm: string | null
          name: string | null
          scans_count: number
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          email?: string | null
          email_norm?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          mobile?: string | null
          mobile_norm?: string | null
          name?: string | null
          scans_count?: number
        }
        Update: {
          country_code?: string | null
          created_at?: string
          email?: string | null
          email_norm?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          mobile?: string | null
          mobile_norm?: string | null
          name?: string | null
          scans_count?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "viewer"
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
  public: {
    Enums: {
      app_role: ["admin", "viewer"],
    },
  },
} as const
