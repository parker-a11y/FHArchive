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
      ai_suggestions: {
        Row: {
          content: string | null
          created_at: string
          field_key: string
          id: string
          letter_id: string
          model: string | null
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          field_key: string
          id?: string
          letter_id: string
          model?: string | null
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          field_key?: string
          id?: string
          letter_id?: string
          model?: string | null
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_contacts: {
        Row: {
          created_at: string
          email: string
          id: string
          last_used_at: string | null
          name: string
          notes: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_used_at?: string | null
          name: string
          notes?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_used_at?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      archive_counter: {
        Row: {
          last_seq: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          last_seq?: number
          owner_id?: string
          updated_at?: string
        }
        Update: {
          last_seq?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      archive_email_attachments: {
        Row: {
          archive_id: string | null
          created_at: string
          email_id: string
          file_size: number | null
          filename: string
          id: string
          letter_id: string | null
          owner_id: string
          storage_path: string | null
        }
        Insert: {
          archive_id?: string | null
          created_at?: string
          email_id: string
          file_size?: number | null
          filename: string
          id?: string
          letter_id?: string | null
          owner_id: string
          storage_path?: string | null
        }
        Update: {
          archive_id?: string | null
          created_at?: string
          email_id?: string
          file_size?: number | null
          filename?: string
          id?: string
          letter_id?: string | null
          owner_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archive_email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "archive_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_email_attachments_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_email_records: {
        Row: {
          archive_id: string
          created_at: string
          email_id: string
          id: string
          letter_id: string
          owner_id: string
          sort_order: number
        }
        Insert: {
          archive_id: string
          created_at?: string
          email_id: string
          id?: string
          letter_id: string
          owner_id: string
          sort_order?: number
        }
        Update: {
          archive_id?: string
          created_at?: string
          email_id?: string
          id?: string
          letter_id?: string
          owner_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "archive_email_records_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "archive_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_email_records_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_emails: {
        Row: {
          attachment_count: number
          created_at: string
          error: string | null
          header_subtitle: string | null
          header_title: string | null
          id: string
          message_body: string | null
          owner_id: string
          recipients: Json
          sender_email: string | null
          sent_at: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          attachment_count?: number
          created_at?: string
          error?: string | null
          header_subtitle?: string | null
          header_title?: string | null
          id?: string
          message_body?: string | null
          owner_id: string
          recipients?: Json
          sender_email?: string | null
          sent_at?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          attachment_count?: number
          created_at?: string
          error?: string | null
          header_subtitle?: string | null
          header_title?: string | null
          id?: string
          message_body?: string | null
          owner_id?: string
          recipients?: Json
          sender_email?: string | null
          sent_at?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      archive_notes: {
        Row: {
          author_id: string
          author_name: string | null
          body: string
          created_at: string
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      backup_files: {
        Row: {
          backed_up_at: string
          bucket: string
          created_at: string
          drive_file_id: string | null
          file_size: number | null
          id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          backed_up_at?: string
          bucket: string
          created_at?: string
          drive_file_id?: string | null
          file_size?: number | null
          id?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          backed_up_at?: string
          bucket?: string
          created_at?: string
          drive_file_id?: string | null
          file_size?: number | null
          id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          bytes_uploaded: number
          created_at: string
          db_rows: number
          destination: string
          drive_folder_id: string | null
          drive_folder_name: string | null
          error: string | null
          files_pending: number
          files_uploaded: number
          finished_at: string | null
          id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          bytes_uploaded?: number
          created_at?: string
          db_rows?: number
          destination?: string
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          error?: string | null
          files_pending?: number
          files_uploaded?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          bytes_uploaded?: number
          created_at?: string
          db_rows?: number
          destination?: string
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          error?: string | null
          files_pending?: number
          files_uploaded?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      container_counter: {
        Row: {
          last_seq: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          last_seq?: number
          owner_id: string
          updated_at?: string
        }
        Update: {
          last_seq?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      container_files: {
        Row: {
          container_id: string
          created_at: string
          file_label: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          original_filename: string | null
          owner_id: string
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          container_id: string
          created_at?: string
          file_label?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_filename?: string | null
          owner_id?: string
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          container_id?: string
          created_at?: string
          file_label?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_filename?: string | null
          owner_id?: string
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "container_files_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "source_containers"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_files: {
        Row: {
          created_at: string
          filename_matches: boolean
          id: string
          label: string | null
          letter_id: string
          master_mime: string | null
          master_path: string
          master_size: number | null
          notes: string | null
          original_filename: string
          owner_id: string
          rotation: number
          seq: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          filename_matches?: boolean
          id?: string
          label?: string | null
          letter_id: string
          master_mime?: string | null
          master_path: string
          master_size?: number | null
          notes?: string | null
          original_filename: string
          owner_id?: string
          rotation?: number
          seq?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          filename_matches?: boolean
          id?: string
          label?: string | null
          letter_id?: string
          master_mime?: string | null
          master_path?: string
          master_size?: number | null
          notes?: string | null
          original_filename?: string
          owner_id?: string
          rotation?: number
          seq?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_files_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_sources: {
        Row: {
          citation: string | null
          created_at: string
          creator: string | null
          date_accessed: string | null
          date_precision: string
          description: string | null
          ds_id: string
          ds_seq: number
          historical_date_range: string | null
          id: string
          institution: string | null
          local_file_path: string | null
          normalized_date: string | null
          notes: string | null
          original_date: string | null
          owner_id: string
          rights_notes: string | null
          source_type: string
          starred: boolean
          title: string
          transcript: string | null
          transcription_status: string
          updated_at: string
          url: string | null
          visibility: string
        }
        Insert: {
          citation?: string | null
          created_at?: string
          creator?: string | null
          date_accessed?: string | null
          date_precision?: string
          description?: string | null
          ds_id: string
          ds_seq: number
          historical_date_range?: string | null
          id?: string
          institution?: string | null
          local_file_path?: string | null
          normalized_date?: string | null
          notes?: string | null
          original_date?: string | null
          owner_id?: string
          rights_notes?: string | null
          source_type?: string
          starred?: boolean
          title: string
          transcript?: string | null
          transcription_status?: string
          updated_at?: string
          url?: string | null
          visibility?: string
        }
        Update: {
          citation?: string | null
          created_at?: string
          creator?: string | null
          date_accessed?: string | null
          date_precision?: string
          description?: string | null
          ds_id?: string
          ds_seq?: number
          historical_date_range?: string | null
          id?: string
          institution?: string | null
          local_file_path?: string | null
          normalized_date?: string | null
          notes?: string | null
          original_date?: string | null
          owner_id?: string
          rights_notes?: string | null
          source_type?: string
          starred?: boolean
          title?: string
          transcript?: string | null
          transcription_status?: string
          updated_at?: string
          url?: string | null
          visibility?: string
        }
        Relationships: []
      }
      ds_counter: {
        Row: {
          last_seq: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          last_seq?: number
          owner_id?: string
          updated_at?: string
        }
        Update: {
          last_seq?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ds_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          owner_id: string
          source_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          owner_id?: string
          source_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          owner_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ds_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ds_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "digital_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ds_files: {
        Row: {
          created_at: string
          file_label: string
          file_size: number | null
          file_type: string
          id: string
          mime_type: string | null
          notes: string | null
          original_filename: string | null
          owner_id: string
          sort_order: number
          source_id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_label?: string
          file_size?: number | null
          file_type?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_filename?: string | null
          owner_id?: string
          sort_order?: number
          source_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_label?: string
          file_size?: number | null
          file_type?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_filename?: string | null
          owner_id?: string
          sort_order?: number
          source_id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ds_files_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "digital_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ds_keywords: {
        Row: {
          created_at: string
          id: string
          keyword_id: string
          owner_id: string
          source_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword_id: string
          owner_id?: string
          source_id: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword_id?: string
          owner_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ds_keywords_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ds_keywords_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "digital_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ds_organizations: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          owner_id: string
          role: string
          source_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          owner_id?: string
          role?: string
          source_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          owner_id?: string
          role?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ds_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ds_organizations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "digital_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ds_people: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          person_id: string
          role: string
          source_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string
          person_id: string
          role?: string
          source_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          person_id?: string
          role?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ds_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ds_people_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "digital_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ds_places: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          place_id: string
          role: string
          source_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string
          place_id: string
          role?: string
          source_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          place_id?: string
          role?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ds_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ds_places_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "digital_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ds_segments: {
        Row: {
          created_at: string
          description: string | null
          end_ts: string | null
          id: string
          keywords: string | null
          owner_id: string
          sort_order: number
          source_id: string
          start_ts: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_ts?: string | null
          id?: string
          keywords?: string | null
          owner_id?: string
          sort_order?: number
          source_id: string
          start_ts?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          end_ts?: string | null
          id?: string
          keywords?: string | null
          owner_id?: string
          sort_order?: number
          source_id?: string
          start_ts?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ds_segments_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "digital_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_history: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          actor_name: string | null
          created_at: string
          entity: string
          field_key: string
          id: string
          letter_id: string | null
          new_value: string | null
          old_value: string | null
          owner_id: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity?: string
          field_key: string
          id?: string
          letter_id?: string | null
          new_value?: string | null
          old_value?: string | null
          owner_id?: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity?: string
          field_key?: string
          id?: string
          letter_id?: string | null
          new_value?: string | null
          old_value?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edit_history_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          event_type: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      file_derivatives: {
        Row: {
          created_at: string
          error: string | null
          file_id: string | null
          file_size: number | null
          height: number | null
          id: string
          kind: string
          letter_id: string
          mime_type: string | null
          owner_id: string
          status: string
          storage_path: string | null
          text_content: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          file_id?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          kind: string
          letter_id: string
          mime_type?: string | null
          owner_id?: string
          status?: string
          storage_path?: string | null
          text_content?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          created_at?: string
          error?: string | null
          file_id?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          kind?: string
          letter_id?: string
          mime_type?: string | null
          owner_id?: string
          status?: string
          storage_path?: string | null
          text_content?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "file_derivatives_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "digital_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_derivatives_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_claims: {
        Row: {
          claim: string
          confidence: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          evidence: string[]
          id: string
          owner_id: string
          question: string | null
          reasoning: string | null
          status: string
          updated_at: string
        }
        Insert: {
          claim: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          evidence?: string[]
          id?: string
          owner_id?: string
          question?: string | null
          reasoning?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          claim?: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          evidence?: string[]
          id?: string
          owner_id?: string
          question?: string | null
          reasoning?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      historical_references: {
        Row: {
          created_at: string
          description: string | null
          id: string
          letter_id: string
          notes: string | null
          owner_id: string
          ref_type: string
          reference: string
          research_status: string
          source_links: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          letter_id: string
          notes?: string | null
          owner_id?: string
          ref_type?: string
          reference: string
          research_status?: string
          source_links?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          letter_id?: string
          notes?: string | null
          owner_id?: string
          ref_type?: string
          reference?: string
          research_status?: string
          source_links?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "historical_references_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      job_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      keywords: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      letter_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          letter_id: string
          owner_id: string
          source: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          letter_id: string
          owner_id?: string
          source?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          letter_id?: string
          owner_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_events_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_keywords: {
        Row: {
          confirmed: boolean
          created_at: string
          id: string
          keyword_id: string
          letter_id: string
          owner_id: string
          source: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          id?: string
          keyword_id: string
          letter_id: string
          owner_id?: string
          source?: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          id?: string
          keyword_id?: string
          letter_id?: string
          owner_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_keywords_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_keywords_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_organizations: {
        Row: {
          created_at: string
          id: string
          letter_id: string
          organization_id: string
          owner_id: string
          role: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          letter_id: string
          organization_id: string
          owner_id?: string
          role?: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          letter_id?: string
          organization_id?: string
          owner_id?: string
          role?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_organizations_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_people: {
        Row: {
          created_at: string
          id: string
          letter_id: string
          owner_id: string
          person_id: string
          role: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          letter_id: string
          owner_id?: string
          person_id: string
          role?: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          letter_id?: string
          owner_id?: string
          person_id?: string
          role?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_people_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_places: {
        Row: {
          created_at: string
          id: string
          letter_id: string
          owner_id: string
          place_id: string
          role: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          letter_id: string
          owner_id?: string
          place_id: string
          role?: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          letter_id?: string
          owner_id?: string
          place_id?: string
          role?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_places_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_relations: {
        Row: {
          created_at: string
          id: string
          letter_id: string
          note: string | null
          owner_id: string
          related_letter_id: string
          relation_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          letter_id: string
          note?: string | null
          owner_id?: string
          related_letter_id: string
          relation_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          letter_id?: string
          note?: string | null
          owner_id?: string
          related_letter_id?: string
          relation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_relations_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_relations_related_letter_id_fkey"
            columns: ["related_letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_sources: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          letter_id: string
          owner_id: string
          source_id: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          letter_id: string
          owner_id?: string
          source_id: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          letter_id?: string
          owner_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_sources_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "digital_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      letters: {
        Row: {
          addressee_normalized: string | null
          archive_id: string
          author: string | null
          citations: string | null
          closing_as_written: string | null
          completeness_check: boolean
          created_at: string
          date_as_written: string | null
          date_certainty: string
          date_end: string | null
          date_precision: string
          destination: string | null
          digitization_completed_at: string | null
          digitization_notes: string | null
          digitization_override: boolean
          digitization_status: string
          expected_scan_count: number | null
          fh_seq: number
          forwarded: boolean
          forwarded_to: string | null
          has_enclosures: boolean
          has_envelope: boolean
          historical_notes: string | null
          id: string
          identification_status: string
          image_count: number
          normalized_date: string | null
          notes: string | null
          ocr_text: string | null
          origin: string | null
          original_copy: string
          original_order_notes: string | null
          owner_id: string
          period: string
          photo_back_scanned: boolean
          photo_front_scanned: boolean
          physical_condition: string | null
          physical_description: string | null
          postal_notes: string | null
          postal_service: string | null
          primary_person: string | null
          provenance: string | null
          publication_status: string
          recipient: string | null
          record_type: string
          research_needed: boolean
          research_notes: string | null
          research_status: string
          review_status: string
          salutation_as_written: string | null
          scan_both_sides: boolean
          scan_status: string
          sheets: number | null
          signature_as_written: string | null
          sort_date: string | null
          source_container_id: string | null
          starred: boolean
          storage_container: string | null
          storage_folder: string | null
          storage_location: string | null
          storage_notes: string | null
          storage_position: string | null
          storage_type: string | null
          subtype: string | null
          summary_long: string | null
          summary_short: string | null
          title: string | null
          tones: string[]
          transcription_ai_generated_at: string | null
          transcription_raw_ai: string | null
          transcription_rollup_text: string | null
          transcription_status: string
          transcription_verified: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          addressee_normalized?: string | null
          archive_id: string
          author?: string | null
          citations?: string | null
          closing_as_written?: string | null
          completeness_check?: boolean
          created_at?: string
          date_as_written?: string | null
          date_certainty?: string
          date_end?: string | null
          date_precision?: string
          destination?: string | null
          digitization_completed_at?: string | null
          digitization_notes?: string | null
          digitization_override?: boolean
          digitization_status?: string
          expected_scan_count?: number | null
          fh_seq: number
          forwarded?: boolean
          forwarded_to?: string | null
          has_enclosures?: boolean
          has_envelope?: boolean
          historical_notes?: string | null
          id?: string
          identification_status?: string
          image_count?: number
          normalized_date?: string | null
          notes?: string | null
          ocr_text?: string | null
          origin?: string | null
          original_copy?: string
          original_order_notes?: string | null
          owner_id?: string
          period?: string
          photo_back_scanned?: boolean
          photo_front_scanned?: boolean
          physical_condition?: string | null
          physical_description?: string | null
          postal_notes?: string | null
          postal_service?: string | null
          primary_person?: string | null
          provenance?: string | null
          publication_status?: string
          recipient?: string | null
          record_type?: string
          research_needed?: boolean
          research_notes?: string | null
          research_status?: string
          review_status?: string
          salutation_as_written?: string | null
          scan_both_sides?: boolean
          scan_status?: string
          sheets?: number | null
          signature_as_written?: string | null
          sort_date?: string | null
          source_container_id?: string | null
          starred?: boolean
          storage_container?: string | null
          storage_folder?: string | null
          storage_location?: string | null
          storage_notes?: string | null
          storage_position?: string | null
          storage_type?: string | null
          subtype?: string | null
          summary_long?: string | null
          summary_short?: string | null
          title?: string | null
          tones?: string[]
          transcription_ai_generated_at?: string | null
          transcription_raw_ai?: string | null
          transcription_rollup_text?: string | null
          transcription_status?: string
          transcription_verified?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          addressee_normalized?: string | null
          archive_id?: string
          author?: string | null
          citations?: string | null
          closing_as_written?: string | null
          completeness_check?: boolean
          created_at?: string
          date_as_written?: string | null
          date_certainty?: string
          date_end?: string | null
          date_precision?: string
          destination?: string | null
          digitization_completed_at?: string | null
          digitization_notes?: string | null
          digitization_override?: boolean
          digitization_status?: string
          expected_scan_count?: number | null
          fh_seq?: number
          forwarded?: boolean
          forwarded_to?: string | null
          has_enclosures?: boolean
          has_envelope?: boolean
          historical_notes?: string | null
          id?: string
          identification_status?: string
          image_count?: number
          normalized_date?: string | null
          notes?: string | null
          ocr_text?: string | null
          origin?: string | null
          original_copy?: string
          original_order_notes?: string | null
          owner_id?: string
          period?: string
          photo_back_scanned?: boolean
          photo_front_scanned?: boolean
          physical_condition?: string | null
          physical_description?: string | null
          postal_notes?: string | null
          postal_service?: string | null
          primary_person?: string | null
          provenance?: string | null
          publication_status?: string
          recipient?: string | null
          record_type?: string
          research_needed?: boolean
          research_notes?: string | null
          research_status?: string
          review_status?: string
          salutation_as_written?: string | null
          scan_both_sides?: boolean
          scan_status?: string
          sheets?: number | null
          signature_as_written?: string | null
          sort_date?: string | null
          source_container_id?: string | null
          starred?: boolean
          storage_container?: string | null
          storage_folder?: string | null
          storage_location?: string | null
          storage_notes?: string | null
          storage_position?: string | null
          storage_type?: string | null
          subtype?: string | null
          summary_long?: string | null
          summary_short?: string | null
          title?: string | null
          tones?: string[]
          transcription_ai_generated_at?: string | null
          transcription_raw_ai?: string | null
          transcription_rollup_text?: string | null
          transcription_status?: string
          transcription_verified?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "letters_source_container_id_fkey"
            columns: ["source_container_id"]
            isOneToOne: false
            referencedRelation: "source_containers"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          notes: string | null
          org_type: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          org_type?: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_type?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          alternate_names: string | null
          biographical_notes: string | null
          birth_date: string | null
          created_at: string
          death_date: string | null
          id: string
          name: string
          owner_id: string
          relationship: string | null
          research_notes: string | null
          updated_at: string
        }
        Insert: {
          alternate_names?: string | null
          biographical_notes?: string | null
          birth_date?: string | null
          created_at?: string
          death_date?: string | null
          id?: string
          name: string
          owner_id?: string
          relationship?: string | null
          research_notes?: string | null
          updated_at?: string
        }
        Update: {
          alternate_names?: string | null
          biographical_notes?: string | null
          birth_date?: string | null
          created_at?: string
          death_date?: string | null
          id?: string
          name?: string
          owner_id?: string
          relationship?: string | null
          research_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      person_aliases: {
        Row: {
          alias: string
          alias_norm: string | null
          created_at: string
          id: string
          owner_id: string
          person_id: string
        }
        Insert: {
          alias: string
          alias_norm?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          person_id: string
        }
        Update: {
          alias?: string
          alias_norm?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_aliases_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          canonical_name: string
          city: string | null
          country: string | null
          created_at: string
          historical_notes: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name_as_written: string | null
          owner_id: string
          region: string | null
          research_notes: string | null
          updated_at: string
        }
        Insert: {
          canonical_name: string
          city?: string | null
          country?: string | null
          created_at?: string
          historical_notes?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name_as_written?: string | null
          owner_id?: string
          region?: string | null
          research_notes?: string | null
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          city?: string | null
          country?: string | null
          created_at?: string
          historical_notes?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name_as_written?: string | null
          owner_id?: string
          region?: string | null
          research_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_at: string | null
          ask_francis: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          ask_francis?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          ask_francis?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      record_categories: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          owner_id: string
          parent_type: string | null
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label: string
          owner_id?: string
          parent_type?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          owner_id?: string
          parent_type?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      record_links: {
        Row: {
          a_id: string
          a_kind: string
          b_id: string
          b_kind: string
          created_at: string
          id: string
          note: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          a_id: string
          a_kind: string
          b_id: string
          b_kind: string
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          updated_at?: string
        }
        Update: {
          a_id?: string
          a_kind?: string
          b_id?: string
          b_kind?: string
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      record_shares: {
        Row: {
          created_at: string
          enabled: boolean
          file_id: string | null
          id: string
          include_notes: boolean
          include_transcription: boolean
          last_viewed_at: string | null
          letter_id: string
          owner_id: string
          public_note: string | null
          scope: string
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          file_id?: string | null
          id?: string
          include_notes?: boolean
          include_transcription?: boolean
          last_viewed_at?: string | null
          letter_id: string
          owner_id?: string
          public_note?: string | null
          scope?: string
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          file_id?: string | null
          id?: string
          include_notes?: boolean
          include_transcription?: boolean
          last_viewed_at?: string | null
          letter_id?: string
          owner_id?: string
          public_note?: string | null
          scope?: string
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "record_shares_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "digital_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_shares_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      rejected_entities: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          name_norm: string | null
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          name: string
          name_norm?: string | null
          owner_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          name_norm?: string | null
          owner_id?: string
        }
        Relationships: []
      }
      research_index: {
        Row: {
          archive_id: string
          author: string | null
          body: string | null
          date_text: string | null
          destination: string | null
          events: string[]
          fts: unknown
          has_transcription: boolean
          id: string
          keywords: string[]
          kind: string
          linked_refs: string[]
          organizations: string[]
          origin: string | null
          people: string[]
          period: string | null
          places: string[]
          recipient: string | null
          record_type: string | null
          ref_id: string
          snapshot_id: string | null
          sort_date: string | null
          subtype: string | null
          summary: string | null
          title: string | null
          tones: string[]
          updated_at: string
        }
        Insert: {
          archive_id: string
          author?: string | null
          body?: string | null
          date_text?: string | null
          destination?: string | null
          events?: string[]
          fts?: unknown
          has_transcription?: boolean
          id?: string
          keywords?: string[]
          kind: string
          linked_refs?: string[]
          organizations?: string[]
          origin?: string | null
          people?: string[]
          period?: string | null
          places?: string[]
          recipient?: string | null
          record_type?: string | null
          ref_id: string
          snapshot_id?: string | null
          sort_date?: string | null
          subtype?: string | null
          summary?: string | null
          title?: string | null
          tones?: string[]
          updated_at?: string
        }
        Update: {
          archive_id?: string
          author?: string | null
          body?: string | null
          date_text?: string | null
          destination?: string | null
          events?: string[]
          fts?: unknown
          has_transcription?: boolean
          id?: string
          keywords?: string[]
          kind?: string
          linked_refs?: string[]
          organizations?: string[]
          origin?: string | null
          people?: string[]
          period?: string | null
          places?: string[]
          recipient?: string | null
          record_type?: string | null
          ref_id?: string
          snapshot_id?: string | null
          sort_date?: string | null
          subtype?: string | null
          summary?: string | null
          title?: string | null
          tones?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      research_snapshots: {
        Row: {
          bytes_written: number
          created_at: string
          error: string | null
          files: Json
          finished_at: string | null
          folder: string | null
          id: string
          people_count: number
          places_count: number
          records_indexed: number
          sources_indexed: number
          started_at: string
          status: string
          transcriptions_indexed: number
          trigger: string
          updated_at: string
        }
        Insert: {
          bytes_written?: number
          created_at?: string
          error?: string | null
          files?: Json
          finished_at?: string | null
          folder?: string | null
          id?: string
          people_count?: number
          places_count?: number
          records_indexed?: number
          sources_indexed?: number
          started_at?: string
          status?: string
          transcriptions_indexed?: number
          trigger?: string
          updated_at?: string
        }
        Update: {
          bytes_written?: number
          created_at?: string
          error?: string | null
          files?: Json
          finished_at?: string | null
          folder?: string | null
          id?: string
          people_count?: number
          places_count?: number
          records_indexed?: number
          sources_indexed?: number
          started_at?: string
          status?: string
          transcriptions_indexed?: number
          trigger?: string
          updated_at?: string
        }
        Relationships: []
      }
      scan_transcriptions: {
        Row: {
          ai_generated_at: string | null
          ai_text: string | null
          created_at: string
          error: string | null
          file_id: string
          id: string
          letter_id: string
          model: string | null
          owner_id: string
          page_index: number | null
          page_label: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_text: string | null
        }
        Insert: {
          ai_generated_at?: string | null
          ai_text?: string | null
          created_at?: string
          error?: string | null
          file_id: string
          id?: string
          letter_id: string
          model?: string | null
          owner_id?: string
          page_index?: number | null
          page_label?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_text?: string | null
        }
        Update: {
          ai_generated_at?: string | null
          ai_text?: string | null
          created_at?: string
          error?: string | null
          file_id?: string
          id?: string
          letter_id?: string
          model?: string | null
          owner_id?: string
          page_index?: number | null
          page_label?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_transcriptions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "digital_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_transcriptions_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      source_containers: {
        Row: {
          artifact_letter_id: string | null
          box_id: string
          box_seq: number
          condition: string | null
          container_type: string
          created_at: string
          date_photographed: string | null
          description: string | null
          id: string
          inscriptions: string | null
          notes: string | null
          owner_id: string
          processing_status: string
          title: string
          updated_at: string
        }
        Insert: {
          artifact_letter_id?: string | null
          box_id: string
          box_seq: number
          condition?: string | null
          container_type?: string
          created_at?: string
          date_photographed?: string | null
          description?: string | null
          id?: string
          inscriptions?: string | null
          notes?: string | null
          owner_id?: string
          processing_status?: string
          title: string
          updated_at?: string
        }
        Update: {
          artifact_letter_id?: string | null
          box_id?: string
          box_seq?: number
          condition?: string | null
          container_type?: string
          created_at?: string
          date_photographed?: string | null
          description?: string | null
          id?: string
          inscriptions?: string | null
          notes?: string | null
          owner_id?: string
          processing_status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_containers_artifact_letter_id_fkey"
            columns: ["artifact_letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      source_shares: {
        Row: {
          created_at: string
          enabled: boolean
          file_id: string | null
          id: string
          include_notes: boolean
          include_transcript: boolean
          last_viewed_at: string | null
          owner_id: string
          public_note: string | null
          scope: string
          source_id: string
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          file_id?: string | null
          id?: string
          include_notes?: boolean
          include_transcript?: boolean
          last_viewed_at?: string | null
          owner_id?: string
          public_note?: string | null
          scope?: string
          source_id: string
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          file_id?: string | null
          id?: string
          include_notes?: boolean
          include_transcript?: boolean
          last_viewed_at?: string | null
          owner_id?: string
          public_note?: string | null
          scope?: string
          source_id?: string
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "source_shares_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "ds_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_shares_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "digital_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      tone_options: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
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
      weekly_recaps: {
        Row: {
          body_md: string
          created_at: string
          generated_at: string
          id: string
          image_archive_id: string | null
          image_bucket: string | null
          image_caption: string | null
          image_path: string | null
          lede: string | null
          manually_edited: boolean
          model: string | null
          owner_id: string | null
          related_ids: string[]
          stats: Json
          status: string
          title: string
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          body_md?: string
          created_at?: string
          generated_at?: string
          id?: string
          image_archive_id?: string | null
          image_bucket?: string | null
          image_caption?: string | null
          image_path?: string | null
          lede?: string | null
          manually_edited?: boolean
          model?: string | null
          owner_id?: string | null
          related_ids?: string[]
          stats?: Json
          status?: string
          title?: string
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          body_md?: string
          created_at?: string
          generated_at?: string
          id?: string
          image_archive_id?: string | null
          image_bucket?: string | null
          image_caption?: string | null
          image_path?: string | null
          lede?: string | null
          manually_edited?: boolean
          model?: string | null
          owner_id?: string | null
          related_ids?: string[]
          stats?: Json
          status?: string
          title?: string
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_owner_id: { Args: never; Returns: string }
      can_edit_archive: { Args: { _user_id: string }; Returns: boolean }
      can_read_archive: { Args: { _user_id: string }; Returns: boolean }
      create_digital_source: {
        Args: {
          p_creator: string
          p_date_accessed: string
          p_date_precision?: string
          p_description: string
          p_historical_date_range: string
          p_institution: string
          p_normalized_date?: string
          p_notes: string
          p_original_date: string
          p_source_type: string
          p_title: string
          p_url: string
        }
        Returns: {
          ds_id: string
          ds_seq: number
          id: string
        }[]
      }
      create_record: {
        Args: {
          p_author: string
          p_date_as_written: string
          p_date_certainty: string
          p_date_end: string
          p_date_precision: string
          p_destination: string
          p_has_enclosures: boolean
          p_has_envelope: boolean
          p_normalized_date: string
          p_notes: string
          p_origin: string
          p_original_copy: string
          p_period: string
          p_primary_person: string
          p_recipient: string
          p_record_type: string
          p_sheets: number
          p_storage_location: string
          p_subtype: string
          p_title: string
        }
        Returns: {
          archive_id: string
          fh_seq: number
          id: string
        }[]
      }
      create_source_container: {
        Args: {
          p_condition?: string
          p_container_type?: string
          p_date_photographed?: string
          p_description?: string
          p_inscriptions?: string
          p_notes?: string
          p_processing_status?: string
          p_title: string
        }
        Returns: {
          box_id: string
          box_seq: number
          id: string
        }[]
      }
      dashboard_stats: { Args: never; Returns: Json }
      ds_file_counts: {
        Args: never
        Returns: {
          files: number
          source_id: string
        }[]
      }
      find_person_matches: {
        Args: { _limit?: number; _name: string }
        Returns: {
          id: string
          matched_on: string
          name: string
          score: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_approved_archivist: { Args: { _user_id: string }; Returns: boolean }
      is_approved_guest: { Args: { _user_id: string }; Returns: boolean }
      keyword_usage_counts: {
        Args: never
        Returns: {
          keyword_id: string
          uses: number
        }[]
      }
      merge_people: {
        Args: { _source_ids: string[]; _target_id: string }
        Returns: undefined
      }
      merge_places: {
        Args: { _source_ids: string[]; _target_id: string }
        Returns: undefined
      }
      next_archive_id: {
        Args: never
        Returns: {
          archive_id: string
          fh_seq: number
        }[]
      }
      preview_next_archive_id: {
        Args: never
        Returns: {
          archive_id: string
          fh_seq: number
        }[]
      }
      preview_next_ds_id: {
        Args: never
        Returns: {
          ds_id: string
          ds_seq: number
        }[]
      }
      require_admin: { Args: never; Returns: undefined }
      require_editor: { Args: never; Returns: undefined }
      search_archive_records: {
        Args: { p_limit?: number; p_q?: string }
        Returns: {
          collection: string
          date_text: string
          id: string
          kind: string
          ref: string
          sort_date: string
          title: string
          type_label: string
        }[]
      }
      search_letters:
        | {
            Args: {
              p_addressee?: string
              p_author?: string
              p_closing?: string
              p_date_from?: string
              p_date_precision?: string
              p_date_to?: string
              p_dig_status?: string
              p_dir?: string
              p_event?: string
              p_id_status?: string
              p_limit?: number
              p_offset?: number
              p_org?: string
              p_period?: string
              p_person?: string
              p_place?: string
              p_q?: string
              p_recipient?: string
              p_research?: string
              p_review?: string
              p_salutation?: string
              p_scan?: string
              p_signature?: string
              p_sort?: string
              p_starred?: boolean
              p_subtype?: string
              p_tones?: string[]
              p_tstatus?: string
              p_type?: string
              p_uncertain?: boolean
              p_view?: string
            }
            Returns: {
              letter: Database["public"]["Tables"]["letters"]["Row"]
              total_count: number
            }[]
          }
        | {
            Args: {
              p_addressee?: string
              p_author?: string
              p_closing?: string
              p_date_from?: string
              p_date_precision?: string
              p_date_to?: string
              p_dig_status?: string
              p_dir?: string
              p_event?: string
              p_forwarded?: boolean
              p_id_status?: string
              p_limit?: number
              p_offset?: number
              p_org?: string
              p_period?: string
              p_person?: string
              p_place?: string
              p_postal?: string
              p_q?: string
              p_recipient?: string
              p_research?: string
              p_review?: string
              p_salutation?: string
              p_scan?: string
              p_signature?: string
              p_sort?: string
              p_starred?: boolean
              p_subtype?: string
              p_tones?: string[]
              p_tstatus?: string
              p_type?: string
              p_uncertain?: boolean
              p_view?: string
            }
            Returns: {
              letter: Database["public"]["Tables"]["letters"]["Row"]
              total_count: number
            }[]
          }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "guest" | "archivist"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "guest", "archivist"],
    },
  },
} as const
