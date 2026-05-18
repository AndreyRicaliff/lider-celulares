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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      atendimentos_audit: {
        Row: {
          alertas_preco: number | null
          atendimento_id: string
          created_at: string | null
          data_atendimento: string
          detalhes_brutos: Json
          id: string
          loja_id: string
          mes: string
          status: string | null
          valor_total: number
          vendedor_nome: string
        }
        Insert: {
          alertas_preco?: number | null
          atendimento_id: string
          created_at?: string | null
          data_atendimento: string
          detalhes_brutos?: Json
          id?: string
          loja_id: string
          mes: string
          status?: string | null
          valor_total?: number
          vendedor_nome: string
        }
        Update: {
          alertas_preco?: number | null
          atendimento_id?: string
          created_at?: string | null
          data_atendimento?: string
          detalhes_brutos?: Json
          id?: string
          loja_id?: string
          mes?: string
          status?: string | null
          valor_total?: number
          vendedor_nome?: string
        }
        Relationships: []
      }
      botons: {
        Row: {
          colaborador_id: string
          created_at: string
          id: string
          loja_id: string
          mes: string
          pontos: number
          tipo: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          id?: string
          loja_id: string
          mes: string
          pontos: number
          tipo: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          id?: string
          loja_id?: string
          mes?: string
          pontos?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "botons_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_lojas: {
        Row: {
          ajuda_custo: number
          cargo: Database["public"]["Enums"]["cargo_tipo"]
          colaborador_id: string
          created_at: string
          id: string
          loja_id: string
          proporcional_meta: number | null
          salario: number
          updated_at: string
        }
        Insert: {
          ajuda_custo?: number
          cargo?: Database["public"]["Enums"]["cargo_tipo"]
          colaborador_id: string
          created_at?: string
          id?: string
          loja_id: string
          proporcional_meta?: number | null
          salario?: number
          updated_at?: string
        }
        Update: {
          ajuda_custo?: number
          cargo?: Database["public"]["Enums"]["cargo_tipo"]
          colaborador_id?: string
          created_at?: string
          id?: string
          loja_id?: string
          proporcional_meta?: number | null
          salario?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_lojas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_lojas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          acesso_gerente: boolean
          ajuda_custo: number
          cargo: Database["public"]["Enums"]["cargo_tipo"]
          created_at: string
          id: string
          loja_id: string | null
          nome: string
          proporcional_meta: number | null
          salario: number
          updated_at: string
        }
        Insert: {
          acesso_gerente?: boolean
          ajuda_custo?: number
          cargo?: Database["public"]["Enums"]["cargo_tipo"]
          created_at?: string
          id?: string
          loja_id?: string | null
          nome: string
          proporcional_meta?: number | null
          salario?: number
          updated_at?: string
        }
        Update: {
          acesso_gerente?: boolean
          ajuda_custo?: number
          cargo?: Database["public"]["Enums"]["cargo_tipo"]
          created_at?: string
          id?: string
          loja_id?: string | null
          nome?: string
          proporcional_meta?: number | null
          salario?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          adiantamentos: number
          ajuda_custo: number
          bonus_automatico: number
          bonus_manual: number
          cargo: string
          colaborador_id: string | null
          comissao_base: number
          comissao_detalhada: Json
          created_at: string
          descontos: number
          descontos_dividas: number
          detalhes: Json
          id: string
          loja_id: string
          mes: string
          repostagem_comissao: number
          repostagem_venda: number
          salario: number
          updated_at: string
          vendedor_nome: string
        }
        Insert: {
          adiantamentos?: number
          ajuda_custo?: number
          bonus_automatico?: number
          bonus_manual?: number
          cargo: string
          colaborador_id?: string | null
          comissao_base?: number
          comissao_detalhada?: Json
          created_at?: string
          descontos?: number
          descontos_dividas?: number
          detalhes?: Json
          id?: string
          loja_id: string
          mes: string
          repostagem_comissao?: number
          repostagem_venda?: number
          salario?: number
          updated_at?: string
          vendedor_nome: string
        }
        Update: {
          adiantamentos?: number
          ajuda_custo?: number
          bonus_automatico?: number
          bonus_manual?: number
          cargo?: string
          colaborador_id?: string | null
          comissao_base?: number
          comissao_detalhada?: Json
          created_at?: string
          descontos?: number
          descontos_dividas?: number
          detalhes?: Json
          id?: string
          loja_id?: string
          mes?: string
          repostagem_comissao?: number
          repostagem_venda?: number
          salario?: number
          updated_at?: string
          vendedor_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          config: Json
          created_at: string
          id: string
          loja_id: string
          mes: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          loja_id: string
          mes: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          loja_id?: string
          mes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      dividas: {
        Row: {
          colaborador_id: string
          created_at: string
          descricao: string
          id: string
          loja_id: string | null
          mes_inicio: string
          parcelas_pagas: number
          parcelas_totais: number
          valor_total: number
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          descricao: string
          id?: string
          loja_id?: string | null
          mes_inicio: string
          parcelas_pagas?: number
          parcelas_totais: number
          valor_total: number
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          descricao?: string
          id?: string
          loja_id?: string | null
          mes_inicio?: string
          parcelas_pagas?: number
          parcelas_totais?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "dividas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          created_at: string
          id: string
          nome: string
          tenfront_api_key: string | null
          tenfront_bearer_token: string | null
          tenfront_consumer_key: string | null
          tenfront_consumer_secret: string | null
          tenfront_stock_token: string | null
        }
        Insert: {
          created_at?: string
          id: string
          nome: string
          tenfront_api_key?: string | null
          tenfront_bearer_token?: string | null
          tenfront_consumer_key?: string | null
          tenfront_consumer_secret?: string | null
          tenfront_stock_token?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          tenfront_api_key?: string | null
          tenfront_bearer_token?: string | null
          tenfront_consumer_key?: string | null
          tenfront_consumer_secret?: string | null
          tenfront_stock_token?: string | null
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          lido: boolean
          loja_id: string
          mes: string
          sem_colaborador: string[]
          source_rows: number
          success: boolean
          synced: number
          vendedores_atualizados: string[]
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          lido?: boolean
          loja_id: string
          mes: string
          sem_colaborador?: string[]
          source_rows?: number
          success?: boolean
          synced?: number
          vendedores_atualizados?: string[]
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          lido?: boolean
          loja_id?: string
          mes?: string
          sem_colaborador?: string[]
          source_rows?: number
          success?: boolean
          synced?: number
          vendedores_atualizados?: string[]
        }
        Relationships: []
      }
      tabela_precos: {
        Row: {
          created_at: string | null
          desconto_livre: number | null
          desconto_servico: number | null
          id: string
          memoria: string | null
          modelo: string
          preco_tabela: number
          regiao: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          desconto_livre?: number | null
          desconto_servico?: number | null
          id?: string
          memoria?: string | null
          modelo: string
          preco_tabela: number
          regiao?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          desconto_livre?: number | null
          desconto_servico?: number | null
          id?: string
          memoria?: string | null
          modelo?: string
          preco_tabela?: number
          regiao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          colaborador_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          colaborador_id: string | null
          created_at: string
          detalhes: Json
          geral: number | null
          id: string
          loja_id: string
          mes: string
          valor_total: number
          vendedor_nome: string
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string
          detalhes?: Json
          geral?: number | null
          id?: string
          loja_id: string
          mes: string
          valor_total?: number
          vendedor_nome: string
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string
          detalhes?: Json
          geral?: number | null
          id?: string
          loja_id?: string
          mes?: string
          valor_total?: number
          vendedor_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_diarias: {
        Row: {
          acessorios: number
          colaborador_id: string | null
          created_at: string
          data: string
          detalhes: Json
          geral: number | null
          id: string
          loja_id: string
          mes: string
          servicos: number
          smartphones: number
          valor_total: number
          vendedor_nome: string
        }
        Insert: {
          acessorios?: number
          colaborador_id?: string | null
          created_at?: string
          data: string
          detalhes?: Json
          geral?: number | null
          id?: string
          loja_id: string
          mes: string
          servicos?: number
          smartphones?: number
          valor_total?: number
          vendedor_nome: string
        }
        Update: {
          acessorios?: number
          colaborador_id?: string | null
          created_at?: string
          data?: string
          detalhes?: Json
          geral?: number | null
          id?: string
          loja_id?: string
          mes?: string
          servicos?: number
          smartphones?: number
          valor_total?: number
          vendedor_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_diarias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedor_bloqueios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          loja_id_bloqueada: string
          vendedor_nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          loja_id_bloqueada: string
          vendedor_nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          loja_id_bloqueada?: string
          vendedor_nome?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_colaborador_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "colaborador" | "supervisao"
      cargo_tipo: "Gerente" | "Vendedor" | "VR" | "Trainee" | "Supervisor"
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
      app_role: ["admin", "colaborador", "supervisao"],
      cargo_tipo: ["Gerente", "Vendedor", "VR", "Trainee", "Supervisor"],
    },
  },
} as const
