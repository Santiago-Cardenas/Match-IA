export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      cta_clicks: {
        Row: {
          created_at: string
          event_name: string
          id: string
          pack: string | null
          referrer: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          pack?: string | null
          referrer?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          pack?: string | null
          referrer?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      demo_usage: {
        Row: {
          categoria: string
          created_at: string
          email: string
          id: string
          kind: string
        }
        Insert: {
          categoria: string
          created_at?: string
          email: string
          id?: string
          kind: string
        }
        Update: {
          categoria?: string
          created_at?: string
          email?: string
          id?: string
          kind?: string
        }
        Relationships: []
      }
      leads_test: {
        Row: {
          categoria_ganadora: string
          created_at: string
          email: string
          id: string
          nombre: string
          puntaje: Json
          referrer: string | null
          respuestas: Json
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          categoria_ganadora: string
          created_at?: string
          email: string
          id?: string
          nombre: string
          puntaje?: Json
          referrer?: string | null
          respuestas?: Json
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          categoria_ganadora?: string
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          puntaje?: Json
          referrer?: string | null
          respuestas?: Json
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      waitlist_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          main_use: string
          name: string
          pack: string
          referrer: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          main_use: string
          name: string
          pack: string
          referrer?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          main_use?: string
          name?: string
          pack?: string
          referrer?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
