export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      merchants: {
        Row: {
          active: boolean;
          area: string;
          business_type: string;
          category: string;
          created_at: string;
          id: string;
          image_url: string | null;
          name: string;
          owner_id: string | null;
          phone: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          area?: string;
          business_type?: string;
          category?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name: string;
          owner_id?: string | null;
          phone?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          area?: string;
          business_type?: string;
          category?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name?: string;
          owner_id?: string | null;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      merchant_campaigns: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          discount_type: string;
          discount_value: number;
          ends_at: string;
          id: string;
          maximum_discount_kes: number | null;
          merchant_id: string;
          minimum_order_kes: number;
          name: string;
          starts_at: string;
          updated_at: string;
          usage_limit: number | null;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          discount_type: string;
          discount_value: number;
          ends_at: string;
          id?: string;
          maximum_discount_kes?: number | null;
          merchant_id: string;
          minimum_order_kes?: number;
          name: string;
          starts_at?: string;
          updated_at?: string;
          usage_limit?: number | null;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          discount_type?: string;
          discount_value?: number;
          ends_at?: string;
          id?: string;
          maximum_discount_kes?: number | null;
          merchant_id?: string;
          minimum_order_kes?: number;
          name?: string;
          starts_at?: string;
          updated_at?: string;
          usage_limit?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_campaigns_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      merchant_campaign_redemptions: {
        Row: {
          campaign_id: string;
          code: string;
          created_at: string;
          customer_id: string | null;
          discount_kes: number;
          id: string;
          merchant_id: string;
          order_id: string;
        };
        Insert: {
          campaign_id: string;
          code: string;
          created_at?: string;
          customer_id?: string | null;
          discount_kes: number;
          id?: string;
          merchant_id: string;
          order_id: string;
        };
        Update: {
          campaign_id?: string;
          code?: string;
          created_at?: string;
          customer_id?: string | null;
          discount_kes?: number;
          id?: string;
          merchant_id?: string;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_campaign_redemptions_campaign_merchant_fkey";
            columns: ["campaign_id", "merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchant_campaigns";
            referencedColumns: ["id", "merchant_id"];
          },
          {
            foreignKeyName: "merchant_campaign_redemptions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      merchant_payout_requests: {
        Row: {
          amount_kes: number;
          created_at: string;
          currency: string;
          failure_reason: string | null;
          id: string;
          idempotency_key: string;
          merchant_id: string;
          processed_at: string | null;
          provider: string | null;
          provider_reference: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_kes: number;
          created_at?: string;
          currency?: string;
          failure_reason?: string | null;
          id?: string;
          idempotency_key: string;
          merchant_id: string;
          processed_at?: string | null;
          provider?: string | null;
          provider_reference?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_kes?: number;
          created_at?: string;
          currency?: string;
          failure_reason?: string | null;
          id?: string;
          idempotency_key?: string;
          merchant_id?: string;
          processed_at?: string | null;
          provider?: string | null;
          provider_reference?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_payout_requests_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price_kes: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity?: number;
          unit_price_kes?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price_kes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          assigned_at: string | null;
          campaign_id: string | null;
          created_at: string;
          customer_area: string;
          customer_id: string | null;
          customer_name: string;
          customer_phone: string;
          delivered_at: string | null;
          discount_kes: number;
          delivery_fee_kes: number;
          drop_lat: number;
          drop_lng: number;
          id: string;
          items_summary: string;
          merchant_id: string | null;
          merchant_name: string;
          payment_method: string;
          payment_status: string;
          pickup_area: string;
          pickup_lat: number;
          pickup_lng: number;
          rider_earning_kes: number;
          rider_id: string | null;
          rider_lat: number | null;
          rider_lng: number | null;
          service_fee_kes: number;
          status: string;
          total_kes: number;
          updated_at: string;
        };
        Insert: {
          assigned_at?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          customer_area: string;
          customer_id?: string | null;
          customer_name?: string;
          customer_phone?: string;
          delivered_at?: string | null;
          discount_kes?: number;
          delivery_fee_kes?: number;
          drop_lat: number;
          drop_lng: number;
          id: string;
          items_summary?: string;
          merchant_id?: string | null;
          merchant_name: string;
          payment_method?: string;
          payment_status?: string;
          pickup_area: string;
          pickup_lat: number;
          pickup_lng: number;
          rider_earning_kes?: number;
          rider_id?: string | null;
          rider_lat?: number | null;
          rider_lng?: number | null;
          service_fee_kes?: number;
          status?: string;
          total_kes?: number;
          updated_at?: string;
        };
        Update: {
          assigned_at?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          customer_area?: string;
          customer_id?: string | null;
          customer_name?: string;
          customer_phone?: string;
          delivered_at?: string | null;
          discount_kes?: number;
          delivery_fee_kes?: number;
          drop_lat?: number;
          drop_lng?: number;
          id?: string;
          items_summary?: string;
          merchant_id?: string | null;
          merchant_name?: string;
          payment_method?: string;
          payment_status?: string;
          pickup_area?: string;
          pickup_lat?: number;
          pickup_lng?: number;
          rider_earning_kes?: number;
          rider_id?: string | null;
          rider_lat?: number | null;
          rider_lng?: number | null;
          service_fee_kes?: number;
          status?: string;
          total_kes?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_campaign_merchant_fkey";
            columns: ["campaign_id", "merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchant_campaigns";
            referencedColumns: ["id", "merchant_id"];
          },
        ];
      };
      products: {
        Row: {
          active: boolean;
          category: string;
          created_at: string;
          id: string;
          image_url: string | null;
          merchant_id: string | null;
          name: string;
          price_kes: number;
          stock: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          merchant_id?: string | null;
          name: string;
          price_kes?: number;
          stock?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          merchant_id?: string | null;
          name?: string;
          price_kes?: number;
          stock?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      riders: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          lat: number | null;
          lng: number | null;
          online: boolean;
          phone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string;
          id: string;
          lat?: number | null;
          lng?: number | null;
          online?: boolean;
          phone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          online?: boolean;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rider_payout_requests: {
        Row: {
          amount_kes: number;
          created_at: string;
          currency: string;
          destination_phone: string;
          failure_reason: string | null;
          id: string;
          idempotency_key: string;
          processed_at: string | null;
          provider: string;
          provider_conversation_id: string | null;
          provider_originator_conversation_id: string | null;
          provider_transaction_id: string | null;
          rider_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_kes: number;
          created_at?: string;
          currency?: string;
          destination_phone: string;
          failure_reason?: string | null;
          id?: string;
          idempotency_key: string;
          processed_at?: string | null;
          provider?: string;
          provider_conversation_id?: string | null;
          provider_originator_conversation_id?: string | null;
          provider_transaction_id?: string | null;
          rider_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_kes?: number;
          created_at?: string;
          currency?: string;
          destination_phone?: string;
          failure_reason?: string | null;
          id?: string;
          idempotency_key?: string;
          processed_at?: string | null;
          provider?: string;
          provider_conversation_id?: string | null;
          provider_originator_conversation_id?: string | null;
          provider_transaction_id?: string | null;
          rider_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rider_payout_requests_rider_id_fkey";
            columns: ["rider_id"];
            isOneToOne: false;
            referencedRelation: "riders";
            referencedColumns: ["id"];
          },
        ];
      };
      support_tickets: {
        Row: {
          created_at: string;
          customer_name: string;
          customer_phone: string;
          id: string;
          notes: string;
          order_id: string | null;
          priority: string;
          status: string;
          subject: string;
          ticket_no: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_name?: string;
          customer_phone?: string;
          id?: string;
          notes?: string;
          order_id?: string | null;
          priority?: string;
          status?: string;
          subject: string;
          ticket_no?: never;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_name?: string;
          customer_phone?: string;
          id?: string;
          notes?: string;
          order_id?: string | null;
          priority?: string;
          status?: string;
          subject?: string;
          ticket_no?: never;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_set_rider_online: {
        Args: { _online: boolean; _rider_id: string };
        Returns: undefined;
      };
      admin_set_merchant_owner: {
        Args: { _merchant_id: string; _owner_email: string | null };
        Returns: undefined;
      };
      admin_customer_directory: {
        Args: {
          _limit: number;
          _min_orders: number;
          _offset: number;
          _search: string | null;
        };
        Returns: {
          area: string;
          customer_key: string;
          customer_name: string;
          customer_phone: string;
          last_order_at: string;
          order_count: number;
          paid_total_kes: number;
          total_count: number;
        }[];
      };
      admin_customer_order_history: {
        Args: { _customer_key: string; _limit: number; _offset: number };
        Returns: {
          created_at: string;
          customer_area: string;
          items_summary: string;
          merchant_name: string;
          order_id: string;
          payment_method: string;
          payment_status: string;
          status: string;
          total_count: number;
          total_kes: number;
        }[];
      };
      admin_update_order_status: {
        Args: { _order_id: string; _status: string };
        Returns: undefined;
      };
      accept_order: { Args: { order_id: string }; Returns: undefined };
      advance_order_status: { Args: { order_id: string }; Returns: string };
      advance_rider: { Args: { order_id: string }; Returns: undefined };
      confirm_delivery: {
        Args: { _code: string; _order_id: string };
        Returns: undefined;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      merchant_prepare_order: {
        Args: { _order_id: string; _status: string };
        Returns: undefined;
      };
      merchant_request_payout: {
        Args: { _amount_kes: number; _idempotency_key: string };
        Returns: string;
      };
      rider_request_mpesa_payout: {
        Args: { _amount_kes: number; _idempotency_key: string };
        Returns: string;
      };
      set_rider_online: {
        Args: { _online: boolean };
        Returns: undefined;
      };
      update_rider_location: {
        Args: { lat: number; lng: number };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const;
