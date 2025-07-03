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
      activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      candidate_attachments: {
        Row: {
          candidate_id: string
          created_at: string | null
          file_name: string
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_attachments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "job_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_comments: {
        Row: {
          author_email: string
          author_id: string
          candidate_id: string
          content: string
          created_at: string | null
          id: string
          job_id: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          author_email?: string
          author_id: string
          candidate_id: string
          content: string
          created_at?: string | null
          id?: string
          job_id: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          author_email?: string
          author_id?: string
          candidate_id?: string
          content?: string
          created_at?: string | null
          id?: string
          job_id?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_comments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "job_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_comments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_exchange_rates"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "candidate_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_candidate_comments_candidate_id"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "job_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_urls: {
        Row: {
          candidate_id: string
          created_at: string | null
          created_by: string | null
          icon_name: string
          id: string
          label: string
          updated_at: string | null
          url: string
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          created_by?: string | null
          icon_name?: string
          id?: string
          label: string
          updated_at?: string | null
          url: string
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          created_by?: string | null
          icon_name?: string
          id?: string
          label?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_urls_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "job_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      country_fields: {
        Row: {
          accepted_file_types: string | null
          country_id: string
          created_at: string
          created_by: string | null
          display_order: number
          field_label: string
          field_name: string
          field_type: Database["public"]["Enums"]["field_type"]
          help_text: string | null
          id: string
          is_required: boolean
          max_file_size_mb: number | null
          placeholder_text: string | null
          updated_at: string
        }
        Insert: {
          accepted_file_types?: string | null
          country_id: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          field_label: string
          field_name: string
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_required?: boolean
          max_file_size_mb?: number | null
          placeholder_text?: string | null
          updated_at?: string
        }
        Update: {
          accepted_file_types?: string | null
          country_id?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          field_label?: string
          field_name?: string
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_required?: boolean
          max_file_size_mb?: number | null
          placeholder_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_fields_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_conversions: {
        Row: {
          conversion_date: string
          converted_amount: number
          converted_currency: string
          created_at: string
          exchange_rate: number
          id: string
          invoice_id: string
          original_amount: number
          original_currency: string
        }
        Insert: {
          conversion_date?: string
          converted_amount: number
          converted_currency: string
          created_at?: string
          exchange_rate: number
          id?: string
          invoice_id: string
          original_amount: number
          original_currency: string
        }
        Update: {
          conversion_date?: string
          converted_amount?: number
          converted_currency?: string
          created_at?: string
          exchange_rate?: number
          id?: string
          invoice_id?: string
          original_amount?: number
          original_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_conversions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          rate: number
          rate_date: string
          target_currency: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          id?: string
          rate: number
          rate_date: string
          target_currency: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          rate?: number
          rate_date?: string
          target_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      exchange_rate_update_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          stats: Json | null
          status: string
          update_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          stats?: Json | null
          status: string
          update_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          stats?: Json | null
          status?: string
          update_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      field_select_options: {
        Row: {
          country_field_id: string
          created_at: string
          display_order: number
          id: string
          offer_template_field_id: string | null
          option_label: string
          option_value: string
        }
        Insert: {
          country_field_id: string
          created_at?: string
          display_order?: number
          id?: string
          offer_template_field_id?: string | null
          option_label: string
          option_value: string
        }
        Update: {
          country_field_id?: string
          created_at?: string
          display_order?: number
          id?: string
          offer_template_field_id?: string | null
          option_label?: string
          option_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_select_options_country_field_id_fkey"
            columns: ["country_field_id"]
            isOneToOne: false
            referencedRelation: "country_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_select_options_offer_template_field_id_fkey"
            columns: ["offer_template_field_id"]
            isOneToOne: false
            referencedRelation: "offer_template_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      field_validation_rules: {
        Row: {
          country_field_id: string
          created_at: string
          error_message: string
          id: string
          offer_template_field_id: string | null
          rule_type: string
          rule_value: string
        }
        Insert: {
          country_field_id: string
          created_at?: string
          error_message: string
          id?: string
          offer_template_field_id?: string | null
          rule_type: string
          rule_value: string
        }
        Update: {
          country_field_id?: string
          created_at?: string
          error_message?: string
          id?: string
          offer_template_field_id?: string | null
          rule_type?: string
          rule_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_validation_rules_country_field_id_fkey"
            columns: ["country_field_id"]
            isOneToOne: false
            referencedRelation: "country_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_validation_rules_offer_template_field_id_fkey"
            columns: ["offer_template_field_id"]
            isOneToOne: false
            referencedRelation: "offer_template_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_id: string
          payment_date: string
          payment_method: string
          payment_notes: string | null
          payment_reference: string | null
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id: string
          payment_date?: string
          payment_method: string
          payment_notes?: string | null
          payment_reference?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string
          payment_date?: string
          payment_method?: string
          payment_notes?: string | null
          payment_reference?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          base_currency_amount: number | null
          conversion_date: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          exchange_rate_used: number | null
          file_name: string | null
          id: string
          invoice_url: string | null
          issued_at: string
          organization_id: string
          paid_at: string | null
          payment_method: string | null
          payment_notes: string | null
          payment_reference: string | null
          remaining_amount: number | null
          status: string
          title: string
          total_paid: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          base_currency_amount?: number | null
          conversion_date?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          exchange_rate_used?: number | null
          file_name?: string | null
          id?: string
          invoice_url?: string | null
          issued_at?: string
          organization_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_reference?: string | null
          remaining_amount?: number | null
          status?: string
          title: string
          total_paid?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          base_currency_amount?: number | null
          conversion_date?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          exchange_rate_used?: number | null
          file_name?: string | null
          id?: string
          invoice_url?: string | null
          issued_at?: string
          organization_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_reference?: string | null
          remaining_amount?: number | null
          status?: string
          title?: string
          total_paid?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_exchange_rates"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          job_id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          job_id: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          job_id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_candidates: {
        Row: {
          added_by: string | null
          candidate_name: string
          created_at: string
          first_viewed_by: Json | null
          id: string
          job_id: string
          linkedin_url: string | null
          location_city: string | null
          location_country: string | null
          location_state: string | null
          notes: string | null
          profile_summary: string | null
          salary_amount: number | null
          salary_currency: string | null
          salary_period: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          candidate_name: string
          created_at?: string
          first_viewed_by?: Json | null
          id?: string
          job_id: string
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          notes?: string | null
          profile_summary?: string | null
          salary_amount?: number | null
          salary_currency?: string | null
          salary_period?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          candidate_name?: string
          created_at?: string
          first_viewed_by?: Json | null
          id?: string
          job_id?: string
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          notes?: string | null
          profile_summary?: string | null
          salary_amount?: number | null
          salary_currency?: string | null
          salary_period?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_request_agreements: {
        Row: {
          agreement_content: string | null
          country_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          updated_at: string
          version: number
        }
        Insert: {
          agreement_content?: string | null
          country_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          agreement_content?: string | null
          country_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_request_agreements_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      job_requests: {
        Row: {
          agreement_id: string | null
          approved_at: string | null
          approved_by: string | null
          approver_role: string | null
          created_at: string
          currency: string | null
          department: string | null
          description: string | null
          id: string
          job_id: string | null
          level: Database["public"]["Enums"]["job_request_level"]
          location: string | null
          notes: string | null
          organization_id: string
          processed_agreement_content: string | null
          salary_max: number | null
          salary_min: number | null
          status: Database["public"]["Enums"]["job_request_status"]
          submitted_by: string
          title: string
          updated_at: string
        }
        Insert: {
          agreement_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approver_role?: string | null
          created_at?: string
          currency?: string | null
          department?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          level: Database["public"]["Enums"]["job_request_level"]
          location?: string | null
          notes?: string | null
          organization_id: string
          processed_agreement_content?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: Database["public"]["Enums"]["job_request_status"]
          submitted_by: string
          title: string
          updated_at?: string
        }
        Update: {
          agreement_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approver_role?: string | null
          created_at?: string
          currency?: string | null
          department?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          level?: Database["public"]["Enums"]["job_request_level"]
          location?: string | null
          notes?: string | null
          organization_id?: string
          processed_agreement_content?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: Database["public"]["Enums"]["job_request_status"]
          submitted_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_requests_approved_by"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_job_requests_submitted_by"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "job_requests_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "job_request_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_exchange_rates"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "job_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
            referencedRelation: "organization_exchange_rates"
            referencedColumns: ["organization_id"]
          },
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
          invite_expires_at: string | null
          invite_token: string | null
          invited_email: string | null
          member_role: Database["public"]["Enums"]["member_role"]
          organization_id: string | null
          updated_at: string | null
          user_id: string | null
          user_status: string
          user_type: Database["public"]["Enums"]["user_type_enum"] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_email?: string | null
          member_role: Database["public"]["Enums"]["member_role"]
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_status?: string
          user_type?: Database["public"]["Enums"]["user_type_enum"] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_email?: string | null
          member_role?: Database["public"]["Enums"]["member_role"]
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_status?: string
          user_type?: Database["public"]["Enums"]["user_type_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_members_user_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_exchange_rates"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_letters: {
        Row: {
          candidate_id: string
          content: string
          created_at: string
          created_by: string | null
          field_values: Json | null
          id: string
          job_id: string
          organization_id: string
          status: string
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          content: string
          created_at?: string
          created_by?: string | null
          field_values?: Json | null
          id?: string
          job_id: string
          organization_id: string
          status?: string
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          field_values?: Json | null
          id?: string
          job_id?: string
          organization_id?: string
          status?: string
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_letters_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "job_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_letters_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_letters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_exchange_rates"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "offer_letters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_letters_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "offer_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_template_fields: {
        Row: {
          accepted_file_types: string | null
          created_at: string
          created_by: string | null
          display_order: number
          field_label: string
          field_name: string
          field_type: Database["public"]["Enums"]["field_type"]
          help_text: string | null
          id: string
          is_required: boolean
          max_file_size_mb: number | null
          placeholder_text: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          accepted_file_types?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          field_label: string
          field_name: string
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_required?: boolean
          max_file_size_mb?: number | null
          placeholder_text?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          accepted_file_types?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          field_label?: string
          field_name?: string
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_required?: boolean
          max_file_size_mb?: number | null
          placeholder_text?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "offer_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_custom_data: {
        Row: {
          country_field_id: string
          created_at: string
          field_value: string | null
          file_name: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          country_field_id: string
          created_at?: string
          field_value?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          country_field_id?: string
          created_at?: string
          field_value?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_custom_data_country_field_id_fkey"
            columns: ["country_field_id"]
            isOneToOne: false
            referencedRelation: "country_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_custom_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_exchange_rates"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_custom_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_poc_additional_email: string | null
          billing_poc_phone: string | null
          billing_poc_updated_at: string | null
          billing_poc_updated_by: string | null
          billing_poc_user_id: string | null
          country: string
          created_at: string
          created_by: string | null
          default_currency: string | null
          id: string
          name: string
          organization_type: string
          owner_assigned_at: string | null
          owner_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          billing_poc_additional_email?: string | null
          billing_poc_phone?: string | null
          billing_poc_updated_at?: string | null
          billing_poc_updated_by?: string | null
          billing_poc_user_id?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          default_currency?: string | null
          id?: string
          name: string
          organization_type?: string
          owner_assigned_at?: string | null
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          billing_poc_additional_email?: string | null
          billing_poc_phone?: string | null
          billing_poc_updated_at?: string | null
          billing_poc_updated_by?: string | null
          billing_poc_user_id?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          default_currency?: string | null
          id?: string
          name?: string
          organization_type?: string
          owner_assigned_at?: string | null
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_organizations_created_by_profiles"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_organizations_owner_profiles"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_assets: {
        Row: {
          asset_type: string
          created_at: string
          file_name: string
          file_url: string
          id: string
          is_active: boolean
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          asset_type: string
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          is_active?: boolean
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          asset_type?: string
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          setting_key: string
          setting_type: string
          setting_value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          setting_key: string
          setting_type?: string
          setting_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          setting_key?: string
          setting_type?: string
          setting_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          last_name: string | null
          linkedin_url: string | null
          organization_id: string | null
          phone: string | null
          timezone: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          organization_id?: string | null
          phone?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          organization_id?: string | null
          phone?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supported_currencies: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      organization_exchange_rates: {
        Row: {
          base_currency: string | null
          organization_id: string | null
          organization_name: string | null
          rate: number | null
          rate_date: string | null
          target_currency: string | null
          target_currency_name: string | null
          target_currency_symbol: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: {
        Args: { token_input: string; new_user_id: string }
        Returns: {
          success: boolean
          error_message: string
          member_id: string
          user_type: string
          member_role: string
          organization_id: string
        }[]
      }
      activate_platform_asset: {
        Args: { new_asset_id: string; asset_type_param: string }
        Returns: undefined
      }
      add_invoice_payment: {
        Args: {
          invoice_id_param: string
          amount_param: number
          currency_param: string
          payment_method_param: string
          payment_reference_param?: string
          payment_notes_param?: string
          payment_date_param?: string
          recorded_by_param?: string
        }
        Returns: undefined
      }
      audit_platform_admin_access: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_email: string
          user_id: string
          has_member_record: boolean
          user_type: string
          member_role: string
          organization_id: string
          issue_description: string
        }[]
      }
      check_recursion_safety: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      cleanup_expired_invitations: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      debug_user_permissions: {
        Args: Record<PropertyKey, never>
        Returns: {
          current_user_id: string
          user_type: string
          member_role: string
          organization_id: string
          member_count: number
          can_see_all_orgs: boolean
        }[]
      }
      execute_automatic_exchange_rate_update: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_invite_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_active_organization_currencies: {
        Args: Record<PropertyKey, never>
        Returns: {
          currency_code: string
          organization_count: number
        }[]
      }
      get_exchange_rate_cron_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          is_enabled: boolean
          next_run: string
          last_automatic_update: string
          last_update_status: string
        }[]
      }
      get_invite_expiry: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_latest_exchange_rate: {
        Args: { from_currency: string; to_currency: string }
        Returns: number
      }
      get_member_display_info: {
        Args: { member_user_id: string }
        Returns: {
          first_name: string
          last_name: string
          email: string
        }[]
      }
      get_member_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_member_role_safe: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_organization_currency_rate: {
        Args: { from_currency: string; to_currency: string; org_id?: string }
        Returns: number
      }
      get_organization_default_currency: {
        Args: { org_id: string }
        Returns: string
      }
      get_user_member_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_type: string
          member_role: string
          organization_id: string
        }[]
      }
      get_user_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_type: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_type_safe: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_type_secure: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_user_assigned_to_job: {
        Args: { job_id_param: string; user_id_param?: string }
        Returns: boolean
      }
      load_invoice_payments: {
        Args: { invoice_id_param: string }
        Returns: {
          id: string
          amount: number
          currency: string
          payment_date: string
          payment_method: string
          payment_reference: string
          payment_notes: string
        }[]
      }
      manage_exchange_rate_cron: {
        Args: { enable_cron: boolean }
        Returns: string
      }
      safe_delete_user: {
        Args: { target_user_id: string }
        Returns: {
          success: boolean
          message: string
          affected_tables: Json
        }[]
      }
      test_get_user_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: {
          test_case: string
          user_email: string
          user_type: string
          returned_org_id: string
          expected_org_id: string
          members_table_org_id: string
          test_result: string
        }[]
      }
      update_invoice_payment_totals: {
        Args: { invoice_id_param: string }
        Returns: undefined
      }
      validate_invite_token: {
        Args: { token_input: string }
        Returns: {
          member_id: string
          organization_id: string
          member_role: string
          organization_name: string
          invite_email: string
          is_valid: boolean
          error_message: string
        }[]
      }
    }
    Enums: {
      activity_type:
        | "job_created"
        | "job_updated"
        | "job_published"
        | "job_archived"
        | "member_invited"
        | "member_joined"
        | "job_request_created"
        | "job_request_approved"
        | "job_request_rejected"
        | "candidate_added"
        | "invoice_created"
        | "invoice_paid"
      field_type:
        | "text"
        | "number"
        | "email"
        | "textarea"
        | "select"
        | "checkbox"
        | "date"
        | "file"
      job_level:
        | "L1 - Specialists"
        | "L2 - Managers"
        | "L3 - Directors / VPs / Executive Search"
        | "L4 - C-Level"
      job_request_level: "L1" | "L2" | "L3"
      job_request_status: "pending" | "approved" | "rejected"
      job_status: "draft" | "open" | "closed" | "archived"
      member_role:
        | "recruiter"
        | "customer_success"
        | "billing"
        | "sales"
        | "admin"
        | "platform_admin"
        | "client"
      user_type_enum: "platform_admin" | "workspace_owner" | "member" | "guest"
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
      activity_type: [
        "job_created",
        "job_updated",
        "job_published",
        "job_archived",
        "member_invited",
        "member_joined",
        "job_request_created",
        "job_request_approved",
        "job_request_rejected",
        "candidate_added",
        "invoice_created",
        "invoice_paid",
      ],
      field_type: [
        "text",
        "number",
        "email",
        "textarea",
        "select",
        "checkbox",
        "date",
        "file",
      ],
      job_level: [
        "L1 - Specialists",
        "L2 - Managers",
        "L3 - Directors / VPs / Executive Search",
        "L4 - C-Level",
      ],
      job_request_level: ["L1", "L2", "L3"],
      job_request_status: ["pending", "approved", "rejected"],
      job_status: ["draft", "open", "closed", "archived"],
      member_role: [
        "recruiter",
        "customer_success",
        "billing",
        "sales",
        "admin",
        "platform_admin",
        "client",
      ],
      user_type_enum: ["platform_admin", "workspace_owner", "member", "guest"],
    },
  },
} as const
