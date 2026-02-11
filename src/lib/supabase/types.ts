// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
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
    PostgrestVersion: '14.1'
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          file_ext: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          organization_id: string
          storage_bucket: string
          storage_path: string
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_ext: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          organization_id: string
          storage_bucket?: string
          storage_path: string
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_ext?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          organization_id?: string
          storage_bucket?: string
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'attachments_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attachments_ticket_id_fkey'
            columns: ['ticket_id']
            isOneToOne: false
            referencedRelation: 'tickets'
            referencedColumns: ['id']
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          integration_type: string
          organization_id: string
          request_data: Json | null
          response_data: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          integration_type: string
          organization_id: string
          request_data?: Json | null
          response_data?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          integration_type?: string
          organization_id?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'integration_logs_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      integrations_config: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean | null
          organization_id: string
          provider: string
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          organization_id: string
          provider: string
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          organization_id?: string
          provider?: string
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'integrations_config_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      kb_article_versions: {
        Row: {
          article_id: string
          change_summary: string | null
          content: string | null
          created_at: string
          editor_id: string
          excerpt: string | null
          id: string
          tags: string[] | null
          title: string
        }
        Insert: {
          article_id: string
          change_summary?: string | null
          content?: string | null
          created_at?: string
          editor_id: string
          excerpt?: string | null
          id?: string
          tags?: string[] | null
          title: string
        }
        Update: {
          article_id?: string
          change_summary?: string | null
          content?: string | null
          created_at?: string
          editor_id?: string
          excerpt?: string | null
          id?: string
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'kb_article_versions_article_id_fkey'
            columns: ['article_id']
            isOneToOne: false
            referencedRelation: 'kb_articles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'kb_article_versions_article_id_fkey'
            columns: ['article_id']
            isOneToOne: false
            referencedRelation: 'kb_articles_with_stats'
            referencedColumns: ['id']
          },
        ]
      }
      kb_articles: {
        Row: {
          author_id: string
          category_id: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          helpful_count: number | null
          id: string
          not_helpful_count: number | null
          organization_id: string
          published_at: string | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          views_count: number | null
        }
        Insert: {
          author_id: string
          category_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          helpful_count?: number | null
          id?: string
          not_helpful_count?: number | null
          organization_id: string
          published_at?: string | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          author_id?: string
          category_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          helpful_count?: number | null
          id?: string
          not_helpful_count?: number | null
          organization_id?: string
          published_at?: string | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'kb_articles_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'kb_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'kb_articles_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      kb_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'kb_categories_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'kb_categories_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'kb_categories'
            referencedColumns: ['id']
          },
        ]
      }
      kb_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_publish: boolean
          can_view: boolean
          created_at: string
          id: string
          organization_id: string
          role: string
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_publish?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          organization_id: string
          role: string
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_publish?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'kb_permissions_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database['public']['Enums']['user_role']
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database['public']['Enums']['user_role']
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database['public']['Enums']['user_role']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      notification_templates: {
        Row: {
          body_template: string
          channel: string
          created_at: string | null
          event_type: string
          footer: string | null
          header: string | null
          id: string
          name: string
          organization_id: string
          subject_template: string | null
          updated_at: string | null
        }
        Insert: {
          body_template: string
          channel: string
          created_at?: string | null
          event_type: string
          footer?: string | null
          header?: string | null
          id?: string
          name: string
          organization_id: string
          subject_template?: string | null
          updated_at?: string | null
        }
        Update: {
          body_template?: string
          channel?: string
          created_at?: string | null
          event_type?: string
          footer?: string | null
          header?: string | null
          id?: string
          name?: string
          organization_id?: string
          subject_template?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'notification_templates_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: Database['public']['Enums']['notification_channel']
          created_at: string
          error_message: string | null
          event_type: Database['public']['Enums']['notification_event_type']
          expires_at: string
          external_id: string | null
          failed_at: string | null
          id: string
          max_retries: number
          metadata: Json
          organization_id: string
          recipient_email: string | null
          recipient_id: string | null
          recipient_phone: string | null
          retry_count: number
          sent_at: string | null
          status: Database['public']['Enums']['notification_status']
          subject: string
          template_data: Json | null
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel: Database['public']['Enums']['notification_channel']
          created_at?: string
          error_message?: string | null
          event_type: Database['public']['Enums']['notification_event_type']
          expires_at?: string
          external_id?: string | null
          failed_at?: string | null
          id?: string
          max_retries?: number
          metadata?: Json
          organization_id: string
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database['public']['Enums']['notification_status']
          subject: string
          template_data?: Json | null
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: Database['public']['Enums']['notification_channel']
          created_at?: string
          error_message?: string | null
          event_type?: Database['public']['Enums']['notification_event_type']
          expires_at?: string
          external_id?: string | null
          failed_at?: string | null
          id?: string
          max_retries?: number
          metadata?: Json
          organization_id?: string
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database['public']['Enums']['notification_status']
          subject?: string
          template_data?: Json | null
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_ticket_id_fkey'
            columns: ['ticket_id']
            isOneToOne: false
            referencedRelation: 'tickets'
            referencedColumns: ['id']
          },
        ]
      }
      notifications_archive: {
        Row: {
          body: string
          channel: Database['public']['Enums']['notification_channel']
          created_at: string
          error_message: string | null
          event_type: Database['public']['Enums']['notification_event_type']
          expires_at: string
          external_id: string | null
          failed_at: string | null
          id: string
          max_retries: number
          metadata: Json
          organization_id: string
          recipient_email: string | null
          recipient_id: string
          recipient_phone: string | null
          retry_count: number
          sent_at: string | null
          status: Database['public']['Enums']['notification_status']
          subject: string
          template_data: Json | null
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel: Database['public']['Enums']['notification_channel']
          created_at?: string
          error_message?: string | null
          event_type: Database['public']['Enums']['notification_event_type']
          expires_at?: string
          external_id?: string | null
          failed_at?: string | null
          id?: string
          max_retries?: number
          metadata?: Json
          organization_id: string
          recipient_email?: string | null
          recipient_id: string
          recipient_phone?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database['public']['Enums']['notification_status']
          subject: string
          template_data?: Json | null
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: Database['public']['Enums']['notification_channel']
          created_at?: string
          error_message?: string | null
          event_type?: Database['public']['Enums']['notification_event_type']
          expires_at?: string
          external_id?: string | null
          failed_at?: string | null
          id?: string
          max_retries?: number
          metadata?: Json
          organization_id?: string
          recipient_email?: string | null
          recipient_id?: string
          recipient_phone?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database['public']['Enums']['notification_status']
          subject?: string
          template_data?: Json | null
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      organization_notification_settings: {
        Row: {
          created_at: string
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_enabled: boolean
          evolution_instance_name: string | null
          fallback_to_resend: boolean
          id: string
          last_tested_at: string | null
          logo_url: string | null
          organization_id: string
          resend_api_key: string | null
          resend_enabled: boolean
          resend_from_email: string | null
          resend_from_name: string | null
          sms_api_key: string | null
          sms_enabled: boolean
          sms_from_number: string | null
          sms_provider: string | null
          smtp_enabled: boolean
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user: string | null
          test_mode: boolean
          updated_at: string
          whatsapp_cloud_access_token: string | null
          whatsapp_cloud_enabled: boolean
          whatsapp_cloud_phone_number_id: string | null
          whatsapp_cloud_waba_id: string | null
        }
        Insert: {
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_enabled?: boolean
          evolution_instance_name?: string | null
          fallback_to_resend?: boolean
          id?: string
          last_tested_at?: string | null
          logo_url?: string | null
          organization_id: string
          resend_api_key?: string | null
          resend_enabled?: boolean
          resend_from_email?: string | null
          resend_from_name?: string | null
          sms_api_key?: string | null
          sms_enabled?: boolean
          sms_from_number?: string | null
          sms_provider?: string | null
          smtp_enabled?: boolean
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          test_mode?: boolean
          updated_at?: string
          whatsapp_cloud_access_token?: string | null
          whatsapp_cloud_enabled?: boolean
          whatsapp_cloud_phone_number_id?: string | null
          whatsapp_cloud_waba_id?: string | null
        }
        Update: {
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_enabled?: boolean
          evolution_instance_name?: string | null
          fallback_to_resend?: boolean
          id?: string
          last_tested_at?: string | null
          logo_url?: string | null
          organization_id?: string
          resend_api_key?: string | null
          resend_enabled?: boolean
          resend_from_email?: string | null
          resend_from_name?: string | null
          sms_api_key?: string | null
          sms_enabled?: boolean
          sms_from_number?: string | null
          sms_provider?: string | null
          smtp_enabled?: boolean
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          test_mode?: boolean
          updated_at?: string
          whatsapp_cloud_access_token?: string | null
          whatsapp_cloud_enabled?: boolean
          whatsapp_cloud_phone_number_id?: string | null
          whatsapp_cloud_waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'organization_notification_settings_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      organization_settings: {
        Row: {
          allowed_extensions: string[]
          max_attachment_bytes: number
          organization_id: string
          storage_bucket: string
          updated_at: string
        }
        Insert: {
          allowed_extensions?: string[]
          max_attachment_bytes?: number
          organization_id: string
          storage_bucket?: string
          updated_at?: string
        }
        Update: {
          allowed_extensions?: string[]
          max_attachment_bytes?: number
          organization_id?: string
          storage_bucket?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'organization_settings_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          channels: string[]
          created_at: string
          created_by: string | null
          frequency_days: number
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          metrics: string[]
          name: string
          organization_id: string
          recipient_emails: string[] | null
          recipient_phones: string[] | null
          updated_at: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          created_by?: string | null
          frequency_days?: number
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          metrics?: string[]
          name: string
          organization_id: string
          recipient_emails?: string[] | null
          recipient_phones?: string[] | null
          updated_at?: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          created_by?: string | null
          frequency_days?: number
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          metrics?: string[]
          name?: string
          organization_id?: string
          recipient_emails?: string[] | null
          recipient_phones?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'report_templates_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      ticket_categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          sla_hours: number
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          sla_hours?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          sla_hours?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ticket_categories_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      ticket_timeline: {
        Row: {
          content: string
          created_at: string
          entry_type: Database['public']['Enums']['timeline_entry_type']
          id: string
          is_internal: boolean
          metadata: Json
          organization_id: string
          sender_id: string | null
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          entry_type?: Database['public']['Enums']['timeline_entry_type']
          id?: string
          is_internal?: boolean
          metadata?: Json
          organization_id: string
          sender_id?: string | null
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entry_type?: Database['public']['Enums']['timeline_entry_type']
          id?: string
          is_internal?: boolean
          metadata?: Json
          organization_id?: string
          sender_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ticket_timeline_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ticket_timeline_ticket_id_fkey'
            columns: ['ticket_id']
            isOneToOne: false
            referencedRelation: 'tickets'
            referencedColumns: ['id']
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_cost: number | null
          id: string
          organization_id: string
          priority: Database['public']['Enums']['ticket_priority']
          requester_id: string
          satisfaction_comment: string | null
          satisfaction_score: number | null
          sla_breach_sent_at: string | null
          sla_warning_sent_at: string | null
          status: Database['public']['Enums']['ticket_status']
          tags: string[] | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          id?: string
          organization_id: string
          priority?: Database['public']['Enums']['ticket_priority']
          requester_id: string
          satisfaction_comment?: string | null
          satisfaction_score?: number | null
          sla_breach_sent_at?: string | null
          sla_warning_sent_at?: string | null
          status?: Database['public']['Enums']['ticket_status']
          tags?: string[] | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          id?: string
          organization_id?: string
          priority?: Database['public']['Enums']['ticket_priority']
          requester_id?: string
          satisfaction_comment?: string | null
          satisfaction_score?: number | null
          sla_breach_sent_at?: string | null
          sla_warning_sent_at?: string | null
          status?: Database['public']['Enums']['ticket_status']
          tags?: string[] | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tickets_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'ticket_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tickets_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      user_dashboard_preferences: {
        Row: {
          updated_at: string
          user_id: string
          visible_widgets: string[]
        }
        Insert: {
          updated_at?: string
          user_id: string
          visible_widgets?: string[]
        }
        Update: {
          updated_at?: string
          user_id?: string
          visible_widgets?: string[]
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string
          digest_frequency: string | null
          digest_mode: boolean
          email_address: string | null
          email_enabled: boolean
          id: string
          notify_on_mention: boolean
          notify_on_new_attachment: boolean
          notify_on_new_message: boolean
          notify_on_ticket_assigned: boolean
          notify_on_ticket_closed: boolean
          notify_on_ticket_created: boolean
          notify_on_ticket_updated: boolean
          organization_id: string
          phone_number: string | null
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sms_enabled: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          digest_frequency?: string | null
          digest_mode?: boolean
          email_address?: string | null
          email_enabled?: boolean
          id?: string
          notify_on_mention?: boolean
          notify_on_new_attachment?: boolean
          notify_on_new_message?: boolean
          notify_on_ticket_assigned?: boolean
          notify_on_ticket_closed?: boolean
          notify_on_ticket_created?: boolean
          notify_on_ticket_updated?: boolean
          organization_id: string
          phone_number?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          digest_frequency?: string | null
          digest_mode?: boolean
          email_address?: string | null
          email_enabled?: boolean
          id?: string
          notify_on_mention?: boolean
          notify_on_new_attachment?: boolean
          notify_on_new_message?: boolean
          notify_on_ticket_assigned?: boolean
          notify_on_ticket_closed?: boolean
          notify_on_ticket_created?: boolean
          notify_on_ticket_updated?: boolean
          organization_id?: string
          phone_number?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'user_notification_preferences_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      workflows: {
        Row: {
          actions: Json | null
          conditions: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workflows_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      kb_articles_with_stats: {
        Row: {
          author_email: string | null
          author_id: string | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          content: string | null
          created_at: string | null
          excerpt: string | null
          helpful_count: number | null
          helpful_percentage: number | null
          id: string | null
          not_helpful_count: number | null
          organization_id: string | null
          published_at: string | null
          slug: string | null
          status: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          version_count: number | null
          views_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'kb_articles_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'kb_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'kb_articles_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      notification_logs_view: {
        Row: {
          body: string | null
          channel: Database['public']['Enums']['notification_channel'] | null
          created_at: string | null
          error_message: string | null
          event_type:
            | Database['public']['Enums']['notification_event_type']
            | null
          expires_at: string | null
          external_id: string | null
          failed_at: string | null
          id: string | null
          max_retries: number | null
          metadata: Json | null
          organization_id: string | null
          organization_name: string | null
          recipient_email: string | null
          recipient_id: string | null
          recipient_phone: string | null
          recipient_user_email: string | null
          retry_count: number | null
          sent_at: string | null
          status: Database['public']['Enums']['notification_status'] | null
          subject: string | null
          template_data: Json | null
          ticket_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_ticket_id_fkey'
            columns: ['ticket_id']
            isOneToOne: false
            referencedRelation: 'tickets'
            referencedColumns: ['id']
          },
        ]
      }
      organization_notification_settings_view: {
        Row: {
          created_at: string | null
          email_available: boolean | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_enabled: boolean | null
          evolution_instance_name: string | null
          evolution_key_masked: string | null
          fallback_to_resend: boolean | null
          id: string | null
          last_tested_at: string | null
          organization_id: string | null
          organization_name: string | null
          resend_api_key: string | null
          resend_enabled: boolean | null
          resend_from_email: string | null
          resend_from_name: string | null
          sms_api_key: string | null
          sms_enabled: boolean | null
          sms_from_number: string | null
          sms_provider: string | null
          smtp_enabled: boolean | null
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_password_masked: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user: string | null
          test_mode: boolean | null
          updated_at: string | null
          whatsapp_available: boolean | null
          whatsapp_cloud_access_token: string | null
          whatsapp_cloud_enabled: boolean | null
          whatsapp_cloud_phone_number_id: string | null
          whatsapp_cloud_token_masked: string | null
          whatsapp_cloud_waba_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'organization_notification_settings_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      archive_old_notifications: { Args: never; Returns: Json }
      calculate_resolution_time: {
        Args: { created_at: string; updated_at: string }
        Returns: number
      }
      can_access_ticket: { Args: { p_ticket_id: string }; Returns: boolean }
      cleanup_expired_notifications: { Args: never; Returns: undefined }
      cleanup_notifications_archive: { Args: never; Returns: Json }
      create_attachment_from_upload: {
        Args: {
          p_file_ext: string
          p_file_name: string
          p_file_size: number
          p_mime_type: string
          p_storage_path: string
          p_ticket_id: string
        }
        Returns: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          file_ext: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          organization_id: string
          storage_bucket: string
          storage_path: string
          ticket_id: string
          uploaded_by: string
        }
        SetofOptions: {
          from: '*'
          to: 'attachments'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_old_notifications: { Args: never; Returns: Json }
      get_org_enabled_channels: {
        Args: { p_org_id: string }
        Returns: {
          email_channel: string
          sms_channel: string
          whatsapp_channel: string
        }[]
      }
      get_org_notification_settings: {
        Args: { p_org_id: string }
        Returns: {
          created_at: string
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_enabled: boolean
          evolution_instance_name: string | null
          fallback_to_resend: boolean
          id: string
          last_tested_at: string | null
          logo_url: string | null
          organization_id: string
          resend_api_key: string | null
          resend_enabled: boolean
          resend_from_email: string | null
          resend_from_name: string | null
          sms_api_key: string | null
          sms_enabled: boolean
          sms_from_number: string | null
          sms_provider: string | null
          smtp_enabled: boolean
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user: string | null
          test_mode: boolean
          updated_at: string
          whatsapp_cloud_access_token: string | null
          whatsapp_cloud_enabled: boolean
          whatsapp_cloud_phone_number_id: string | null
          whatsapp_cloud_waba_id: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'organization_notification_settings'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_notification_channels: {
        Args: {
          p_event_type: Database['public']['Enums']['notification_event_type']
          p_org_id: string
          p_user_id: string
        }
        Returns: string[]
      }
      increment_article_views: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      is_member: { Args: { org_id: string; user_id: string }; Returns: boolean }
      is_staff: { Args: { p_org_id: string }; Returns: boolean }
      my_orgs: { Args: never; Returns: string[] }
      my_role: {
        Args: { org_id: string }
        Returns: Database['public']['Enums']['user_role']
      }
      org_id_from_slug: { Args: { p_slug: string }; Returns: string }
      process_notification_queue: { Args: never; Returns: Json }
      search_kb_articles: {
        Args: { p_limit?: number; p_org_id: string; p_query: string }
        Returns: {
          category_name: string
          excerpt: string
          id: string
          score: number
          title: string
        }[]
      }
      storage_object_exists: {
        Args: { p_bucket: string; p_name: string }
        Returns: boolean
      }
      test_notification_settings: {
        Args: { p_channel: string; p_org_id: string; p_test_recipient: string }
        Returns: Json
      }
      vote_article: {
        Args: { p_article_id: string; p_helpful: boolean }
        Returns: undefined
      }
    }
    Enums: {
      notification_channel: 'EMAIL' | 'WHATSAPP' | 'SMS'
      notification_event_type:
        | 'TICKET_CREATED'
        | 'TICKET_UPDATED'
        | 'TICKET_ASSIGNED'
        | 'TICKET_COMMENT'
        | 'TICKET_ATTACHMENT'
        | 'TICKET_CLOSED'
        | 'MENTION'
        | 'TEST'
        | 'WAITING_APPROVAL'
        | 'APPROVAL_REMINDER_24H'
        | 'SOLUTION_SENT'
        | 'SLA_WARNING'
        | 'SLA_BREACH'
        | 'REPORT'
        | 'STATUS_CHANGED'
        | 'PRIORITY_UPDATED'
        | 'TICKET_CUSTOMER_REPLY'
      notification_status:
        | 'PENDING'
        | 'PROCESSING'
        | 'SENT'
        | 'FAILED'
        | 'EXPIRED'
        | 'CANCELLED'
      ticket_priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
      ticket_status:
        | 'RECEIVED'
        | 'IN_PROGRESS'
        | 'WAITING_CUSTOMER'
        | 'WAITING_APPROVAL'
        | 'APPROVED'
        | 'CLOSED'
      timeline_entry_type: 'MESSAGE' | 'EVENT'
      user_role: 'ADMIN' | 'AGENT' | 'USER'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      notification_channel: ['EMAIL', 'WHATSAPP', 'SMS'],
      notification_event_type: [
        'TICKET_CREATED',
        'TICKET_UPDATED',
        'TICKET_ASSIGNED',
        'TICKET_COMMENT',
        'TICKET_ATTACHMENT',
        'TICKET_CLOSED',
        'MENTION',
        'TEST',
        'WAITING_APPROVAL',
        'APPROVAL_REMINDER_24H',
        'SOLUTION_SENT',
        'SLA_WARNING',
        'SLA_BREACH',
        'REPORT',
        'STATUS_CHANGED',
        'PRIORITY_UPDATED',
        'TICKET_CUSTOMER_REPLY',
      ],
      notification_status: [
        'PENDING',
        'PROCESSING',
        'SENT',
        'FAILED',
        'EXPIRED',
        'CANCELLED',
      ],
      ticket_priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      ticket_status: [
        'RECEIVED',
        'IN_PROGRESS',
        'WAITING_CUSTOMER',
        'WAITING_APPROVAL',
        'APPROVED',
        'CLOSED',
      ],
      timeline_entry_type: ['MESSAGE', 'EVENT'],
      user_role: ['ADMIN', 'AGENT', 'USER'],
    },
  },
} as const
