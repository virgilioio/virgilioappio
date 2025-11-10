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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      _archived_external_candidate_matches: {
        Row: {
          archived_at: string | null
          candidate_name: string | null
          collected_at: string | null
          created_at: string | null
          current_company: string | null
          current_title: string | null
          email: string | null
          id: string | null
          internal_candidate_id: string | null
          is_collected: boolean | null
          job_id: string | null
          linkedin_url: string | null
          location_city: string | null
          location_country: string | null
          match_score: number | null
          organization_id: string | null
          phone: string | null
          provider: string | null
          provider_id: string | null
          raw_data: Json | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          candidate_name?: string | null
          collected_at?: string | null
          created_at?: string | null
          current_company?: string | null
          current_title?: string | null
          email?: string | null
          id?: string | null
          internal_candidate_id?: string | null
          is_collected?: boolean | null
          job_id?: string | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          match_score?: number | null
          organization_id?: string | null
          phone?: string | null
          provider?: string | null
          provider_id?: string | null
          raw_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          candidate_name?: string | null
          collected_at?: string | null
          created_at?: string | null
          current_company?: string | null
          current_title?: string | null
          email?: string | null
          id?: string | null
          internal_candidate_id?: string | null
          is_collected?: boolean | null
          job_id?: string | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          match_score?: number | null
          organization_id?: string | null
          phone?: string | null
          provider?: string | null
          provider_id?: string | null
          raw_data?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _archived_org_credit_usage: {
        Row: {
          archived_at: string | null
          collect_limit: number | null
          collect_remaining: number | null
          created_at: string | null
          id: string | null
          last_refill_at: string | null
          next_refill_at: string | null
          organization_id: string | null
          search_limit: number | null
          search_remaining: number | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          collect_limit?: number | null
          collect_remaining?: number | null
          created_at?: string | null
          id?: string | null
          last_refill_at?: string | null
          next_refill_at?: string | null
          organization_id?: string | null
          search_limit?: number | null
          search_remaining?: number | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          collect_limit?: number | null
          collect_remaining?: number | null
          created_at?: string | null
          id?: string | null
          last_refill_at?: string | null
          next_refill_at?: string | null
          organization_id?: string | null
          search_limit?: number | null
          search_remaining?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _archived_sourcing_events: {
        Row: {
          archived_at: string | null
          created_at: string | null
          credit_type: string | null
          credits_used: number | null
          error_message: string | null
          event_type: string | null
          id: string | null
          job_id: string | null
          organization_id: string | null
          performed_by: string | null
          provider: string | null
          query_params: Json | null
          results_count: number | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          credit_type?: string | null
          credits_used?: number | null
          error_message?: string | null
          event_type?: string | null
          id?: string | null
          job_id?: string | null
          organization_id?: string | null
          performed_by?: string | null
          provider?: string | null
          query_params?: Json | null
          results_count?: number | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          credit_type?: string | null
          credits_used?: number | null
          error_message?: string | null
          event_type?: string | null
          id?: string | null
          job_id?: string | null
          organization_id?: string | null
          performed_by?: string | null
          provider?: string | null
          query_params?: Json | null
          results_count?: number | null
        }
        Relationships: []
      }
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      application_fields: {
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
          is_core_field: boolean
          is_default: boolean
          is_required: boolean
          max_file_size_mb: number | null
          organization_id: string | null
          placeholder_text: string | null
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
          is_core_field?: boolean
          is_default?: boolean
          is_required?: boolean
          max_file_size_mb?: number | null
          organization_id?: string | null
          placeholder_text?: string | null
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
          is_core_field?: boolean
          is_default?: boolean
          is_required?: boolean
          max_file_size_mb?: number | null
          organization_id?: string | null
          placeholder_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_email_queue: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          job_candidate_association_id: string
          occurrence_number: number | null
          parent_queue_id: string | null
          scheduled_for: string
          sent_at: string | null
          stage_automation_email_id: string
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_candidate_association_id: string
          occurrence_number?: number | null
          parent_queue_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          stage_automation_email_id: string
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_candidate_association_id?: string
          occurrence_number?: number | null
          parent_queue_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          stage_automation_email_id?: string
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_email_queue_job_candidate_association_id_fkey"
            columns: ["job_candidate_association_id"]
            isOneToOne: false
            referencedRelation: "job_candidate_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_email_queue_parent_queue_id_fkey"
            columns: ["parent_queue_id"]
            isOneToOne: false
            referencedRelation: "automation_email_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_email_queue_stage_automation_email_id_fkey"
            columns: ["stage_automation_email_id"]
            isOneToOne: false
            referencedRelation: "stage_automation_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_configurations: {
        Row: {
          available_days: number[] | null
          buffer_time_minutes: number | null
          created_at: string | null
          description: string | null
          display_name: string
          duration_minutes: number
          end_time: string
          id: string
          is_active: boolean | null
          max_days_ahead: number | null
          meeting_location: string | null
          min_notice_hours: number | null
          organization_id: string
          short_code: string
          start_time: string
          timezone: string
          updated_at: string | null
          user_id: string
          weekly_schedule: Json | null
        }
        Insert: {
          available_days?: number[] | null
          buffer_time_minutes?: number | null
          created_at?: string | null
          description?: string | null
          display_name: string
          duration_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          max_days_ahead?: number | null
          meeting_location?: string | null
          min_notice_hours?: number | null
          organization_id: string
          short_code: string
          start_time?: string
          timezone?: string
          updated_at?: string | null
          user_id: string
          weekly_schedule?: Json | null
        }
        Update: {
          available_days?: number[] | null
          buffer_time_minutes?: number | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          duration_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          max_days_ahead?: number | null
          meeting_location?: string | null
          min_notice_hours?: number | null
          organization_id?: string
          short_code?: string
          start_time?: string
          timezone?: string
          updated_at?: string | null
          user_id?: string
          weekly_schedule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_identities: {
        Row: {
          access_token: string
          created_at: string | null
          display_name: string | null
          email_address: string
          encrypted_refresh_token: string
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          last_webhook_renewal: string | null
          organization_id: string
          provider: string
          sync_error_message: string | null
          sync_status: string | null
          token_expires_at: string
          updated_at: string | null
          user_id: string
          webhook_channel_id: string | null
          webhook_expiration: string | null
          webhook_resource_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          display_name?: string | null
          email_address: string
          encrypted_refresh_token: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_webhook_renewal?: string | null
          organization_id: string
          provider: string
          sync_error_message?: string | null
          sync_status?: string | null
          token_expires_at: string
          updated_at?: string | null
          user_id: string
          webhook_channel_id?: string | null
          webhook_expiration?: string | null
          webhook_resource_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          display_name?: string | null
          email_address?: string
          encrypted_refresh_token?: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_webhook_renewal?: string | null
          organization_id?: string
          provider?: string
          sync_error_message?: string | null
          sync_status?: string | null
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
          webhook_channel_id?: string | null
          webhook_expiration?: string | null
          webhook_resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_identities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_application_limits: {
        Row: {
          applied_at: string
          candidate_email: string
          created_at: string
          id: string
          job_id: string
          organization_id: string
          posting_id: string | null
          status: string
          status_updated_at: string | null
          updated_at: string
        }
        Insert: {
          applied_at?: string
          candidate_email: string
          created_at?: string
          id?: string
          job_id: string
          organization_id: string
          posting_id?: string | null
          status?: string
          status_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          applied_at?: string
          candidate_email?: string
          created_at?: string
          id?: string
          job_id?: string
          organization_id?: string
          posting_id?: string | null
          status?: string
          status_updated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      candidate_application_responses: {
        Row: {
          candidate_id: string
          created_at: string
          field_label: string
          field_name: string
          field_type: string
          field_value: string | null
          id: string
          job_id: string
          posting_id: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          field_label: string
          field_name: string
          field_type: string
          field_value?: string | null
          id?: string
          job_id: string
          posting_id: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          field_label?: string
          field_name?: string
          field_type?: string
          field_value?: string | null
          id?: string
          job_id?: string
          posting_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      candidate_attachments: {
        Row: {
          candidate_id: string
          conversion_error: string | null
          conversion_status: string | null
          converted_at: string | null
          converted_pdf_url: string | null
          created_at: string | null
          file_name: string
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          is_resume: boolean
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          candidate_id: string
          conversion_error?: string | null
          conversion_status?: string | null
          converted_at?: string | null
          converted_pdf_url?: string | null
          created_at?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_resume?: boolean
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          candidate_id?: string
          conversion_error?: string | null
          conversion_status?: string | null
          converted_at?: string | null
          converted_pdf_url?: string | null
          created_at?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_resume?: boolean
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_attachments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
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
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_education: {
        Row: {
          candidate_id: string
          created_at: string | null
          degree_type: string | null
          description: string | null
          end_date: string | null
          field_of_study: string | null
          grade: string | null
          id: string
          institution_name: string
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          degree_type?: string | null
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          institution_name: string
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          degree_type?: string | null
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          institution_name?: string
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_education_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_enrichment_logs: {
        Row: {
          candidate_id: string
          created_at: string | null
          credits_used: number | null
          data_found: Json | null
          enrichment_type: string
          error_message: string | null
          id: string
          processed_by: string | null
          status: string
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          credits_used?: number | null
          data_found?: Json | null
          enrichment_type: string
          error_message?: string | null
          id?: string
          processed_by?: string | null
          status: string
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          credits_used?: number | null
          data_found?: Json | null
          enrichment_type?: string
          error_message?: string | null
          id?: string
          processed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_enrichment_logs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
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
        Relationships: []
      }
      candidate_work_experience: {
        Row: {
          candidate_id: string
          company_logo_url: string | null
          company_name: string
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          is_current: boolean | null
          job_title: string
          location: string | null
          skills_used: string[] | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          company_logo_url?: string | null
          company_name: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          job_title: string
          location?: string | null
          skills_used?: string[] | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          company_logo_url?: string | null
          company_name?: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          job_title?: string
          location?: string | null
          skills_used?: string[] | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_work_experience_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          auto_generated_skills: Json | null
          bio: string | null
          candidate_name: string
          company_current: string | null
          contact_emails: string[] | null
          contact_phones: string[] | null
          coresignal_collected_at: string | null
          coresignal_connections_count: number | null
          coresignal_headline: string | null
          coresignal_profile_id: string | null
          coresignal_search_score: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          enriched_at: string | null
          enrichment_status: string | null
          id: string
          last_skills_generation: string | null
          linkedin_url: string | null
          location_city: string | null
          location_country: string | null
          location_state: string | null
          organization_id: string | null
          phone: string | null
          profile_summary: string | null
          resume_generated_url: string | null
          resume_url: string | null
          role_current: string | null
          salary_amount: number | null
          salary_currency: string | null
          salary_period: string | null
          skills: string[] | null
          skills_metadata: Json | null
          social_profiles: Json | null
          source: string | null
          standardized_skills: string[] | null
          status: string | null
          tenant_id: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          auto_generated_skills?: Json | null
          bio?: string | null
          candidate_name: string
          company_current?: string | null
          contact_emails?: string[] | null
          contact_phones?: string[] | null
          coresignal_collected_at?: string | null
          coresignal_connections_count?: number | null
          coresignal_headline?: string | null
          coresignal_profile_id?: string | null
          coresignal_search_score?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          enriched_at?: string | null
          enrichment_status?: string | null
          id?: string
          last_skills_generation?: string | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          organization_id?: string | null
          phone?: string | null
          profile_summary?: string | null
          resume_generated_url?: string | null
          resume_url?: string | null
          role_current?: string | null
          salary_amount?: number | null
          salary_currency?: string | null
          salary_period?: string | null
          skills?: string[] | null
          skills_metadata?: Json | null
          social_profiles?: Json | null
          source?: string | null
          standardized_skills?: string[] | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          auto_generated_skills?: Json | null
          bio?: string | null
          candidate_name?: string
          company_current?: string | null
          contact_emails?: string[] | null
          contact_phones?: string[] | null
          coresignal_collected_at?: string | null
          coresignal_connections_count?: number | null
          coresignal_headline?: string | null
          coresignal_profile_id?: string | null
          coresignal_search_score?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          enriched_at?: string | null
          enrichment_status?: string | null
          id?: string
          last_skills_generation?: string | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          organization_id?: string | null
          phone?: string | null
          profile_summary?: string | null
          resume_generated_url?: string | null
          resume_url?: string | null
          role_current?: string | null
          salary_amount?: number | null
          salary_currency?: string | null
          salary_period?: string | null
          skills?: string[] | null
          skills_metadata?: Json | null
          social_profiles?: Json | null
          source?: string | null
          standardized_skills?: string[] | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coresignal_preview_candidates: {
        Row: {
          company_industry: string | null
          company_url: string | null
          company_website: string | null
          connections_count: number | null
          coresignal_id: string
          coresignal_score: number | null
          country: string | null
          created_at: string | null
          current_company: string | null
          current_title: string | null
          experience_count: number | null
          experience_location: string | null
          follower_count: number | null
          full_name: string
          headline: string | null
          id: string
          industry: string | null
          location: string | null
          match_score: number | null
          profile_url: string | null
          sourcing_project_id: string
        }
        Insert: {
          company_industry?: string | null
          company_url?: string | null
          company_website?: string | null
          connections_count?: number | null
          coresignal_id: string
          coresignal_score?: number | null
          country?: string | null
          created_at?: string | null
          current_company?: string | null
          current_title?: string | null
          experience_count?: number | null
          experience_location?: string | null
          follower_count?: number | null
          full_name: string
          headline?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          match_score?: number | null
          profile_url?: string | null
          sourcing_project_id: string
        }
        Update: {
          company_industry?: string | null
          company_url?: string | null
          company_website?: string | null
          connections_count?: number | null
          coresignal_id?: string
          coresignal_score?: number | null
          country?: string | null
          created_at?: string | null
          current_company?: string | null
          current_title?: string | null
          experience_count?: number | null
          experience_location?: string | null
          follower_count?: number | null
          full_name?: string
          headline?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          match_score?: number | null
          profile_url?: string | null
          sourcing_project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coresignal_preview_candidates_sourcing_project_id_fkey"
            columns: ["sourcing_project_id"]
            isOneToOne: false
            referencedRelation: "sourcing_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coresignal_usage: {
        Row: {
          collect_credits_limit: number
          collect_credits_used: number
          created_at: string | null
          id: string
          last_collect_at: string | null
          last_search_at: string | null
          month: string
          organization_id: string
          search_credits_limit: number
          search_credits_used: number
          updated_at: string | null
        }
        Insert: {
          collect_credits_limit?: number
          collect_credits_used?: number
          created_at?: string | null
          id?: string
          last_collect_at?: string | null
          last_search_at?: string | null
          month: string
          organization_id: string
          search_credits_limit?: number
          search_credits_used?: number
          updated_at?: string | null
        }
        Update: {
          collect_credits_limit?: number
          collect_credits_used?: number
          created_at?: string | null
          id?: string
          last_collect_at?: string | null
          last_search_at?: string | null
          month?: string
          organization_id?: string
          search_credits_limit?: number
          search_credits_used?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coresignal_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          attachments: Json | null
          bcc_addresses: string[] | null
          body_html: string | null
          body_text: string | null
          candidate_id: string | null
          cc_addresses: string[] | null
          clicked_at: string | null
          created_at: string
          direction: string
          error_message: string | null
          from_address: string
          gmail_labels: string[] | null
          headers: Json | null
          id: string
          in_reply_to: string | null
          is_read: boolean | null
          job_id: string | null
          mail_identity_id: string | null
          opened_at: string | null
          organization_id: string
          provider_message_id: string | null
          raw_message_data: Json | null
          received_at: string | null
          replied_at: string | null
          sent_at: string | null
          status: string
          subject: string
          tenant_id: string
          thread_id: string | null
          to_addresses: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          bcc_addresses?: string[] | null
          body_html?: string | null
          body_text?: string | null
          candidate_id?: string | null
          cc_addresses?: string[] | null
          clicked_at?: string | null
          created_at?: string
          direction: string
          error_message?: string | null
          from_address: string
          gmail_labels?: string[] | null
          headers?: Json | null
          id?: string
          in_reply_to?: string | null
          is_read?: boolean | null
          job_id?: string | null
          mail_identity_id?: string | null
          opened_at?: string | null
          organization_id: string
          provider_message_id?: string | null
          raw_message_data?: Json | null
          received_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          tenant_id: string
          thread_id?: string | null
          to_addresses: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          bcc_addresses?: string[] | null
          body_html?: string | null
          body_text?: string | null
          candidate_id?: string | null
          cc_addresses?: string[] | null
          clicked_at?: string | null
          created_at?: string
          direction?: string
          error_message?: string | null
          from_address?: string
          gmail_labels?: string[] | null
          headers?: Json | null
          id?: string
          in_reply_to?: string | null
          is_read?: boolean | null
          job_id?: string | null
          mail_identity_id?: string | null
          opened_at?: string | null
          organization_id?: string
          provider_message_id?: string | null
          raw_message_data?: Json | null
          received_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          thread_id?: string | null
          to_addresses?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_mail_identity_id_fkey"
            columns: ["mail_identity_id"]
            isOneToOne: false
            referencedRelation: "user_mail_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string | null
          source: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string | null
          source?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          source?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string | null
          email: string
          id: string
          invite_expires_at: string
          invite_token: string | null
          invited_by: string | null
          member_role: Database["public"]["Enums"]["member_role"]
          organization_id: string
          updated_at: string | null
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          invite_expires_at?: string
          invite_token?: string | null
          invited_by?: string | null
          member_role: Database["public"]["Enums"]["member_role"]
          organization_id: string
          updated_at?: string | null
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          invite_expires_at?: string
          invite_token?: string | null
          invited_by?: string | null
          member_role?: Database["public"]["Enums"]["member_role"]
          organization_id?: string
          updated_at?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
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
          deleted_at: string | null
          id: string
          job_id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          job_id: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          deleted_at?: string | null
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
      job_candidate_associations: {
        Row: {
          added_by: string | null
          candidate_id: string
          created_at: string
          current_stage_id: string | null
          entered_stage_at: string | null
          id: string
          job_id: string
          notes: string | null
          pipeline_position: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          candidate_id: string
          created_at?: string
          current_stage_id?: string | null
          entered_stage_at?: string | null
          id?: string
          job_id: string
          notes?: string | null
          pipeline_position?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          candidate_id?: string
          created_at?: string
          current_stage_id?: string | null
          entered_stage_at?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          pipeline_position?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_candidate_associations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_candidate_associations_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "job_hiring_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_candidate_associations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_candidate_stage_history: {
        Row: {
          association_id: string
          from_stage_id: string | null
          id: string
          moved_at: string
          moved_by: string
          note: string | null
          to_stage_id: string | null
        }
        Insert: {
          association_id: string
          from_stage_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string
          note?: string | null
          to_stage_id?: string | null
        }
        Update: {
          association_id?: string
          from_stage_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string
          note?: string | null
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_candidate_stage_history_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "job_candidate_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_candidate_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "job_hiring_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_candidate_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "job_hiring_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      job_hiring_stages: {
        Row: {
          created_at: string
          created_by: string | null
          custom_stage_name: string | null
          id: string
          job_id: string
          position: number
          stage_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_stage_name?: string | null
          id?: string
          job_id: string
          position: number
          stage_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_stage_name?: string | null
          id?: string
          job_id?: string
          position?: number
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_hiring_stages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_hiring_stages_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "job_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      job_posting_application_fields: {
        Row: {
          accepted_file_types: string | null
          application_field_id: string | null
          column_span: number
          created_at: string
          display_order: number
          field_label: string
          field_name: string
          field_type: Database["public"]["Enums"]["field_type"]
          help_text: string | null
          id: string
          is_required: boolean
          max_file_size_mb: number | null
          placeholder_text: string | null
          posting_id: string
          source: Database["public"]["Enums"]["application_field_source"]
          updated_at: string
        }
        Insert: {
          accepted_file_types?: string | null
          application_field_id?: string | null
          column_span?: number
          created_at?: string
          display_order?: number
          field_label: string
          field_name: string
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_required?: boolean
          max_file_size_mb?: number | null
          placeholder_text?: string | null
          posting_id: string
          source: Database["public"]["Enums"]["application_field_source"]
          updated_at?: string
        }
        Update: {
          accepted_file_types?: string | null
          application_field_id?: string | null
          column_span?: number
          created_at?: string
          display_order?: number
          field_label?: string
          field_name?: string
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_required?: boolean
          max_file_size_mb?: number | null
          placeholder_text?: string | null
          posting_id?: string
          source?: Database["public"]["Enums"]["application_field_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_posting_application_fields_application_field_id_fkey"
            columns: ["application_field_id"]
            isOneToOne: false
            referencedRelation: "application_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_posting_application_fields_posting_id_fkey"
            columns: ["posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          details: Json
          id: string
          is_active: boolean
          job_id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          details?: Json
          id?: string
          is_active?: boolean
          job_id: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          details?: Json
          id?: string
          is_active?: boolean
          job_id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_stage_scorecards: {
        Row: {
          association_id: string
          candidate_id: string
          created_at: string
          created_by: string
          general_overview: string | null
          id: string
          job_id: string
          rating: Database["public"]["Enums"]["score_rating"]
          stage_instance_id: string
          updated_at: string
        }
        Insert: {
          association_id: string
          candidate_id: string
          created_at?: string
          created_by: string
          general_overview?: string | null
          id?: string
          job_id: string
          rating: Database["public"]["Enums"]["score_rating"]
          stage_instance_id: string
          updated_at?: string
        }
        Update: {
          association_id?: string
          candidate_id?: string
          created_at?: string
          created_by?: string
          general_overview?: string | null
          id?: string
          job_id?: string
          rating?: Database["public"]["Enums"]["score_rating"]
          stage_instance_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_stage_scorecards_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "job_candidate_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stage_scorecards_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stage_scorecards_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stage_scorecards_stage_instance_id_fkey"
            columns: ["stage_instance_id"]
            isOneToOne: false
            referencedRelation: "job_hiring_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      job_stages: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_default: boolean
          organization_id: string | null
          stage_description: string | null
          stage_name: string
          stage_priority: number | null
          stage_type: Database["public"]["Enums"]["stage_type_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          organization_id?: string | null
          stage_description?: string | null
          stage_name: string
          stage_priority?: number | null
          stage_type: Database["public"]["Enums"]["stage_type_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          organization_id?: string | null
          stage_description?: string | null
          stage_name?: string
          stage_priority?: number | null
          stage_type?: Database["public"]["Enums"]["stage_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          auto_generated_skills: Json | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          deleted_at: string | null
          department: string | null
          description: string | null
          hiring_team: Json | null
          id: string
          last_skills_generation: string | null
          level: Database["public"]["Enums"]["job_level"] | null
          location: string | null
          normalization_metadata: Json | null
          organization_id: string
          salary_max: number | null
          salary_min: number | null
          skills: string[] | null
          standardized_location: string | null
          standardized_skills: string[] | null
          standardized_title: string | null
          status: Database["public"]["Enums"]["job_status"]
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          auto_generated_skills?: Json | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          department?: string | null
          description?: string | null
          hiring_team?: Json | null
          id?: string
          last_skills_generation?: string | null
          level?: Database["public"]["Enums"]["job_level"] | null
          location?: string | null
          normalization_metadata?: Json | null
          organization_id: string
          salary_max?: number | null
          salary_min?: number | null
          skills?: string[] | null
          standardized_location?: string | null
          standardized_skills?: string[] | null
          standardized_title?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          auto_generated_skills?: Json | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          department?: string | null
          description?: string | null
          hiring_team?: Json | null
          id?: string
          last_skills_generation?: string | null
          level?: Database["public"]["Enums"]["job_level"] | null
          location?: string | null
          normalization_metadata?: Json | null
          organization_id?: string
          salary_max?: number | null
          salary_min?: number | null
          skills?: string[] | null
          standardized_location?: string | null
          standardized_skills?: string[] | null
          standardized_title?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id?: string
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
          {
            foreignKeyName: "jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      library_enrichment_logs: {
        Row: {
          additions_made: Json | null
          ai_suggestions: Json | null
          candidates_analyzed: number | null
          created_at: string | null
          enrichment_type: string
          extracted_terms: Json
          id: string
          processed_by: string | null
          processing_time_ms: number | null
          rejection_reasons: Json | null
          source_search_id: string | null
          synonyms_added: number | null
          terms_added: number | null
        }
        Insert: {
          additions_made?: Json | null
          ai_suggestions?: Json | null
          candidates_analyzed?: number | null
          created_at?: string | null
          enrichment_type: string
          extracted_terms: Json
          id?: string
          processed_by?: string | null
          processing_time_ms?: number | null
          rejection_reasons?: Json | null
          source_search_id?: string | null
          synonyms_added?: number | null
          terms_added?: number | null
        }
        Update: {
          additions_made?: Json | null
          ai_suggestions?: Json | null
          candidates_analyzed?: number | null
          created_at?: string | null
          enrichment_type?: string
          extracted_terms?: Json
          id?: string
          processed_by?: string | null
          processing_time_ms?: number | null
          rejection_reasons?: Json | null
          source_search_id?: string | null
          synonyms_added?: number | null
          terms_added?: number | null
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string | null
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_email: string | null
          member_role: Database["public"]["Enums"]["member_role"]
          organization_id: string
          tenant_id: string
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
          organization_id: string
          tenant_id: string
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
          organization_id?: string
          tenant_id?: string
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
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
            referencedRelation: "candidates"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          placeholder_text?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_template_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_id: string | null
          billing_poc_additional_email: string | null
          billing_poc_phone: string | null
          billing_poc_updated_at: string | null
          billing_poc_updated_by: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          org_kind: Database["public"]["Enums"]["org_kind_enum"]
          organization_type: string
          owner_assigned_at: string | null
          owner_id: string | null
          parent_organization_id: string | null
          plan_type: string | null
          renewal_date: string | null
          signup_source: string
          status: string
          suspended_at: string | null
          suspended_reason: string | null
          tenant_id: string
          tenant_type: string | null
          trial_end_date: string | null
          updated_at: string
        }
        Insert: {
          billing_id?: string | null
          billing_poc_additional_email?: string | null
          billing_poc_phone?: string | null
          billing_poc_updated_at?: string | null
          billing_poc_updated_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          org_kind?: Database["public"]["Enums"]["org_kind_enum"]
          organization_type?: string
          owner_assigned_at?: string | null
          owner_id?: string | null
          parent_organization_id?: string | null
          plan_type?: string | null
          renewal_date?: string | null
          signup_source?: string
          status?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          tenant_id: string
          tenant_type?: string | null
          trial_end_date?: string | null
          updated_at?: string
        }
        Update: {
          billing_id?: string | null
          billing_poc_additional_email?: string | null
          billing_poc_phone?: string | null
          billing_poc_updated_at?: string | null
          billing_poc_updated_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          org_kind?: Database["public"]["Enums"]["org_kind_enum"]
          organization_type?: string
          owner_assigned_at?: string | null
          owner_id?: string | null
          parent_organization_id?: string | null
          plan_type?: string | null
          renewal_date?: string | null
          signup_source?: string
          status?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          tenant_id?: string
          tenant_type?: string | null
          trial_end_date?: string | null
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
          {
            foreignKeyName: "organizations_parent_fk"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
      platform_feature_flags: {
        Row: {
          description: string | null
          flag_name: string
          is_active: boolean
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          flag_name: string
          is_active?: boolean
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          flag_name?: string
          is_active?: boolean
          updated_at?: string | null
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
      posting_field_select_options: {
        Row: {
          created_at: string
          display_order: number
          id: string
          option_label: string
          option_value: string
          posting_field_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          option_label: string
          option_value: string
          posting_field_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          option_label?: string
          option_value?: string
          posting_field_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posting_field_select_options_posting_field_id_fkey"
            columns: ["posting_field_id"]
            isOneToOne: false
            referencedRelation: "job_posting_application_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      posting_field_validation_rules: {
        Row: {
          created_at: string
          error_message: string
          id: string
          posting_field_id: string
          rule_type: string
          rule_value: string
        }
        Insert: {
          created_at?: string
          error_message: string
          id?: string
          posting_field_id: string
          rule_type: string
          rule_value: string
        }
        Update: {
          created_at?: string
          error_message?: string
          id?: string
          posting_field_id?: string
          rule_type?: string
          rule_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "posting_field_validation_rules_posting_field_id_fkey"
            columns: ["posting_field_id"]
            isOneToOne: false
            referencedRelation: "job_posting_application_fields"
            referencedColumns: ["id"]
          },
        ]
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
      salary_market_data: {
        Row: {
          cached_at: string
          created_at: string
          currency: string
          data_source: string
          experience_level: string | null
          expires_at: string
          id: string
          job_title: string
          location_city: string | null
          location_country: string
          market_competitiveness: string | null
          percentile_25: number | null
          percentile_75: number | null
          percentile_90: number | null
          salary_max: number | null
          salary_median: number | null
          salary_min: number | null
          sample_size: number | null
          updated_at: string
        }
        Insert: {
          cached_at?: string
          created_at?: string
          currency?: string
          data_source?: string
          experience_level?: string | null
          expires_at?: string
          id?: string
          job_title: string
          location_city?: string | null
          location_country: string
          market_competitiveness?: string | null
          percentile_25?: number | null
          percentile_75?: number | null
          percentile_90?: number | null
          salary_max?: number | null
          salary_median?: number | null
          salary_min?: number | null
          sample_size?: number | null
          updated_at?: string
        }
        Update: {
          cached_at?: string
          created_at?: string
          currency?: string
          data_source?: string
          experience_level?: string | null
          expires_at?: string
          id?: string
          job_title?: string
          location_city?: string | null
          location_country?: string
          market_competitiveness?: string | null
          percentile_25?: number | null
          percentile_75?: number | null
          percentile_90?: number | null
          salary_max?: number | null
          salary_median?: number | null
          salary_min?: number | null
          sample_size?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_bookings: {
        Row: {
          booked_by: string | null
          booking_config_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          candidate_confirmation_status: string | null
          candidate_confirmed_at: string | null
          candidate_email: string
          candidate_id: string
          candidate_name: string
          candidate_phone: string | null
          candidate_timezone: string
          created_at: string | null
          duration_minutes: number | null
          google_event_id: string | null
          google_meet_link: string | null
          ics_uid: string | null
          id: string
          interviewer_confirmation_status: string | null
          interviewer_confirmed_at: string | null
          interviewer_id: string
          job_candidate_association_id: string | null
          job_hiring_stage_id: string
          job_id: string | null
          meeting_location: string | null
          meeting_type: string | null
          notes: string | null
          organization_id: string | null
          scheduled_end: string
          scheduled_start: string
          status: string
          updated_at: string | null
        }
        Insert: {
          booked_by?: string | null
          booking_config_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          candidate_confirmation_status?: string | null
          candidate_confirmed_at?: string | null
          candidate_email: string
          candidate_id: string
          candidate_name: string
          candidate_phone?: string | null
          candidate_timezone: string
          created_at?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          google_meet_link?: string | null
          ics_uid?: string | null
          id?: string
          interviewer_confirmation_status?: string | null
          interviewer_confirmed_at?: string | null
          interviewer_id: string
          job_candidate_association_id?: string | null
          job_hiring_stage_id: string
          job_id?: string | null
          meeting_location?: string | null
          meeting_type?: string | null
          notes?: string | null
          organization_id?: string | null
          scheduled_end: string
          scheduled_start: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          booked_by?: string | null
          booking_config_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          candidate_confirmation_status?: string | null
          candidate_confirmed_at?: string | null
          candidate_email?: string
          candidate_id?: string
          candidate_name?: string
          candidate_phone?: string | null
          candidate_timezone?: string
          created_at?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          google_meet_link?: string | null
          ics_uid?: string | null
          id?: string
          interviewer_confirmation_status?: string | null
          interviewer_confirmed_at?: string | null
          interviewer_id?: string
          job_candidate_association_id?: string | null
          job_hiring_stage_id?: string
          job_id?: string | null
          meeting_location?: string | null
          meeting_type?: string | null
          notes?: string | null
          organization_id?: string | null
          scheduled_end?: string
          scheduled_start?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_bookings_booking_config_id_fkey"
            columns: ["booking_config_id"]
            isOneToOne: false
            referencedRelation: "booking_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_bookings_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_bookings_job_candidate_association_id_fkey"
            columns: ["job_candidate_association_id"]
            isOneToOne: false
            referencedRelation: "job_candidate_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_bookings_job_hiring_stage_id_fkey"
            columns: ["job_hiring_stage_id"]
            isOneToOne: false
            referencedRelation: "job_hiring_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_bookings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_projects: {
        Row: {
          coresignal_cache_expires_at: string | null
          coresignal_candidate_count: number | null
          coresignal_last_searched_at: string | null
          coresignal_search_id: string | null
          created_at: string | null
          created_by: string
          description: string | null
          enabled_sources: Json
          id: string
          job_id: string | null
          last_search_at: string | null
          name: string
          organization_id: string
          search_criteria: Json
          status: string
          total_candidates: number | null
          updated_at: string | null
        }
        Insert: {
          coresignal_cache_expires_at?: string | null
          coresignal_candidate_count?: number | null
          coresignal_last_searched_at?: string | null
          coresignal_search_id?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          enabled_sources?: Json
          id?: string
          job_id?: string | null
          last_search_at?: string | null
          name: string
          organization_id: string
          search_criteria?: Json
          status?: string
          total_candidates?: number | null
          updated_at?: string | null
        }
        Update: {
          coresignal_cache_expires_at?: string | null
          coresignal_candidate_count?: number | null
          coresignal_last_searched_at?: string | null
          coresignal_search_id?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          enabled_sources?: Json
          id?: string
          job_id?: string | null
          last_search_at?: string | null
          name?: string
          organization_id?: string
          search_criteria?: Json
          status?: string
          total_candidates?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_projects_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sourcing_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_automation_emails: {
        Row: {
          body: string
          created_at: string
          custom_recipients: string[] | null
          delay_unit: Database["public"]["Enums"]["delay_unit"] | null
          delay_value: number | null
          email_template_id: string | null
          from_email: string
          id: string
          is_recurring: boolean
          max_occurrences: number | null
          recurrence_interval_unit:
            | Database["public"]["Enums"]["delay_unit"]
            | null
          recurrence_interval_value: number | null
          send_to: Database["public"]["Enums"]["email_send_to"]
          sequence_order: number
          stage_automation_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          custom_recipients?: string[] | null
          delay_unit?: Database["public"]["Enums"]["delay_unit"] | null
          delay_value?: number | null
          email_template_id?: string | null
          from_email: string
          id?: string
          is_recurring?: boolean
          max_occurrences?: number | null
          recurrence_interval_unit?:
            | Database["public"]["Enums"]["delay_unit"]
            | null
          recurrence_interval_value?: number | null
          send_to: Database["public"]["Enums"]["email_send_to"]
          sequence_order?: number
          stage_automation_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          custom_recipients?: string[] | null
          delay_unit?: Database["public"]["Enums"]["delay_unit"] | null
          delay_value?: number | null
          email_template_id?: string | null
          from_email?: string
          id?: string
          is_recurring?: boolean
          max_occurrences?: number | null
          recurrence_interval_unit?:
            | Database["public"]["Enums"]["delay_unit"]
            | null
          recurrence_interval_value?: number | null
          send_to?: Database["public"]["Enums"]["email_send_to"]
          sequence_order?: number
          stage_automation_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_automation_emails_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_automation_emails_stage_automation_id_fkey"
            columns: ["stage_automation_id"]
            isOneToOne: false
            referencedRelation: "stage_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_automations: {
        Row: {
          automation_type: Database["public"]["Enums"]["automation_type"]
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          job_hiring_stage_id: string
          trigger_event: Database["public"]["Enums"]["trigger_event_type"]
          updated_at: string
        }
        Insert: {
          automation_type: Database["public"]["Enums"]["automation_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          job_hiring_stage_id: string
          trigger_event: Database["public"]["Enums"]["trigger_event_type"]
          updated_at?: string
        }
        Update: {
          automation_type?: Database["public"]["Enums"]["automation_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          job_hiring_stage_id?: string
          trigger_event?: Database["public"]["Enums"]["trigger_event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_automations_job_hiring_stage_id_fkey"
            columns: ["job_hiring_stage_id"]
            isOneToOne: false
            referencedRelation: "job_hiring_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_interviewer_assignments: {
        Row: {
          assignment_type: string | null
          created_at: string | null
          id: string
          job_hiring_stage_id: string
          member_id: string
          updated_at: string | null
        }
        Insert: {
          assignment_type?: string | null
          created_at?: string | null
          id?: string
          job_hiring_stage_id: string
          member_id: string
          updated_at?: string | null
        }
        Update: {
          assignment_type?: string | null
          created_at?: string | null
          id?: string
          job_hiring_stage_id?: string
          member_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_interviewer_assignments_job_hiring_stage_id_fkey"
            columns: ["job_hiring_stage_id"]
            isOneToOne: false
            referencedRelation: "job_hiring_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_interviewer_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_job_titles: {
        Row: {
          canonical_title: string
          category: string | null
          confidence_score: number | null
          created_at: string | null
          id: string
          last_seen: string | null
          onet_code: string | null
          seniority_level: string | null
          source: string | null
          synonyms: string[] | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          canonical_title: string
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_seen?: string | null
          onet_code?: string | null
          seniority_level?: string | null
          source?: string | null
          synonyms?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          canonical_title?: string
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_seen?: string | null
          onet_code?: string | null
          seniority_level?: string | null
          source?: string | null
          synonyms?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      standard_locations: {
        Row: {
          canonical_name: string
          city: string | null
          confidence_score: number | null
          country_code: string | null
          created_at: string | null
          id: string
          is_remote: boolean | null
          last_seen: string | null
          region: string | null
          source: string | null
          synonyms: string[] | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          canonical_name: string
          city?: string | null
          confidence_score?: number | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_remote?: boolean | null
          last_seen?: string | null
          region?: string | null
          source?: string | null
          synonyms?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          canonical_name?: string
          city?: string | null
          confidence_score?: number | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_remote?: boolean | null
          last_seen?: string | null
          region?: string | null
          source?: string | null
          synonyms?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      standard_skills: {
        Row: {
          canonical_name: string
          category: string | null
          confidence_score: number | null
          created_at: string | null
          esco_code: string | null
          id: string
          last_seen: string | null
          onet_code: string | null
          parent_skill: string | null
          source: string | null
          synonyms: string[] | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          canonical_name: string
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          esco_code?: string | null
          id?: string
          last_seen?: string | null
          onet_code?: string | null
          parent_skill?: string | null
          source?: string | null
          synonyms?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          canonical_name?: string
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          esco_code?: string | null
          id?: string
          last_seen?: string | null
          onet_code?: string | null
          parent_skill?: string | null
          source?: string | null
          synonyms?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      stripe_event_log: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          payload: Json
          processed: boolean
          received_at: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          payload: Json
          processed?: boolean
          received_at?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          payload?: Json
          processed?: boolean
          received_at?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          processed_at: string
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          processed_at?: string
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          processed_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
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
      tenant_metrics_daily: {
        Row: {
          ai_requests: number | null
          candidates_added: number | null
          created_at: string
          date: string
          dau: number | null
          id: string
          jobs_created: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_requests?: number | null
          candidates_added?: number | null
          created_at?: string
          date: string
          dau?: number | null
          id?: string
          jobs_created?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_requests?: number | null
          candidates_added?: number | null
          created_at?: string
          date?: string
          dau?: number | null
          id?: string
          jobs_created?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_metrics_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          billing_interval: string | null
          billing_status: string | null
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_end_at: string | null
          current_period_start: string | null
          dunning_failed_payment_attempts: number | null
          id: string
          last_payment_failed_at: string | null
          last_seat_count: number | null
          seat_quantity: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_status: string | null
          subscription_tier: string | null
          tenant_id: string
          trial_end: string | null
          trial_ends_at: string | null
          trial_source: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          billing_interval?: string | null
          billing_status?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_end_at?: string | null
          current_period_start?: string | null
          dunning_failed_payment_attempts?: number | null
          id?: string
          last_payment_failed_at?: string | null
          last_seat_count?: number | null
          seat_quantity?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          tenant_id: string
          trial_end?: string | null
          trial_ends_at?: string | null
          trial_source?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string | null
          billing_status?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_end_at?: string | null
          current_period_start?: string | null
          dunning_failed_payment_attempts?: number | null
          id?: string
          last_payment_failed_at?: string | null
          last_seat_count?: number | null
          seat_quantity?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          tenant_id?: string
          trial_end?: string | null
          trial_ends_at?: string | null
          trial_source?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          billing_address: string | null
          billing_city: string | null
          billing_contact_name: string | null
          billing_country: string | null
          billing_email: string | null
          billing_phone: string | null
          billing_postal_code: string | null
          billing_state: string | null
          created_at: string
          id: string
          metadata: Json | null
          name: string
          owner_id: string | null
          settings: Json | null
          signup_source: string | null
          status: string
          subscription_plan: string | null
          subscription_renewal_date: string | null
          subscription_status: string | null
          suspended_at: string | null
          suspended_reason: string | null
          tenant_type: string
          trial_end_date: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_city?: string | null
          billing_contact_name?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          owner_id?: string | null
          settings?: Json | null
          signup_source?: string | null
          status?: string
          subscription_plan?: string | null
          subscription_renewal_date?: string | null
          subscription_status?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          tenant_type: string
          trial_end_date?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_city?: string | null
          billing_contact_name?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          owner_id?: string | null
          settings?: Json | null
          signup_source?: string | null
          status?: string
          subscription_plan?: string | null
          subscription_renewal_date?: string | null
          subscription_status?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          tenant_type?: string
          trial_end_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_mail_identities: {
        Row: {
          access_token: string | null
          created_at: string
          display_name: string | null
          email_address: string
          gmail_history_id: string | null
          id: string
          imap_host: string | null
          imap_password_encrypted: string | null
          imap_port: number | null
          imap_username: string | null
          is_active: boolean
          is_default: boolean
          last_sync_at: string | null
          organization_id: string | null
          provider: string
          refresh_token_encrypted: string | null
          smtp_host: string | null
          smtp_password_encrypted: string | null
          smtp_port: number | null
          smtp_username: string | null
          sync_error: string | null
          sync_status: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          display_name?: string | null
          email_address: string
          gmail_history_id?: string | null
          id?: string
          imap_host?: string | null
          imap_password_encrypted?: string | null
          imap_port?: number | null
          imap_username?: string | null
          is_active?: boolean
          is_default?: boolean
          last_sync_at?: string | null
          organization_id?: string | null
          provider: string
          refresh_token_encrypted?: string | null
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          sync_error?: string | null
          sync_status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          display_name?: string | null
          email_address?: string
          gmail_history_id?: string | null
          id?: string
          imap_host?: string | null
          imap_password_encrypted?: string | null
          imap_port?: number | null
          imap_username?: string | null
          is_active?: boolean
          is_default?: boolean
          last_sync_at?: string | null
          organization_id?: string | null
          provider?: string
          refresh_token_encrypted?: string | null
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          sync_error?: string | null
          sync_status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mail_identities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { new_user_id: string; token_input: string }
        Returns: {
          error_message: string
          member_id: string
          member_role: string
          organization_id: string
          success: boolean
          user_type: string
        }[]
      }
      activate_platform_asset: {
        Args: { asset_type_param: string; new_asset_id: string }
        Returns: undefined
      }
      admin_delete_candidate: {
        Args: { p_candidate_id: string }
        Returns: Json
      }
      admin_delete_job: { Args: { p_job_id: string }; Returns: Json }
      admin_manage_member: {
        Args: { p_changes: Json; p_member_id: string }
        Returns: Json
      }
      admin_manage_organization: {
        Args: { p_changes: Json; p_organization_id: string }
        Returns: Json
      }
      admin_restore_record: {
        Args: { record_id: string; table_name: string }
        Returns: Json
      }
      audit_platform_admin_access: {
        Args: never
        Returns: {
          has_member_record: boolean
          issue_description: string
          member_role: string
          organization_id: string
          user_email: string
          user_id: string
          user_type: string
        }[]
      }
      backfill_default_stages_to_all_jobs: { Args: never; Returns: number }
      categorize_skills: {
        Args: { generated_skills: Json; manual_skills: string[] }
        Returns: Json
      }
      check_application_limits: {
        Args: {
          candidate_email_param: string
          job_id_param: string
          organization_id_param: string
        }
        Returns: Json
      }
      check_org_hierarchy_role_access: {
        Args: { _organization_id: string; _required_role: string }
        Returns: boolean
      }
      check_org_member_access: {
        Args: {
          _organization_id: string
          _required_role?: Database["public"]["Enums"]["member_role"]
        }
        Returns: boolean
      }
      check_recursion_safety: { Args: never; Returns: boolean }
      cleanup_expired_invitations: { Args: never; Returns: number }
      cleanup_expired_salary_data: { Args: never; Returns: number }
      debug_user_permissions: {
        Args: never
        Returns: {
          can_see_all_orgs: boolean
          current_user_id: string
          member_count: number
          member_role: string
          organization_id: string
          user_type: string
        }[]
      }
      decrypt_refresh_token: {
        Args: { encrypted_token: string }
        Returns: string
      }
      diagnose_user_auth: {
        Args: { target_user_id?: string }
        Returns: {
          check_name: string
          details: Json
          status: string
        }[]
      }
      duplicate_job_posting: {
        Args: {
          new_description?: string
          new_details?: Json
          new_title?: string
          source_posting_id: string
        }
        Returns: string
      }
      encrypt_refresh_token: { Args: { token: string }; Returns: string }
      execute_candidate_sync: { Args: never; Returns: undefined }
      generate_invite_token: { Args: never; Returns: string }
      get_all_feature_flags: {
        Args: never
        Returns: {
          created_at: string
          description: string
          flag_name: string
          is_active: boolean
          updated_at: string
        }[]
      }
      get_audit_logs: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json
          old_values: Json
          record_id: string
          table_name: string
          user_agent: string
          user_id: string
        }[]
      }
      get_candidate_activities: {
        Args: { p_candidate_id: string; p_job_id?: string }
        Returns: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          description: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          organization_id: string
          title: string
          user_id: string
        }[]
      }
      get_fallback_interviewer_id: {
        Args: { booking_id: string }
        Returns: string
      }
      get_feature_flag: { Args: { flag_name_param: string }; Returns: boolean }
      get_invite_expiry: { Args: never; Returns: string }
      get_member_display_info: {
        Args: { member_user_id: string }
        Returns: {
          email: string
          first_name: string
          last_name: string
        }[]
      }
      get_member_role: { Args: never; Returns: string }
      get_org_hierarchy: {
        Args: { root_org_id: string }
        Returns: {
          id: string
        }[]
      }
      get_pipeline_global_metrics: {
        Args: {
          job_statuses?: string[]
          search_term?: string
          user_ids?: string[]
        }
        Returns: Json
      }
      get_pipeline_job_metrics: {
        Args: { job_ids: string[] }
        Returns: {
          active_candidates: number
          job_id: string
          overall_hired_count: number
          overall_start_count: number
          stages: Json
        }[]
      }
      get_platform_tenant_id: { Args: never; Returns: string }
      get_stage_deletion_impact: {
        Args: { stage_id_param: string }
        Returns: {
          candidates_to_application_review_count: number
          candidates_to_prior_stage_count: number
          jobs_where_stage_is_first_count: number
          total_candidates_affected: number
          total_jobs_affected: number
        }[]
      }
      get_tenant_billable_seat_count: {
        Args: { tenant_id_param: string }
        Returns: number
      }
      get_tenant_id_for_user: { Args: { p_user_id: string }; Returns: string }
      get_user_email: { Args: never; Returns: string }
      get_user_member_data: {
        Args: never
        Returns: {
          member_role: string
          organization_id: string
          user_type: string
        }[]
      }
      get_user_org_hierarchy: {
        Args: never
        Returns: {
          org_id: string
        }[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_tenant_id: { Args: never; Returns: string }
      get_user_type: { Args: never; Returns: string }
      get_user_type_secure: { Args: never; Returns: string }
      increment_term_usage: {
        Args: { table_name: string; term_name: string }
        Returns: undefined
      }
      is_child_organization: { Args: { org_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_trial_expired: { Args: { tenant_id_param: string }; Returns: boolean }
      is_user_assigned_to_job: {
        Args: { job_id_param: string; user_id_param?: string }
        Returns: boolean
      }
      job_has_active_posting: {
        Args: { job_id_param: string }
        Returns: boolean
      }
      log_activity: {
        Args: {
          p_activity_type: Database["public"]["Enums"]["activity_type"]
          p_description?: string
          p_entity_id?: string
          p_entity_type?: string
          p_metadata?: Json
          p_organization_id: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_new_values?: Json
          p_old_values?: Json
          p_record_id?: string
          p_table_name?: string
          p_user_id?: string
        }
        Returns: string
      }
      organization_has_active_public_posting: {
        Args: { org_id_param: string }
        Returns: boolean
      }
      reassign_candidates_for_stage: {
        Args: { stage_id_param: string }
        Returns: undefined
      }
      resequence_posting_fields_for_library_order: {
        Args: { p_posting_id: string }
        Returns: undefined
      }
      resolve_org_context: {
        Args: never
        Returns: {
          organization_id: string
          role: string
          user_type: string
        }[]
      }
      safe_delete_user: {
        Args: { target_user_id: string }
        Returns: {
          affected_tables: Json
          message: string
          success: boolean
        }[]
      }
      should_stop_automation: {
        Args: { p_jca_id: string; p_job_id: string }
        Returns: boolean
      }
      soft_delete_job_stage: {
        Args: { stage_id_param: string }
        Returns: undefined
      }
      soft_delete_record: {
        Args: { record_id: string; table_name: string }
        Returns: Json
      }
      sync_all_postings_field_order: { Args: never; Returns: undefined }
      sync_job_candidates_to_independent: {
        Args: never
        Returns: {
          details: Json
          skipped_count: number
          synced_count: number
        }[]
      }
      test_get_user_organization_id: { Args: never; Returns: string }
      update_feature_flag: {
        Args: { flag_name_param: string; is_active_param: boolean }
        Returns: boolean
      }
      user_has_org_hierarchy_access: {
        Args: { target_org_id: string }
        Returns: boolean
      }
      user_has_tenant_access: {
        Args: { check_tenant_id: string }
        Returns: boolean
      }
      user_is_workspace_owner: { Args: { org_id: string }; Returns: boolean }
      validate_invite_token: {
        Args: { token_input: string }
        Returns: {
          error_message: string
          invite_email: string
          is_valid: boolean
          member_id: string
          member_role: string
          organization_id: string
          organization_name: string
        }[]
      }
      whoami: { Args: never; Returns: string }
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
        | "candidate_created"
        | "candidate_updated"
        | "candidate_assigned_to_job"
        | "candidate_stage_changed"
        | "candidate_status_changed"
        | "candidate_note_added"
        | "candidate_email_sent"
        | "candidate_attachment_uploaded"
        | "candidate_profile_updated"
      application_field_source: "library" | "custom"
      automation_type: "single_email" | "email_sequence"
      contract_status_enum:
        | "active"
        | "pending"
        | "expired"
        | "terminated"
        | "suspended"
      contract_type_enum:
        | "permanent"
        | "temporary"
        | "freelance"
        | "fixed_term"
        | "seasonal"
      contractor_payment_type_enum: "fixed_rate" | "hourly_rate" | "per_project"
      delay_unit: "days" | "weeks"
      email_send_to: "candidate" | "hiring_team" | "interviewers" | "custom"
      employment_duration_enum: "indefinite" | "definite"
      employment_type_enum:
        | "full_time"
        | "part_time"
        | "temporary"
        | "internship"
      field_type:
        | "text"
        | "number"
        | "email"
        | "textarea"
        | "select"
        | "checkbox"
        | "date"
        | "file"
        | "url"
      job_level:
        | "L1 - Specialists"
        | "L2 - Managers"
        | "L3 - Directors / VPs / Executive Search"
        | "L4 - C-Level"
      job_status: "draft" | "open" | "closed" | "archived"
      member_role: "admin" | "recruiter" | "hiring_manager" | "interviewer"
      org_kind_enum: "tenant" | "client" | "department"
      payment_frequency_enum: "bi_monthly" | "monthly" | "custom"
      payment_period_enum:
        | "annual"
        | "monthly"
        | "semimonthly"
        | "biweekly"
        | "weekly"
        | "daily"
        | "hourly"
      queue_status: "pending" | "sent" | "failed" | "cancelled"
      score_rating: "definitely_no" | "no" | "yes" | "strong_yes"
      seniority_level_enum:
        | "entry"
        | "junior"
        | "mid"
        | "senior"
        | "lead"
        | "principal"
        | "director"
        | "vp"
        | "c_level"
      stage_type_enum:
        | "application"
        | "screening"
        | "interview"
        | "assessment"
        | "reference_check"
        | "offer"
        | "onboarding"
        | "custom"
      trigger_event_type: "on_stage_enter" | "on_stage_exit"
      user_type_enum: "platform_admin" | "workspace_owner" | "member" | "guest"
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
        "candidate_created",
        "candidate_updated",
        "candidate_assigned_to_job",
        "candidate_stage_changed",
        "candidate_status_changed",
        "candidate_note_added",
        "candidate_email_sent",
        "candidate_attachment_uploaded",
        "candidate_profile_updated",
      ],
      application_field_source: ["library", "custom"],
      automation_type: ["single_email", "email_sequence"],
      contract_status_enum: [
        "active",
        "pending",
        "expired",
        "terminated",
        "suspended",
      ],
      contract_type_enum: [
        "permanent",
        "temporary",
        "freelance",
        "fixed_term",
        "seasonal",
      ],
      contractor_payment_type_enum: [
        "fixed_rate",
        "hourly_rate",
        "per_project",
      ],
      delay_unit: ["days", "weeks"],
      email_send_to: ["candidate", "hiring_team", "interviewers", "custom"],
      employment_duration_enum: ["indefinite", "definite"],
      employment_type_enum: [
        "full_time",
        "part_time",
        "temporary",
        "internship",
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
        "url",
      ],
      job_level: [
        "L1 - Specialists",
        "L2 - Managers",
        "L3 - Directors / VPs / Executive Search",
        "L4 - C-Level",
      ],
      job_status: ["draft", "open", "closed", "archived"],
      member_role: ["admin", "recruiter", "hiring_manager", "interviewer"],
      org_kind_enum: ["tenant", "client", "department"],
      payment_frequency_enum: ["bi_monthly", "monthly", "custom"],
      payment_period_enum: [
        "annual",
        "monthly",
        "semimonthly",
        "biweekly",
        "weekly",
        "daily",
        "hourly",
      ],
      queue_status: ["pending", "sent", "failed", "cancelled"],
      score_rating: ["definitely_no", "no", "yes", "strong_yes"],
      seniority_level_enum: [
        "entry",
        "junior",
        "mid",
        "senior",
        "lead",
        "principal",
        "director",
        "vp",
        "c_level",
      ],
      stage_type_enum: [
        "application",
        "screening",
        "interview",
        "assessment",
        "reference_check",
        "offer",
        "onboarding",
        "custom",
      ],
      trigger_event_type: ["on_stage_enter", "on_stage_exit"],
      user_type_enum: ["platform_admin", "workspace_owner", "member", "guest"],
    },
  },
} as const
