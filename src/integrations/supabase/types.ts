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
    PostgrestVersion: "14.17"
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
      edit_history: {
        Row: {
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
      letter_scans: {
        Row: {
          created_at: string
          file_label: string
          id: string
          image_type: string
          letter_id: string
          original_filename: string | null
          owner_id: string
          rotation: number
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_label: string
          id?: string
          image_type?: string
          letter_id: string
          original_filename?: string | null
          owner_id?: string
          rotation?: number
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_label?: string
          id?: string
          image_type?: string
          letter_id?: string
          original_filename?: string | null
          owner_id?: string
          rotation?: number
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_scans_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      letters: {
        Row: {
          archive_id: string
          author: string | null
          created_at: string
          date_as_written: string | null
          date_certainty: string
          date_precision: string
          destination: string | null
          fh_seq: number
          has_enclosures: boolean
          has_envelope: boolean
          id: string
          image_count: number
          normalized_date: string | null
          notes: string | null
          origin: string | null
          owner_id: string
          period: string
          physical_condition: string | null
          publication_status: string
          recipient: string | null
          research_needed: boolean
          review_status: string
          scan_status: string
          sheets: number | null
          summary_long: string | null
          summary_short: string | null
          transcription_raw_ai: string | null
          transcription_status: string
          transcription_verified: string | null
          updated_at: string
        }
        Insert: {
          archive_id: string
          author?: string | null
          created_at?: string
          date_as_written?: string | null
          date_certainty?: string
          date_precision?: string
          destination?: string | null
          fh_seq: number
          has_enclosures?: boolean
          has_envelope?: boolean
          id?: string
          image_count?: number
          normalized_date?: string | null
          notes?: string | null
          origin?: string | null
          owner_id?: string
          period?: string
          physical_condition?: string | null
          publication_status?: string
          recipient?: string | null
          research_needed?: boolean
          review_status?: string
          scan_status?: string
          sheets?: number | null
          summary_long?: string | null
          summary_short?: string | null
          transcription_raw_ai?: string | null
          transcription_status?: string
          transcription_verified?: string | null
          updated_at?: string
        }
        Update: {
          archive_id?: string
          author?: string | null
          created_at?: string
          date_as_written?: string | null
          date_certainty?: string
          date_precision?: string
          destination?: string | null
          fh_seq?: number
          has_enclosures?: boolean
          has_envelope?: boolean
          id?: string
          image_count?: number
          normalized_date?: string | null
          notes?: string | null
          origin?: string | null
          owner_id?: string
          period?: string
          physical_condition?: string | null
          publication_status?: string
          recipient?: string | null
          research_needed?: boolean
          review_status?: string
          scan_status?: string
          sheets?: number | null
          summary_long?: string | null
          summary_short?: string | null
          transcription_raw_ai?: string | null
          transcription_status?: string
          transcription_verified?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_letter: {
        Args: {
          p_author?: string
          p_date_as_written?: string
          p_date_certainty?: string
          p_date_precision?: string
          p_destination?: string
          p_has_enclosures?: boolean
          p_has_envelope?: boolean
          p_normalized_date?: string
          p_notes?: string
          p_origin?: string
          p_period?: string
          p_recipient?: string
          p_sheets?: number
        }
        Returns: {
          archive_id: string
          fh_seq: number
          id: string
        }[]
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
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
