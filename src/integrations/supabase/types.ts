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
      admin_wallet: {
        Row: {
          balance: number
          currency: string
          id: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          balance?: number
          currency?: string
          id?: string
          updated_at?: string
          wallet_id?: string
        }
        Update: {
          balance?: number
          currency?: string
          id?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: []
      }
      card_transactions: {
        Row: {
          amount: number
          callback_data: Json | null
          created_at: string | null
          currency: string | null
          id: string
          invoice_id: string | null
          reference: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          callback_data?: Json | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_id?: string | null
          reference?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          callback_data?: Json | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_id?: string | null
          reference?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          from_currency: string
          id: string
          rate: number
          to_currency: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          from_currency: string
          id?: string
          rate: number
          to_currency: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          from_currency?: string
          id?: string
          rate?: number
          to_currency?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_from_currency_fkey"
            columns: ["from_currency"]
            isOneToOne: false
            referencedRelation: "supported_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "exchange_rates_to_currency_fkey"
            columns: ["to_currency"]
            isOneToOne: false
            referencedRelation: "supported_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      global_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      mpesa_transactions: {
        Row: {
          amount: number
          callback_data: Json | null
          checkout_request_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          invoice_id: string | null
          merchant_request_id: string | null
          phone: string
          reference: string | null
          status: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          callback_data?: Json | null
          checkout_request_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          merchant_request_id?: string | null
          phone: string
          reference?: string | null
          status?: string
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          callback_data?: Json | null
          checkout_request_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          merchant_request_id?: string | null
          phone?: string
          reference?: string | null
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          code_hash: string
          created_at: string | null
          expires_at: string
          id: string
          phone: string
          purpose: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          code_hash: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone: string
          purpose?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          code_hash?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          full_name: string
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          otp_channel: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          full_name?: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          otp_channel?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          full_name?: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          otp_channel?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supported_currencies: {
        Row: {
          code: string
          country: string
          created_at: string
          flag_emoji: string
          is_active: boolean
          name: string
          symbol: string
        }
        Insert: {
          code: string
          country: string
          created_at?: string
          flag_emoji?: string
          is_active?: boolean
          name: string
          symbol: string
        }
        Update: {
          code?: string
          country?: string
          created_at?: string
          flag_emoji?: string
          is_active?: boolean
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      transaction_pins: {
        Row: {
          created_at: string
          failed_attempts: number
          hashed_pin: string
          id: string
          is_locked: boolean
          locked_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          hashed_pin: string
          id?: string
          is_locked?: boolean
          locked_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          hashed_pin?: string
          id?: string
          is_locked?: boolean
          locked_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          fee: number
          id: string
          receiver_wallet: string
          sender_wallet: string
          status: Database["public"]["Enums"]["transaction_status"]
          transaction_id: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          fee?: number
          id?: string
          receiver_wallet: string
          sender_wallet: string
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          fee?: number
          id?: string
          receiver_wallet?: string
          sender_wallet?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
          wallet_id?: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      charge_statement_fee: { Args: { p_wallet_id: string }; Returns: Json }
      generate_wallet_id: { Args: never; Returns: string }
      get_fee_rate: { Args: { p_type: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_wallet: { Args: { p_wallet_id: string }; Returns: Json }
      process_transfer: {
        Args: {
          p_amount: number
          p_description?: string
          p_fee?: number
          p_receiver_wallet: string
          p_sender_wallet: string
        }
        Returns: Json
      }
      set_transaction_pin: { Args: { p_pin: string }; Returns: Json }
      verify_transaction_pin: { Args: { p_pin: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      kyc_status: "pending" | "verified" | "rejected"
      transaction_status:
        | "success"
        | "pending"
        | "failed"
        | "processing"
        | "reversed"
      transaction_type:
        | "wallet_transfer"
        | "mobile_money"
        | "bank_transfer"
        | "deposit"
        | "withdrawal"
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
      app_role: ["admin", "moderator", "user"],
      kyc_status: ["pending", "verified", "rejected"],
      transaction_status: [
        "success",
        "pending",
        "failed",
        "processing",
        "reversed",
      ],
      transaction_type: [
        "wallet_transfer",
        "mobile_money",
        "bank_transfer",
        "deposit",
        "withdrawal",
      ],
    },
  },
} as const
