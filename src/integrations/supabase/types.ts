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
      test_sessions: {
        Row: {
          categoria_ganadora: string | null
          clic_continuar: boolean
          completado: boolean
          created_at: string
          demo_conversacion: Json
          demo_estado: string | null
          demo_prompts: number
          email: string | null
          gasto_cop: number
          gasto_usd: number
          herramienta_recomendada: string | null
          ias_pagadas: string[]
          id: string
          match_pct: number | null
          meses_sin_uso: number | null
          motivo_sin_pack: string | null
          nombre: string | null
          pack_elegido: string | null
          paso: string
          puntaje: Json | null
          referrer: string | null
          respuestas: Json
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          categoria_ganadora?: string | null
          clic_continuar?: boolean
          completado?: boolean
          created_at?: string
          demo_conversacion?: Json
          demo_estado?: string | null
          demo_prompts?: number
          email?: string | null
          gasto_cop?: number
          gasto_usd?: number
          herramienta_recomendada?: string | null
          ias_pagadas?: string[]
          id: string
          match_pct?: number | null
          meses_sin_uso?: number | null
          motivo_sin_pack?: string | null
          nombre?: string | null
          pack_elegido?: string | null
          paso?: string
          puntaje?: Json | null
          referrer?: string | null
          respuestas?: Json
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          categoria_ganadora?: string | null
          clic_continuar?: boolean
          completado?: boolean
          created_at?: string
          demo_conversacion?: Json
          demo_estado?: string | null
          demo_prompts?: number
          email?: string | null
          gasto_cop?: number
          gasto_usd?: number
          herramienta_recomendada?: string | null
          ias_pagadas?: string[]
          id?: string
          match_pct?: number | null
          meses_sin_uso?: number | null
          motivo_sin_pack?: string | null
          nombre?: string | null
          pack_elegido?: string | null
          paso?: string
          puntaje?: Json | null
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
      test_resultados: {
        Row: {
          id: string | null
          fecha: string | null
          paso: string | null
          completado: boolean | null
          ias_pagadas: string | null
          cantidad_ias: number | null
          meses_sin_uso: number | null
          gasto_usd: number | null
          gasto_cop: number | null
          clic_continuar: boolean | null
          uso_principal: string | null
          frecuencia: string | null
          presupuesto: string | null
          ecosistema: string | null
          imagen_video: string | null
          simplicidad: string | null
          categoria_ganadora: string | null
          herramienta_recomendada: string | null
          match_pct: number | null
          nombre: string | null
          email: string | null
          whatsapp: string | null
          demo_estado: string | null
          demo_prompts: number | null
          pack_elegido: string | null
          motivo_sin_pack: string | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          referrer: string | null
          demo_conversacion: Json | null
        }
        Relationships: []
      }
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
