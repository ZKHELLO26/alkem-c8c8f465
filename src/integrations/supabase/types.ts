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
      dashboard_access: {
        Row: {
          created_at: string
          org_code: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_code?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_code?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      doctors_master: {
        Row: {
          created_at: string
          division: string | null
          doctor_code: string | null
          doctor_name: string
          emp_code: string
          grade: string | null
          hq: string | null
          id: string
          org_code: string
          qualification: string | null
          region: string | null
          speciality: string | null
          subarea: string | null
        }
        Insert: {
          created_at?: string
          division?: string | null
          doctor_code?: string | null
          doctor_name: string
          emp_code: string
          grade?: string | null
          hq?: string | null
          id?: string
          org_code?: string
          qualification?: string | null
          region?: string | null
          speciality?: string | null
          subarea?: string | null
        }
        Update: {
          created_at?: string
          division?: string | null
          doctor_code?: string | null
          doctor_name?: string
          emp_code?: string
          grade?: string | null
          hq?: string | null
          id?: string
          org_code?: string
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
          emp_code: string
          emp_name: string
          hq: string | null
          org_code: string
          region: string | null
          state: string | null
          zone: string | null
        }
        Insert: {
          created_at?: string
          designation?: string | null
          emp_code: string
          emp_name: string
          hq?: string | null
          org_code?: string
          region?: string | null
          state?: string | null
          zone?: string | null
        }
        Update: {
          created_at?: string
          designation?: string | null
          emp_code?: string
          emp_name?: string
          hq?: string | null
          org_code?: string
          region?: string | null
          state?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      field_definitions: {
        Row: {
          active: boolean
          created_at: string
          field_key: string
          id: string
          label: string
          org_code: string | null
          parent_field_key: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          field_key: string
          id?: string
          label: string
          org_code?: string | null
          parent_field_key?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          field_key?: string
          id?: string
          label?: string
          org_code?: string | null
          parent_field_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_definitions_org_code_fkey"
            columns: ["org_code"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["code"]
          },
        ]
      }
      field_options: {
        Row: {
          created_at: string
          extra: Json
          field_definition_id: string
          id: string
          label: string
          parent_value: string | null
          value: string
        }
        Insert: {
          created_at?: string
          extra?: Json
          field_definition_id: string
          id?: string
          label: string
          parent_value?: string | null
          value: string
        }
        Update: {
          created_at?: string
          extra?: Json
          field_definition_id?: string
          id?: string
          label?: string
          parent_value?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_options_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "field_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_field_visibility: {
        Row: {
          key: string
          org_code: string
          product_code: string
          visible: boolean
        }
        Insert: {
          key: string
          org_code: string
          product_code: string
          visible?: boolean
        }
        Update: {
          key?: string
          org_code?: string
          product_code?: string
          visible?: boolean
        }
        Relationships: []
      }
      org_products: {
        Row: {
          created_at: string
          enabled: boolean
          monthly_limit: number
          org_code: string
          product_code: string
          scan_url: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          monthly_limit?: number
          org_code: string
          product_code: string
          scan_url?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          monthly_limit?: number
          org_code?: string
          product_code?: string
          scan_url?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_products_org_code_fkey"
            columns: ["org_code"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "org_products_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "scan_products"
            referencedColumns: ["code"]
          },
        ]
      }
      organizations: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          monthly_scan_limit: number
          name: string
          retention_days: number
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          monthly_scan_limit?: number
          name: string
          retention_days?: number
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          monthly_scan_limit?: number
          name?: string
          retention_days?: number
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      parameter_visibility: {
        Row: {
          hidden: boolean
          id: string
          label: string | null
          org_code: string | null
          param_key: string
          updated_at: string
        }
        Insert: {
          hidden?: boolean
          id?: string
          label?: string | null
          org_code?: string | null
          param_key: string
          updated_at?: string
        }
        Update: {
          hidden?: boolean
          id?: string
          label?: string | null
          org_code?: string | null
          param_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parameter_visibility_org_code_fkey"
            columns: ["org_code"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["code"]
          },
        ]
      }
      scan_links: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          max_scans: number | null
          org_code: string
          product_code: string
          token: string
          used_scans: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          max_scans?: number | null
          org_code: string
          product_code: string
          token: string
          used_scans?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          max_scans?: number | null
          org_code?: string
          product_code?: string
          token?: string
          used_scans?: number
        }
        Relationships: [
          {
            foreignKeyName: "scan_links_org_code_fkey"
            columns: ["org_code"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "scan_links_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "scan_products"
            referencedColumns: ["code"]
          },
        ]
      }
      scan_parameters: {
        Row: {
          category: string | null
          default_visible: boolean
          is_sensitive: boolean
          key: string
          label: string | null
          product_code: string
          unit: string | null
        }
        Insert: {
          category?: string | null
          default_visible?: boolean
          is_sensitive?: boolean
          key: string
          label?: string | null
          product_code: string
          unit?: string | null
        }
        Update: {
          category?: string | null
          default_visible?: boolean
          is_sensitive?: boolean
          key?: string
          label?: string | null
          product_code?: string
          unit?: string | null
        }
        Relationships: []
      }
      scan_products: {
        Row: {
          active: boolean
          category: string | null
          code: string
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          name: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          code: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          name: string
        }
        Update: {
          active?: boolean
          category?: string | null
          code?: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          name?: string
        }
        Relationships: []
      }
      scan_submissions: {
        Row: {
          absi: number | null
          age: number | null
          answer_exercise: string | null
          answer_family_history: string | null
          answer_fried_food: string | null
          answer_sleep: string | null
          app_version: string | null
          blood_volume: number | null
          bmi: number | null
          bmr: number | null
          body_fat_pct: number | null
          body_water_pct: number | null
          bp_dia_high: number | null
          bp_dia_low: number | null
          bp_sys_high: number | null
          bp_sys_low: number | null
          cardiac_output: number | null
          cardiac_workload: number | null
          cardio_risk: string | null
          confidence: string | null
          consent_text_hash: string | null
          consent_version: string
          consented: boolean
          consented_at: string | null
          consented_comms: boolean
          created_at: string
          diabetes_risk: string | null
          doctor_city: string | null
          doctor_code: string | null
          doctor_name: string | null
          doctor_speciality: string | null
          duration_s: number | null
          dyslipidemia_risk: string | null
          employee_code: string | null
          employee_hq: string | null
          employee_name: string | null
          employee_region: string | null
          expression: Json | null
          fps: number | null
          heart_rate: number | null
          heart_utilized: number | null
          height_cm: number | null
          hr_max: number | null
          hrr: number | null
          hrv: number | null
          hypertension_risk: string | null
          id: string
          ideal_weight: number | null
          ip_country: string | null
          lifestyle: Json | null
          lighting_score: number | null
          map_mmhg: number | null
          motion_score: number | null
          obesity_risk: string | null
          org_code: string | null
          org_id: string | null
          over_expiry: boolean
          over_limit: boolean
          pnn50: number | null
          raw_inputs: Json | null
          ref_code: string
          respiration: number | null
          results: Json | null
          rmssd: number | null
          scan_type: string
          sdnn: number | null
          sex: string | null
          signals_bytes: number | null
          signals_path: string | null
          skin_age: number | null
          skin_age_confidence: string | null
          snapshot_path: string | null
          source_mode: string | null
          spo2_high: number | null
          spo2_low: number | null
          stress: number | null
          target_hr_high: number | null
          target_hr_low: number | null
          tdee: number | null
          total_body_water: number | null
          user_agent: string | null
          user_country_code: string | null
          user_email: string | null
          user_id: string | null
          user_mobile: string | null
          user_name: string | null
          vo2_max: number | null
          waist_in: number | null
          weight_kg: number | null
          wellness_score: number | null
        }
        Insert: {
          absi?: number | null
          age?: number | null
          answer_exercise?: string | null
          answer_family_history?: string | null
          answer_fried_food?: string | null
          answer_sleep?: string | null
          app_version?: string | null
          blood_volume?: number | null
          bmi?: number | null
          bmr?: number | null
          body_fat_pct?: number | null
          body_water_pct?: number | null
          bp_dia_high?: number | null
          bp_dia_low?: number | null
          bp_sys_high?: number | null
          bp_sys_low?: number | null
          cardiac_output?: number | null
          cardiac_workload?: number | null
          cardio_risk?: string | null
          confidence?: string | null
          consent_text_hash?: string | null
          consent_version: string
          consented: boolean
          consented_at?: string | null
          consented_comms?: boolean
          created_at?: string
          diabetes_risk?: string | null
          doctor_city?: string | null
          doctor_code?: string | null
          doctor_name?: string | null
          doctor_speciality?: string | null
          duration_s?: number | null
          dyslipidemia_risk?: string | null
          employee_code?: string | null
          employee_hq?: string | null
          employee_name?: string | null
          employee_region?: string | null
          expression?: Json | null
          fps?: number | null
          heart_rate?: number | null
          heart_utilized?: number | null
          height_cm?: number | null
          hr_max?: number | null
          hrr?: number | null
          hrv?: number | null
          hypertension_risk?: string | null
          id?: string
          ideal_weight?: number | null
          ip_country?: string | null
          lifestyle?: Json | null
          lighting_score?: number | null
          map_mmhg?: number | null
          motion_score?: number | null
          obesity_risk?: string | null
          org_code?: string | null
          org_id?: string | null
          over_expiry?: boolean
          over_limit?: boolean
          pnn50?: number | null
          raw_inputs?: Json | null
          ref_code: string
          respiration?: number | null
          results?: Json | null
          rmssd?: number | null
          scan_type?: string
          sdnn?: number | null
          sex?: string | null
          signals_bytes?: number | null
          signals_path?: string | null
          skin_age?: number | null
          skin_age_confidence?: string | null
          snapshot_path?: string | null
          source_mode?: string | null
          spo2_high?: number | null
          spo2_low?: number | null
          stress?: number | null
          target_hr_high?: number | null
          target_hr_low?: number | null
          tdee?: number | null
          total_body_water?: number | null
          user_agent?: string | null
          user_country_code?: string | null
          user_email?: string | null
          user_id?: string | null
          user_mobile?: string | null
          user_name?: string | null
          vo2_max?: number | null
          waist_in?: number | null
          weight_kg?: number | null
          wellness_score?: number | null
        }
        Update: {
          absi?: number | null
          age?: number | null
          answer_exercise?: string | null
          answer_family_history?: string | null
          answer_fried_food?: string | null
          answer_sleep?: string | null
          app_version?: string | null
          blood_volume?: number | null
          bmi?: number | null
          bmr?: number | null
          body_fat_pct?: number | null
          body_water_pct?: number | null
          bp_dia_high?: number | null
          bp_dia_low?: number | null
          bp_sys_high?: number | null
          bp_sys_low?: number | null
          cardiac_output?: number | null
          cardiac_workload?: number | null
          cardio_risk?: string | null
          confidence?: string | null
          consent_text_hash?: string | null
          consent_version?: string
          consented?: boolean
          consented_at?: string | null
          consented_comms?: boolean
          created_at?: string
          diabetes_risk?: string | null
          doctor_city?: string | null
          doctor_code?: string | null
          doctor_name?: string | null
          doctor_speciality?: string | null
          duration_s?: number | null
          dyslipidemia_risk?: string | null
          employee_code?: string | null
          employee_hq?: string | null
          employee_name?: string | null
          employee_region?: string | null
          expression?: Json | null
          fps?: number | null
          heart_rate?: number | null
          heart_utilized?: number | null
          height_cm?: number | null
          hr_max?: number | null
          hrr?: number | null
          hrv?: number | null
          hypertension_risk?: string | null
          id?: string
          ideal_weight?: number | null
          ip_country?: string | null
          lifestyle?: Json | null
          lighting_score?: number | null
          map_mmhg?: number | null
          motion_score?: number | null
          obesity_risk?: string | null
          org_code?: string | null
          org_id?: string | null
          over_expiry?: boolean
          over_limit?: boolean
          pnn50?: number | null
          raw_inputs?: Json | null
          ref_code?: string
          respiration?: number | null
          results?: Json | null
          rmssd?: number | null
          scan_type?: string
          sdnn?: number | null
          sex?: string | null
          signals_bytes?: number | null
          signals_path?: string | null
          skin_age?: number | null
          skin_age_confidence?: string | null
          snapshot_path?: string | null
          source_mode?: string | null
          spo2_high?: number | null
          spo2_low?: number | null
          stress?: number | null
          target_hr_high?: number | null
          target_hr_low?: number | null
          tdee?: number | null
          total_body_water?: number | null
          user_agent?: string | null
          user_country_code?: string | null
          user_email?: string | null
          user_id?: string | null
          user_mobile?: string | null
          user_name?: string | null
          vo2_max?: number | null
          waist_in?: number | null
          weight_kg?: number | null
          wellness_score?: number | null
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
      can_view_org: { Args: { p_org: string }; Returns: boolean }
      current_org_code: { Args: never; Returns: string }
      current_role_name: { Args: never; Returns: string }
      has_dashboard_role: { Args: { _role: string }; Returns: boolean }
      has_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user: string
        }
        Returns: boolean
      }
      is_member_of: { Args: { _org: string }; Returns: boolean }
      is_org_admin_of: { Args: { _org: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      lookup_employee_public: { Args: { p_emp_code: string }; Returns: Json }
      record_public_scan: { Args: { p_payload: Json }; Returns: Json }
      search_doctors_public: {
        Args: { p_emp_code: string; p_query?: string }
        Returns: Json
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
