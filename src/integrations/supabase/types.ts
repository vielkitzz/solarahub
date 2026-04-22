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
      admin_discord_ids: {
        Row: {
          created_at: string
          discord_id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          discord_id: string
          note?: string | null
        }
        Update: {
          created_at?: string
          discord_id?: string
          note?: string | null
        }
        Relationships: []
      }
      clubs: {
        Row: {
          budget: number
          city: string | null
          created_at: string
          crest_url: string | null
          founded_year: number | null
          id: string
          name: string
          nivel_base: number
          nivel_estadio: number
          owner_discord_id: string | null
          owner_id: string | null
          patrocinio_anual: number
          posicao_ultima_temporada: number | null
          primary_color: string | null
          rate: number
          reputacao: Database["public"]["Enums"]["club_reputation"] | null
          stadium_capacity: number
          stadium_name: string | null
          status: Database["public"]["Enums"]["club_status"]
          updated_at: string
          wiki: Json
        }
        Insert: {
          budget?: number
          city?: string | null
          created_at?: string
          crest_url?: string | null
          founded_year?: number | null
          id?: string
          name: string
          nivel_base?: number
          nivel_estadio?: number
          owner_discord_id?: string | null
          owner_id?: string | null
          patrocinio_anual?: number
          posicao_ultima_temporada?: number | null
          primary_color?: string | null
          rate?: number
          reputacao?: Database["public"]["Enums"]["club_reputation"] | null
          stadium_capacity?: number
          stadium_name?: string | null
          status?: Database["public"]["Enums"]["club_status"]
          updated_at?: string
          wiki?: Json
        }
        Update: {
          budget?: number
          city?: string | null
          created_at?: string
          crest_url?: string | null
          founded_year?: number | null
          id?: string
          name?: string
          nivel_base?: number
          nivel_estadio?: number
          owner_discord_id?: string | null
          owner_id?: string | null
          patrocinio_anual?: number
          posicao_ultima_temporada?: number | null
          primary_color?: string | null
          rate?: number
          reputacao?: Database["public"]["Enums"]["club_reputation"] | null
          stadium_capacity?: number
          stadium_name?: string | null
          status?: Database["public"]["Enums"]["club_status"]
          updated_at?: string
          wiki?: Json
        }
        Relationships: []
      }
      players: {
        Row: {
          age: number | null
          attributes: Json
          club_id: string | null
          created_at: string
          id: string
          market_value: number
          name: string
          nationality: string | null
          overall: number | null
          position: string
          salario_atual: number
          updated_at: string
          valor_base_calculado: number
        }
        Insert: {
          age?: number | null
          attributes?: Json
          club_id?: string | null
          created_at?: string
          id?: string
          market_value?: number
          name: string
          nationality?: string | null
          overall?: number | null
          position: string
          salario_atual?: number
          updated_at?: string
          valor_base_calculado?: number
        }
        Update: {
          age?: number | null
          attributes?: Json
          club_id?: string | null
          created_at?: string
          id?: string
          market_value?: number
          name?: string
          nationality?: string | null
          overall?: number | null
          position?: string
          salario_atual?: number
          updated_at?: string
          valor_base_calculado?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          club_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          type: string
        }
        Insert: {
          amount: number
          category?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias: {
        Row: {
          clube_comprador_id: string
          clube_vendedor_id: string
          created_at: string
          created_by: string | null
          id: string
          jogador_id: string
          luvas: number
          salario_ofertado: number
          status: Database["public"]["Enums"]["transfer_status"]
          updated_at: string
          valor_ofertado: number
        }
        Insert: {
          clube_comprador_id: string
          clube_vendedor_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          jogador_id: string
          luvas?: number
          salario_ofertado: number
          status?: Database["public"]["Enums"]["transfer_status"]
          updated_at?: string
          valor_ofertado: number
        }
        Update: {
          clube_comprador_id?: string
          clube_vendedor_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          jogador_id?: string
          luvas?: number
          salario_ofertado?: number
          status?: Database["public"]["Enums"]["transfer_status"]
          updated_at?: string
          valor_ofertado?: number
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_clube_comprador_id_fkey"
            columns: ["clube_comprador_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_clube_vendedor_id_fkey"
            columns: ["clube_vendedor_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_jogador_id_fkey"
            columns: ["jogador_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          discord_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          discord_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          discord_id?: string | null
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
      accept_transfer: { Args: { _transfer_id: string }; Returns: undefined }
      current_discord_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      premiacao_por_posicao: { Args: { _pos: number }; Returns: number }
      process_season_turnover: {
        Args: never
        Returns: {
          club_id: string
          club_name: string
          delta: number
          novo_caixa: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      club_reputation: "estadual" | "nacional" | "continental" | "mundial"
      club_status: "ativo" | "inativo"
      transfer_status: "pendente" | "aceita" | "recusada"
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
      app_role: ["admin", "user"],
      club_reputation: ["estadual", "nacional", "continental", "mundial"],
      club_status: ["ativo", "inativo"],
      transfer_status: ["pendente", "aceita", "recusada"],
    },
  },
} as const
