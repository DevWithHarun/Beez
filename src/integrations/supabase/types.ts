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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_migration_runs: {
        Row: {
          applied_at: string
          migration_id: string
        }
        Insert: {
          applied_at?: string
          migration_id: string
        }
        Update: {
          applied_at?: string
          migration_id?: string
        }
        Relationships: []
      }
      customer_cart_items: {
        Row: {
          customer_id: string
          product_id: string
          quantity: number
          unit_price_kes: number
          updated_at: string
        }
        Insert: {
          customer_id: string
          product_id: string
          quantity: number
          unit_price_kes: number
          updated_at?: string
        }
        Update: {
          customer_id?: string
          product_id?: string
          quantity?: number
          unit_price_kes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notifications: {
        Row: {
          attempts: number
          created_at: string
          customer_id: string | null
          details: Json
          id: string
          kind: string
          last_error: string | null
          next_attempt_at: string
          order_id: string
          phone: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          customer_id?: string | null
          details?: Json
          id?: string
          kind: string
          last_error?: string | null
          next_attempt_at?: string
          order_id: string
          phone?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          customer_id?: string | null
          details?: Json
          id?: string
          kind?: string
          last_error?: string | null
          next_attempt_at?: string
          order_id?: string
          phone?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_session_windows: {
        Row: {
          ip_hash: string
          request_count: number
          window_started_at: string
        }
        Insert: {
          ip_hash: string
          request_count?: number
          window_started_at?: string
        }
        Update: {
          ip_hash?: string
          request_count?: number
          window_started_at?: string
        }
        Relationships: []
      }
      merchant_campaign_redemptions: {
        Row: {
          campaign_id: string
          code: string
          created_at: string
          customer_id: string | null
          discount_kes: number
          id: string
          merchant_id: string
          order_id: string
        }
        Insert: {
          campaign_id: string
          code: string
          created_at?: string
          customer_id?: string | null
          discount_kes: number
          id?: string
          merchant_id: string
          order_id: string
        }
        Update: {
          campaign_id?: string
          code?: string
          created_at?: string
          customer_id?: string | null
          discount_kes?: number
          id?: string
          merchant_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_campaign_redemptions_campaign_merchant_fkey"
            columns: ["campaign_id", "merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_campaigns"
            referencedColumns: ["id", "merchant_id"]
          },
          {
            foreignKeyName: "merchant_campaign_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_campaigns: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string
          id: string
          maximum_discount_kes: number | null
          merchant_id: string
          minimum_order_kes: number
          name: string
          starts_at: string
          updated_at: string
          usage_limit: number | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          ends_at: string
          id?: string
          maximum_discount_kes?: number | null
          merchant_id: string
          minimum_order_kes?: number
          name: string
          starts_at?: string
          updated_at?: string
          usage_limit?: number | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string
          id?: string
          maximum_discount_kes?: number | null
          merchant_id?: string
          minimum_order_kes?: number
          name?: string
          starts_at?: string
          updated_at?: string
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_campaigns_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payout_requests: {
        Row: {
          amount_kes: number
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          merchant_id: string
          processed_at: string | null
          provider: string | null
          provider_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          merchant_id: string
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          merchant_id?: string
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payout_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          active: boolean
          area: string
          business_type: string
          category: string
          created_at: string
          id: string
          image_url: string | null
          is_open: boolean
          latitude: number | null
          longitude: number | null
          name: string
          owner_id: string | null
          phone: string
          slug: string | null
          updated_at: string
          video_duration: number | null
          video_path: string | null
          video_reject_reason: string | null
          video_review_status: string
          video_reviewed_at: string | null
          video_reviewed_by: string | null
          video_size_bytes: number | null
          video_status: string
          video_thumb_path: string | null
          video_thumb_url: string | null
          video_updated_at: string | null
          video_url: string | null
        }
        Insert: {
          active?: boolean
          area?: string
          business_type?: string
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_open?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          owner_id?: string | null
          phone?: string
          slug?: string | null
          updated_at?: string
          video_duration?: number | null
          video_path?: string | null
          video_reject_reason?: string | null
          video_review_status?: string
          video_reviewed_at?: string | null
          video_reviewed_by?: string | null
          video_size_bytes?: number | null
          video_status?: string
          video_thumb_path?: string | null
          video_thumb_url?: string | null
          video_updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          active?: boolean
          area?: string
          business_type?: string
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_open?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          owner_id?: string | null
          phone?: string
          slug?: string | null
          updated_at?: string
          video_duration?: number | null
          video_path?: string | null
          video_reject_reason?: string | null
          video_review_status?: string
          video_reviewed_at?: string | null
          video_reviewed_by?: string | null
          video_size_bytes?: number | null
          video_status?: string
          video_thumb_path?: string | null
          video_thumb_url?: string | null
          video_updated_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      mpesa_payments: {
        Row: {
          amount_kes: number
          checkout_request_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          merchant_request_id: string | null
          order_id: string
          phone: string
          receipt: string | null
          result_code: number | null
          result_desc: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_kes: number
          checkout_request_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          merchant_request_id?: string | null
          order_id: string
          phone: string
          receipt?: string | null
          result_code?: number | null
          result_desc?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kes?: number
          checkout_request_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          merchant_request_id?: string | null
          order_id?: string
          phone?: string
          receipt?: string | null
          result_code?: number | null
          result_desc?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          channel: string
          created_at: string
          details: Json
          event_type: string
          id: string
          merchant_id: string | null
          order_id: string
          request_id: string | null
        }
        Insert: {
          actor_id?: string | null
          channel?: string
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          merchant_id?: string | null
          order_id: string
          request_id?: string | null
        }
        Update: {
          actor_id?: string | null
          channel?: string
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          merchant_id?: string | null
          order_id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_handover_codes: {
        Row: {
          created_at: string
          failed_attempts: number
          kind: string
          nonce: string
          order_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          kind: string
          nonce: string
          order_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          kind?: string
          nonce?: string
          order_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_handover_codes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price_kes: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price_kes?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price_kes?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refunds: {
        Row: {
          admin_note: string | null
          amount_kes: number
          created_at: string
          customer_id: string | null
          destination_phone: string | null
          failure_reason: string | null
          handled_by: string | null
          id: string
          method: string | null
          mpesa_reference: string | null
          order_id: string
          processed_at: string | null
          provider_conversation_id: string | null
          provider_originator_conversation_id: string | null
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount_kes: number
          created_at?: string
          customer_id?: string | null
          destination_phone?: string | null
          failure_reason?: string | null
          handled_by?: string | null
          id?: string
          method?: string | null
          mpesa_reference?: string | null
          order_id: string
          processed_at?: string | null
          provider_conversation_id?: string | null
          provider_originator_conversation_id?: string | null
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount_kes?: number
          created_at?: string
          customer_id?: string | null
          destination_phone?: string | null
          failure_reason?: string | null
          handled_by?: string | null
          id?: string
          method?: string | null
          mpesa_reference?: string | null
          order_id?: string
          processed_at?: string | null
          provider_conversation_id?: string | null
          provider_originator_conversation_id?: string | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_response_policy: {
        Row: {
          id: boolean
          merchant_response_seconds: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          merchant_response_seconds?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          merchant_response_seconds?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      order_settlements: {
        Row: {
          cash_collected_kes: number
          merchant_amount_kes: number
          merchant_id: string | null
          order_id: string
          rider_amount_kes: number
          rider_id: string | null
          settled_at: string
          trip_km: number
        }
        Insert: {
          cash_collected_kes?: number
          merchant_amount_kes?: number
          merchant_id?: string | null
          order_id: string
          rider_amount_kes?: number
          rider_id?: string | null
          settled_at?: string
          trip_km?: number
        }
        Update: {
          cash_collected_kes?: number
          merchant_amount_kes?: number
          merchant_id?: string | null
          order_id?: string
          rider_amount_kes?: number
          rider_id?: string | null
          settled_at?: string
          trip_km?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_settlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          created_at: string
          id: string
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_at: string | null
          campaign_id: string | null
          created_at: string
          customer_area: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_fee_kes: number
          delivery_instructions: string | null
          discount_kes: number
          drop_lat: number
          drop_lng: number
          id: string
          items_summary: string
          merchant_decline_reason: string | null
          merchant_id: string | null
          merchant_name: string
          merchant_responded_at: string | null
          merchant_response: string
          merchant_response_deadline: string | null
          merchant_response_via: string | null
          payment_method: string
          payment_status: string
          pickup_area: string
          pickup_lat: number
          pickup_lng: number
          rider_earning_kes: number
          rider_arrived_at: string | null
          rider_heading: number | null
          rider_id: string | null
          rider_lat: number | null
          rider_lng: number | null
          rider_location_at: string | null
          service_fee_kes: number
          status: string
          total_kes: number
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          campaign_id?: string | null
          created_at?: string
          customer_area: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_fee_kes?: number
          delivery_instructions?: string | null
          discount_kes?: number
          drop_lat: number
          drop_lng: number
          id: string
          items_summary?: string
          merchant_decline_reason?: string | null
          merchant_id?: string | null
          merchant_name: string
          merchant_responded_at?: string | null
          merchant_response?: string
          merchant_response_deadline?: string | null
          merchant_response_via?: string | null
          payment_method?: string
          payment_status?: string
          pickup_area: string
          pickup_lat: number
          pickup_lng: number
          rider_earning_kes?: number
          rider_arrived_at?: string | null
          rider_heading?: number | null
          rider_id?: string | null
          rider_lat?: number | null
          rider_lng?: number | null
          rider_location_at?: string | null
          service_fee_kes?: number
          status?: string
          total_kes?: number
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          campaign_id?: string | null
          created_at?: string
          customer_area?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_fee_kes?: number
          delivery_instructions?: string | null
          discount_kes?: number
          drop_lat?: number
          drop_lng?: number
          id?: string
          items_summary?: string
          merchant_decline_reason?: string | null
          merchant_id?: string | null
          merchant_name?: string
          merchant_responded_at?: string | null
          merchant_response?: string
          merchant_response_deadline?: string | null
          merchant_response_via?: string | null
          payment_method?: string
          payment_status?: string
          pickup_area?: string
          pickup_lat?: number
          pickup_lng?: number
          rider_earning_kes?: number
          rider_arrived_at?: string | null
          rider_heading?: number | null
          rider_id?: string | null
          rider_lat?: number | null
          rider_lng?: number | null
          rider_location_at?: string | null
          service_fee_kes?: number
          status?: string
          total_kes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_campaign_merchant_fkey"
            columns: ["campaign_id", "merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_campaigns"
            referencedColumns: ["id", "merchant_id"]
          },
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_studio_request_windows: {
        Row: {
          request_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          request_count?: number
          user_id: string
          window_started_at?: string
        }
        Update: {
          request_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      product_media: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          id: string
          instruction: string | null
          kind: string
          merchant_id: string
          model: string | null
          origin: string
          product_id: string | null
          public_url: string
          source_media_id: string | null
          status: string
          storage_path: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          instruction?: string | null
          kind: string
          merchant_id: string
          model?: string | null
          origin: string
          product_id?: string | null
          public_url: string
          source_media_id?: string | null
          status?: string
          storage_path: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          instruction?: string | null
          kind?: string
          merchant_id?: string
          model?: string | null
          origin?: string
          product_id?: string | null
          public_url?: string
          source_media_id?: string | null
          status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_source_media_id_fkey"
            columns: ["source_media_id"]
            isOneToOne: false
            referencedRelation: "product_media"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          media_id: string
          merchant_id: string
        }
        Insert: {
          action: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          media_id: string
          merchant_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          media_id?: string
          merchant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_events_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "product_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reel_videos: {
        Row: {
          duration_sec: number
          merchant_id: string
          product_id: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number
          status: string
          submitted_at: string
          thumb_path: string
          thumb_url: string
          updated_at: string
          video_path: string
          video_url: string
        }
        Insert: {
          duration_sec: number
          merchant_id: string
          product_id: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes: number
          status?: string
          submitted_at?: string
          thumb_path: string
          thumb_url: string
          updated_at?: string
          video_path: string
          video_url: string
        }
        Update: {
          duration_sec?: number
          merchant_id?: string
          product_id?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number
          status?: string
          submitted_at?: string
          thumb_path?: string
          thumb_url?: string
          updated_at?: string
          video_path?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reel_videos_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reel_videos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          clip_duration: number | null
          clip_thumb_url: string | null
          clip_url: string | null
          created_at: string
          description: string | null
          id: string
          image_media_id: string | null
          image_origin: string | null
          image_url: string | null
          merchant_id: string | null
          name: string
          pinned: boolean
          price_kes: number
          reel_hidden: boolean
          reel_position: number | null
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          clip_duration?: number | null
          clip_thumb_url?: string | null
          clip_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_media_id?: string | null
          image_origin?: string | null
          image_url?: string | null
          merchant_id?: string | null
          name: string
          pinned?: boolean
          price_kes?: number
          reel_hidden?: boolean
          reel_position?: number | null
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          clip_duration?: number | null
          clip_thumb_url?: string | null
          clip_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_media_id?: string | null
          image_origin?: string | null
          image_url?: string | null
          merchant_id?: string | null
          name?: string
          pinned?: boolean
          price_kes?: number
          reel_hidden?: boolean
          reel_position?: number | null
          stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_image_media_id_fkey"
            columns: ["image_media_id"]
            isOneToOne: false
            referencedRelation: "product_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_events: {
        Row: {
          created_at: string
          event: string
          id: string
          merchant_id: string
          product_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          merchant_id: string
          product_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          merchant_id?: string
          product_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reel_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reel_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_payout_requests: {
        Row: {
          amount_kes: number
          created_at: string
          currency: string
          destination_phone: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          processed_at: string | null
          provider: string
          provider_conversation_id: string | null
          provider_originator_conversation_id: string | null
          provider_transaction_id: string | null
          rider_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          currency?: string
          destination_phone: string
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          processed_at?: string | null
          provider?: string
          provider_conversation_id?: string | null
          provider_originator_conversation_id?: string | null
          provider_transaction_id?: string | null
          rider_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          currency?: string
          destination_phone?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          processed_at?: string | null
          provider?: string
          provider_conversation_id?: string | null
          provider_originator_conversation_id?: string | null
          provider_transaction_id?: string | null
          rider_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_payout_requests_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          created_at: string
          full_name: string
          heading: number | null
          id: string
          lat: number | null
          lng: number | null
          location_at: string | null
          online: boolean
          online_since: string | null
          phone: string
          plate: string | null
          speed_mps: number | null
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          heading?: number | null
          id: string
          lat?: number | null
          lng?: number | null
          location_at?: string | null
          online?: boolean
          online_since?: string | null
          phone?: string
          plate?: string | null
          speed_mps?: number | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          heading?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_at?: string | null
          online?: boolean
          online_since?: string | null
          phone?: string
          plate?: string | null
          speed_mps?: number | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          notes: string
          order_id: string | null
          priority: string
          status: string
          subject: string
          ticket_no: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string
          order_id?: string | null
          priority?: string
          status?: string
          subject: string
          ticket_no?: never
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string
          order_id?: string | null
          priority?: string
          status?: string
          subject?: string
          ticket_no?: never
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
      video_review_log: {
        Row: {
          actor_id: string | null
          created_at: string
          decision: string
          id: string
          kind: string
          merchant_id: string
          product_id: string | null
          reason: string | null
          video_path: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          decision: string
          id?: string
          kind: string
          merchant_id: string
          product_id?: string | null
          reason?: string | null
          video_path?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          decision?: string
          id?: string
          kind?: string
          merchant_id?: string
          product_id?: string | null
          reason?: string | null
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_review_log_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_review_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_product_request_windows: {
        Row: {
          request_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          request_count?: number
          user_id: string
          window_started_at?: string
        }
        Update: {
          request_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_order: { Args: { order_id: string }; Returns: undefined }
      admin_approve_shop_videos: {
        Args: { _merchant_id: string }
        Returns: number
      }
      admin_begin_refund_payout: { Args: { _refund_id: string }; Returns: Json }
      admin_customer_directory: {
        Args: {
          _limit: number
          _min_orders: number
          _offset: number
          _search: string
        }
        Returns: {
          area: string
          customer_key: string
          customer_name: string
          customer_phone: string
          last_order_at: string
          order_count: number
          paid_total_kes: number
          total_count: number
        }[]
      }
      admin_customer_order_history: {
        Args: { _customer_key: string; _limit: number; _offset: number }
        Returns: {
          created_at: string
          customer_area: string
          items_summary: string
          merchant_name: string
          order_id: string
          payment_method: string
          payment_status: string
          status: string
          total_count: number
          total_kes: number
        }[]
      }
      admin_record_manual_refund: {
        Args: { _reference: string; _refund_id: string }
        Returns: undefined
      }
      admin_reel_stats: {
        Args: { _days?: number }
        Returns: {
          adds: number
          intro_views: number
          merchant_id: string
          merchant_name: string
          product_id: string
          product_name: string
          shares: number
          shop_visits: number
          views: number
        }[]
      }
      admin_reject_refund: {
        Args: { _note: string; _refund_id: string }
        Returns: undefined
      }
      admin_review_merchant_video: {
        Args: { _decision: string; _merchant_id: string }
        Returns: undefined
      }
      admin_review_video: {
        Args: {
          _decision: string
          _kind: string
          _reason?: string
          _target: string
        }
        Returns: undefined
      }
      admin_set_merchant_owner: {
        Args: { _merchant_id: string; _owner_email: string }
        Returns: undefined
      }
      admin_set_rider_online: {
        Args: { _online: boolean; _rider_id: string }
        Returns: undefined
      }
      admin_update_order_status: {
        Args: { _order_id: string; _status: string }
        Returns: undefined
      }
      advance_order_status: { Args: { order_id: string }; Returns: string }
      advance_rider: { Args: { order_id: string }; Returns: undefined }
      approve_product_media: {
        Args: { _media_id: string; _product_id: string }
        Returns: string
      }
      beez_kenyan_msisdn: { Args: { _phone: string }; Returns: string }
      claim_customer_notifications: {
        Args: { _limit?: number }
        Returns: {
          attempts: number
          created_at: string
          customer_id: string | null
          details: Json
          id: string
          kind: string
          last_error: string | null
          next_attempt_at: string
          order_id: string
          phone: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "customer_notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_order_refund_internal: {
        Args: {
          _actor: string
          _method: string
          _reference: string
          _refund_id: string
        }
        Returns: undefined
      }
      confirm_delivery: {
        Args: { _code: string; _order_id: string }
        Returns: undefined
      }
      consume_guest_session: { Args: { _ip_hash: string }; Returns: boolean }
      consume_photo_studio_request: { Args: never; Returns: boolean }
      consume_voice_product_request: {
        Args: { _user_id: string }
        Returns: boolean
      }
      customer_pay_cash_instead: {
        Args: { _order_id: string }
        Returns: undefined
      }
      expire_overdue_merchant_responses: { Args: never; Returns: number }
      finish_customer_notification: {
        Args: {
          _error?: string
          _id: string
          _ok: boolean
          _provider_message_id?: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      merchant_prepare_order: {
        Args: { _order_id: string; _status: string }
        Returns: undefined
      }
      merchant_reel_reorder: {
        Args: { _product_ids: string[] }
        Returns: undefined
      }
      merchant_reel_set_hidden: {
        Args: { _hidden: boolean; _product_id: string }
        Returns: undefined
      }
      merchant_reel_video_publish: {
        Args: {
          _duration: number
          _path: string
          _product_id: string
          _thumb_path: string
          _thumb_url: string
          _video_url: string
        }
        Returns: Json
      }
      merchant_reel_video_remove: {
        Args: { _product_id: string }
        Returns: Json
      }
      merchant_request_payout: {
        Args: { _amount_kes: number; _idempotency_key: string }
        Returns: string
      }
      merchant_respond_to_order: {
        Args: {
          _channel: string
          _decision: string
          _order_id: string
          _reason?: string
          _request_id: string
          _transcript?: string
        }
        Returns: Json
      }
      merchant_slug_base: { Args: { _name: string }; Returns: string }
      merchant_video_publish: {
        Args: {
          _duration: number
          _path: string
          _thumb_path: string
          _thumb_url: string
          _video_url: string
        }
        Returns: Json
      }
      merchant_video_remove: { Args: never; Returns: Json }
      merchant_video_set_status: {
        Args: { _status: string }
        Returns: undefined
      }
      order_rider_contact: {
        Args: { _order_id: string }
        Returns: {
          full_name: string
          phone: string
          plate: string
          vehicle_type: string
        }[]
      }
      rider_available_orders: {
        Args: never
        Returns: {
          assigned_at: string
          created_at: string
          customer_area: string
          delivered_at: string
          delivery_fee_kes: number
          distance_km: number
          drop_lat: number
          drop_lng: number
          id: string
          items_summary: string
          merchant_name: string
          merchant_response: string
          merchant_response_deadline: string
          payment_method: string
          payment_status: string
          pickup_area: string
          pickup_lat: number
          pickup_lng: number
          rider_earning_kes: number
          rider_id: string
          rider_lat: number
          rider_lng: number
          status: string
          total_kes: number
          trip_km: number
          updated_at: string
        }[]
      }
      rider_location_ping: {
        Args: {
          _heading?: number
          _lat: number
          _lng: number
          _recorded_at?: string
          _speed?: number
        }
        Returns: string
      }
      rider_mark_arrived: { Args: { _order_id: string }; Returns: string }
      rider_request_mpesa_payout: {
        Args: { _amount_kes: number; _idempotency_key: string }
        Returns: string
      }
      service_complete_handover: {
        Args: { _kind: string; _order_id: string; _rider_id: string }
        Returns: string
      }
      service_record_mpesa_result: {
        Args: {
          _checkout_request_id: string
          _receipt?: string
          _result_code: number
          _result_desc?: string
        }
        Returns: string
      }
      service_update_refund_payout: {
        Args: {
          _conversation_id?: string
          _originator_id?: string
          _outcome: string
          _reason?: string
          _reference?: string
          _refund_id: string
        }
        Returns: undefined
      }
      set_rider_online: { Args: { _online: boolean }; Returns: undefined }
      sync_customer_cart: { Args: { _items: Json }; Returns: undefined }
      sync_product_clip: { Args: { _product_id: string }; Returns: undefined }
      trip_km: {
        Args: { _a_lat: number; _a_lng: number; _b_lat: number; _b_lng: number }
        Returns: number
      }
      unique_merchant_slug: {
        Args: { _id: string; _name: string }
        Returns: string
      }
      update_rider_location: {
        Args: { lat: number; lng: number }
        Returns: undefined
      }
      verify_followups_token: { Args: { _token: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
