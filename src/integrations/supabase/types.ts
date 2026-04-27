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
      academy_players: {
        Row: {
          age: number
          club_id: string
          created_at: string
          development_progress: number
          free_agent: boolean
          id: string
          name: string
          nationality: string | null
          position: string
          potential_max: number
          potential_min: number
          seasons_in_academy: number
          skill: number
        }
        Insert: {
          age: number
          club_id: string
          created_at?: string
          development_progress?: number
          free_agent?: boolean
          id?: string
          name: string
          nationality?: string | null
          position: string
          potential_max: number
          potential_min: number
          seasons_in_academy?: number
          skill?: number
        }
        Update: {
          age?: number
          club_id?: string
          created_at?: string
          development_progress?: number
          free_agent?: boolean
          id?: string
          name?: string
          nationality?: string | null
          position?: string
          potential_max?: number
          potential_min?: number
          seasons_in_academy?: number
          skill?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
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
          academy_scouting_count: number
          budget: number
          city: string | null
          created_at: string
          crest_url: string | null
          founded_year: number | null
          id: string
          jogos_por_temporada: number
          name: string
          nivel_base: number
          nivel_estadio: number
          owner_discord_id: string | null
          owner_id: string | null
          patrocinio_anual: number
          posicao_ultima_temporada: number | null
          preco_ingresso_internacional: number
          preco_ingresso_nacional: number
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
          academy_scouting_count?: number
          budget?: number
          city?: string | null
          created_at?: string
          crest_url?: string | null
          founded_year?: number | null
          id?: string
          jogos_por_temporada?: number
          name: string
          nivel_base?: number
          nivel_estadio?: number
          owner_discord_id?: string | null
          owner_id?: string | null
          patrocinio_anual?: number
          posicao_ultima_temporada?: number | null
          preco_ingresso_internacional?: number
          preco_ingresso_nacional?: number
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
          academy_scouting_count?: number
          budget?: number
          city?: string | null
          created_at?: string
          crest_url?: string | null
          founded_year?: number | null
          id?: string
          jogos_por_temporada?: number
          name?: string
          nivel_base?: number
          nivel_estadio?: number
          owner_discord_id?: string | null
          owner_id?: string | null
          patrocinio_anual?: number
          posicao_ultima_temporada?: number | null
          preco_ingresso_internacional?: number
          preco_ingresso_nacional?: number
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
      contratos_clube: {
        Row: {
          anos_duracao: number
          ativo: boolean
          categoria: Database["public"]["Enums"]["contrato_categoria"]
          club_id: string
          created_at: string
          empresa_id: string | null
          fim_temporada: number | null
          id: string
          inicio_temporada: number | null
          multa_rescisao: number | null
          observacoes: string | null
          updated_at: string
          valor_anual: number
        }
        Insert: {
          anos_duracao?: number
          ativo?: boolean
          categoria: Database["public"]["Enums"]["contrato_categoria"]
          club_id: string
          created_at?: string
          empresa_id?: string | null
          fim_temporada?: number | null
          id?: string
          inicio_temporada?: number | null
          multa_rescisao?: number | null
          observacoes?: string | null
          updated_at?: string
          valor_anual?: number
        }
        Update: {
          anos_duracao?: number
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["contrato_categoria"]
          club_id?: string
          created_at?: string
          empresa_id?: string | null
          fim_temporada?: number | null
          id?: string
          inicio_temporada?: number | null
          multa_rescisao?: number | null
          observacoes?: string | null
          updated_at?: string
          valor_anual?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_clube_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_clube_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativa: boolean
          categoria: Database["public"]["Enums"]["contrato_categoria"]
          created_at: string
          exigencias: string | null
          id: string
          logo_url: string | null
          nome: string
          updated_at: string
          valor_anual_sugerido: number
        }
        Insert: {
          ativa?: boolean
          categoria: Database["public"]["Enums"]["contrato_categoria"]
          created_at?: string
          exigencias?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          updated_at?: string
          valor_anual_sugerido?: number
        }
        Update: {
          ativa?: boolean
          categoria?: Database["public"]["Enums"]["contrato_categoria"]
          created_at?: string
          exigencias?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          updated_at?: string
          valor_anual_sugerido?: number
        }
        Relationships: []
      }
      players: {
        Row: {
          a_venda: boolean
          age: number | null
          attributes: Json
          club_id: string | null
          contrato_ate: number | null
          created_at: string
          habilidade: number | null
          id: string
          market_value: number
          name: string
          nationality: string | null
          position: string
          potential_max: number | null
          potential_min: number | null
          salario_atual: number
          updated_at: string
          valor_base_calculado: number
        }
        Insert: {
          a_venda?: boolean
          age?: number | null
          attributes?: Json
          club_id?: string | null
          contrato_ate?: number | null
          created_at?: string
          habilidade?: number | null
          id?: string
          market_value?: number
          name: string
          nationality?: string | null
          position: string
          potential_max?: number | null
          potential_min?: number | null
          salario_atual?: number
          updated_at?: string
          valor_base_calculado?: number
        }
        Update: {
          a_venda?: boolean
          age?: number | null
          attributes?: Json
          club_id?: string | null
          contrato_ate?: number | null
          created_at?: string
          habilidade?: number | null
          id?: string
          market_value?: number
          name?: string
          nationality?: string | null
          position?: string
          potential_max?: number | null
          potential_min?: number | null
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
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          value?: Json
        }
        Relationships: []
      }
      transferencias: {
        Row: {
          clube_comprador_id: string
          clube_vendedor_id: string
          created_at: string
          created_by: string | null
          duracao_emprestimo: number | null
          id: string
          jogador_id: string
          jogador_trocado_id: string | null
          luvas: number
          proposta_pai_id: string | null
          salario_ofertado: number
          status: Database["public"]["Enums"]["transfer_status"]
          tipo: Database["public"]["Enums"]["transfer_type"]
          updated_at: string
          valor_ofertado: number
        }
        Insert: {
          clube_comprador_id: string
          clube_vendedor_id: string
          created_at?: string
          created_by?: string | null
          duracao_emprestimo?: number | null
          id?: string
          jogador_id: string
          jogador_trocado_id?: string | null
          luvas?: number
          proposta_pai_id?: string | null
          salario_ofertado: number
          status?: Database["public"]["Enums"]["transfer_status"]
          tipo?: Database["public"]["Enums"]["transfer_type"]
          updated_at?: string
          valor_ofertado: number
        }
        Update: {
          clube_comprador_id?: string
          clube_vendedor_id?: string
          created_at?: string
          created_by?: string | null
          duracao_emprestimo?: number | null
          id?: string
          jogador_id?: string
          jogador_trocado_id?: string | null
          luvas?: number
          proposta_pai_id?: string | null
          salario_ofertado?: number
          status?: Database["public"]["Enums"]["transfer_status"]
          tipo?: Database["public"]["Enums"]["transfer_type"]
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
          {
            foreignKeyName: "transferencias_proposta_pai_id_fkey"
            columns: ["proposta_pai_id"]
            isOneToOne: false
            referencedRelation: "transferencias"
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
      ajustar_caixa_clubes: {
        Args: { _club_ids: string[]; _delta: number }
        Returns: number
      }
      criar_contraproposta: {
        Args: {
          _luvas: number
          _proposta_id: string
          _salario: number
          _valor: number
        }
        Returns: string
      }
      current_discord_id: { Args: never; Returns: string }
      get_owner_display_info: {
        Args: { _user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      premiacao_por_posicao: { Args: { _pos: number }; Returns: number }
      preview_season_turnover: {
        Args: never
        Returns: {
          bilheteria: number
          club_id: string
          club_name: string
          contratos: number
          delta: number
          folha: number
          manutencao: number
          novo_caixa: number
          premiacao: number
          receita_base: number
          reputacao: string
        }[]
      }
      process_season_turnover: {
        Args: never
        Returns: {
          club_id: string
          club_name: string
          delta: number
          novo_caixa: number
        }[]
      }
      promover_academia: {
        Args: { _academy_player_id: string }
        Returns: string
      }
      realizar_peneira: {
        Args: {
          _age_max: number
          _age_min: number
          _club_id: string
          _nationality: string
          _position: string
        }
        Returns: {
          scout_age: number
          scout_id: string
          scout_name: string
          scout_nationality: string
          scout_position: string
          scout_potential_max: number
          scout_potential_min: number
          scout_skill: number
        }[]
      }
      renovar_contrato_jogador: {
        Args: {
          _jogador_id: string
          _novo_salario: number
          _novos_anos: number
        }
        Returns: undefined
      }
      upgrade_estadio: {
        Args: {
          _club_id: string
          _nova_capacidade: number
          _novo_nivel: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      club_reputation: "estadual" | "nacional" | "continental" | "mundial"
      club_status: "ativo" | "inativo"
      contrato_categoria:
        | "patrocinio_master"
        | "material_esportivo"
        | "direitos_tv"
        | "socio_torcedor"
        | "fornecedora"
        | "master"
        | "secundario_central"
        | "omoplata"
        | "barra_frontal"
        | "barra_traseira"
        | "costas_superior"
        | "manga"
        | "lateral"
      transfer_status: "pendente" | "aceita" | "recusada" | "contraproposta"
      transfer_type: "compra" | "emprestimo" | "troca"
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
      contrato_categoria: [
        "patrocinio_master",
        "material_esportivo",
        "direitos_tv",
        "socio_torcedor",
        "fornecedora",
        "master",
        "secundario_central",
        "omoplata",
        "barra_frontal",
        "barra_traseira",
        "costas_superior",
        "manga",
        "lateral",
      ],
      transfer_status: ["pendente", "aceita", "recusada", "contraproposta"],
      transfer_type: ["compra", "emprestimo", "troca"],
    },
  },
} as const
