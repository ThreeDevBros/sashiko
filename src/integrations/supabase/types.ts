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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      allergens: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      branch_hours: {
        Row: {
          branch_id: string
          close_time: string | null
          created_at: string | null
          day_of_week: number
          delivery_close_time: string | null
          delivery_enabled: boolean
          delivery_open_time: string | null
          id: string
          is_24h: boolean
          is_closed: boolean
          open_time: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          close_time?: string | null
          created_at?: string | null
          day_of_week: number
          delivery_close_time?: string | null
          delivery_enabled?: boolean
          delivery_open_time?: string | null
          id?: string
          is_24h?: boolean
          is_closed?: boolean
          open_time?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          close_time?: string | null
          created_at?: string | null
          day_of_week?: number
          delivery_close_time?: string | null
          delivery_enabled?: boolean
          delivery_open_time?: string | null
          id?: string
          is_24h?: boolean
          is_closed?: boolean
          open_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_hours_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_menu_items: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          is_available: boolean | null
          menu_item_id: string
          price_override: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          menu_item_id: string
          price_override?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          menu_item_id?: string
          price_override?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_menu_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_menu_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_popular_items: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          popular_item_ids: string[]
          section_description: string
          section_title: string
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          popular_item_ids?: string[]
          section_description?: string
          section_title?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          popular_item_ids?: string[]
          section_description?: string
          section_title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_popular_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          allow_cash_delivery: boolean
          allow_cash_pickup: boolean
          city: string
          closes_at: string | null
          created_at: string | null
          delivery_radius_km: number | null
          description: string | null
          google_maps_place_id: string | null
          google_maps_rating: number | null
          google_maps_review_count: number | null
          id: string
          is_active: boolean | null
          is_paused: boolean
          is_reservations_paused: boolean
          latitude: number | null
          layout_data: Json | null
          longitude: number | null
          name: string
          opens_at: string | null
          phone: string
          updated_at: string | null
        }
        Insert: {
          address: string
          allow_cash_delivery?: boolean
          allow_cash_pickup?: boolean
          city: string
          closes_at?: string | null
          created_at?: string | null
          delivery_radius_km?: number | null
          description?: string | null
          google_maps_place_id?: string | null
          google_maps_rating?: number | null
          google_maps_review_count?: number | null
          id?: string
          is_active?: boolean | null
          is_paused?: boolean
          is_reservations_paused?: boolean
          latitude?: number | null
          layout_data?: Json | null
          longitude?: number | null
          name: string
          opens_at?: string | null
          phone: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          allow_cash_delivery?: boolean
          allow_cash_pickup?: boolean
          city?: string
          closes_at?: string | null
          created_at?: string | null
          delivery_radius_km?: number | null
          description?: string | null
          google_maps_place_id?: string | null
          google_maps_rating?: number | null
          google_maps_review_count?: number | null
          id?: string
          is_active?: boolean | null
          is_paused?: boolean
          is_reservations_paused?: boolean
          latitude?: number | null
          layout_data?: Json | null
          longitude?: number | null
          name?: string
          opens_at?: string | null
          phone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      broadcast_notifications: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          id: string
          message: string
          recipient_filter: string
          sent_at: string | null
          sent_count: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          recipient_filter?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          recipient_filter?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_discount: number | null
          min_order_amount: number | null
          times_used: number | null
          updated_at: string | null
          usage_limit: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_order_amount?: number | null
          times_used?: number | null
          updated_at?: string | null
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_order_amount?: number | null
          times_used?: number | null
          updated_at?: string | null
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          driver_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          order_id: string
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          driver_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          order_id: string
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          driver_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          order_id?: string
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      live_activity_tokens: {
        Row: {
          created_at: string
          id: string
          order_id: string
          platform: string
          push_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          platform?: string
          push_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          platform?: string
          push_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_activity_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      menu_item_allergens: {
        Row: {
          allergen_id: string
          menu_item_id: string
        }
        Insert: {
          allergen_id: string
          menu_item_id: string
        }
        Update: {
          allergen_id?: string
          menu_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_allergens_allergen_id_fkey"
            columns: ["allergen_id"]
            isOneToOne: false
            referencedRelation: "allergens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_allergens_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_modifiers: {
        Row: {
          menu_item_id: string
          modifier_group_id: string
        }
        Insert: {
          menu_item_id: string
          modifier_group_id: string
        }
        Update: {
          menu_item_id?: string
          modifier_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_modifiers_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_modifiers_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[] | null
          calories: number | null
          category_id: string | null
          created_at: string | null
          description: string | null
          disabled_permanently: boolean | null
          disabled_until: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          is_featured: boolean | null
          is_vegan: boolean | null
          is_vegetarian: boolean | null
          name: string
          preparation_time_mins: number | null
          price: number
          tax_included_in_price: boolean
          tax_rate: number | null
          updated_at: string | null
        }
        Insert: {
          allergens?: string[] | null
          calories?: number | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          disabled_permanently?: boolean | null
          disabled_until?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          is_vegan?: boolean | null
          is_vegetarian?: boolean | null
          name: string
          preparation_time_mins?: number | null
          price: number
          tax_included_in_price?: boolean
          tax_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          allergens?: string[] | null
          calories?: number | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          disabled_permanently?: boolean | null
          disabled_until?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          is_vegan?: boolean | null
          is_vegetarian?: boolean | null
          name?: string
          preparation_time_mins?: number | null
          price?: number
          tax_included_in_price?: boolean
          tax_rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          created_at: string | null
          id: string
          is_required: boolean | null
          max_selections: number | null
          min_selections: number | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name?: string
        }
        Relationships: []
      }
      modifiers: {
        Row: {
          created_at: string | null
          group_id: string | null
          id: string
          name: string
          price_adjustment: number | null
        }
        Insert: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          name: string
          price_adjustment?: number | null
        }
        Update: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          name?: string
          price_adjustment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_modifiers: {
        Row: {
          id: string
          modifier_id: string | null
          order_item_id: string | null
          price_adjustment: number | null
        }
        Insert: {
          id?: string
          modifier_id?: string | null
          order_item_id?: string | null
          price_adjustment?: number | null
        }
        Update: {
          id?: string
          modifier_id?: string | null
          order_item_id?: string | null
          price_adjustment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_modifiers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          menu_item_id: string | null
          order_id: string | null
          quantity: number
          special_instructions: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          order_id?: string | null
          quantity?: number
          special_instructions?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          order_id?: string | null
          quantity?: number
          special_instructions?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string | null
          cancellation_reason: string | null
          cashback_used: number | null
          created_at: string | null
          delivery_address_id: string | null
          delivery_fee: number | null
          display_number: number | null
          driver_id: string | null
          estimated_delivery_time: string | null
          estimated_ready_at: string | null
          guest_delivery_address: string | null
          guest_delivery_lat: number | null
          guest_delivery_lng: number | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number
          tax: number | null
          tip: number | null
          total: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          cancellation_reason?: string | null
          cashback_used?: number | null
          created_at?: string | null
          delivery_address_id?: string | null
          delivery_fee?: number | null
          display_number?: number | null
          driver_id?: string | null
          estimated_delivery_time?: string | null
          estimated_ready_at?: string | null
          guest_delivery_address?: string | null
          guest_delivery_lat?: number | null
          guest_delivery_lng?: number | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal: number
          tax?: number | null
          tip?: number | null
          total: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          cancellation_reason?: string | null
          cashback_used?: number | null
          created_at?: string | null
          delivery_address_id?: string | null
          delivery_fee?: number | null
          display_number?: number | null
          driver_id?: string | null
          estimated_delivery_time?: string | null
          estimated_ready_at?: string | null
          guest_delivery_address?: string | null
          guest_delivery_lat?: number | null
          guest_delivery_lng?: number | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number
          tax?: number | null
          tip?: number | null
          total?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "user_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cashback_balance: number | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferred_payment_method: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          cashback_balance?: number | null
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_payment_method?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          cashback_balance?: number | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_payment_method?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_media_links: {
        Row: {
          created_at: string
          custom_name: string | null
          display_order: number
          id: string
          is_visible: boolean
          logo_url: string | null
          platform: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          logo_url?: string | null
          platform: string
          updated_at?: string
          url?: string
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          logo_url?: string | null
          platform?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      staff_branches: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      table_reservations: {
        Row: {
          admin_notes: string | null
          branch_id: string
          combined_tables: string[] | null
          created_at: string
          end_time: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          party_size: number
          requires_table_combination: boolean | null
          reservation_date: string
          special_requests: string | null
          start_time: string
          status: string
          table_object_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          branch_id: string
          combined_tables?: string[] | null
          created_at?: string
          end_time: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          party_size: number
          requires_table_combination?: boolean | null
          reservation_date: string
          special_requests?: string | null
          start_time: string
          status?: string
          table_object_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          branch_id?: string
          combined_tables?: string[] | null
          created_at?: string
          end_time?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          party_size?: number
          requires_table_combination?: boolean | null
          reservation_date?: string
          special_requests?: string | null
          start_time?: string
          status?: string
          table_object_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_reservations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          accent_color: string | null
          allow_customer_cancel: boolean
          auto_prepare_enabled: boolean | null
          auto_prepare_percent: number | null
          auto_ready_enabled: boolean | null
          background_color: string | null
          banner_data: Json
          banner_style: string
          cashback_rate: number | null
          created_at: string | null
          cta_button_text: string | null
          currency: string | null
          delivery_base_fee: number
          delivery_fee_per_km: number
          font_family: string | null
          font_size_base: string | null
          font_size_heading: string | null
          footer_text: string | null
          free_delivery_threshold: number | null
          gradient_primary: string | null
          gradient_secondary: string | null
          hero_subtitle: string | null
          hero_tagline_color: string | null
          hero_title: string | null
          home_image_url: string | null
          id: string
          language: string | null
          loading_screen_image: string | null
          login_bg_color: string | null
          login_logo_size: number | null
          login_logo_url: string | null
          login_tagline: string | null
          login_tagline_bold: boolean | null
          login_tagline_color: string | null
          login_tagline_italic: boolean | null
          login_tagline_underline: boolean | null
          logo_url: string | null
          max_delivery_fee: number | null
          menu_display_style: string | null
          min_delivery_fee: number
          popular_item_ids: string[]
          popular_section_description: string
          popular_section_title: string
          primary_color: string | null
          privacy_policy: string | null
          quick_actions_config: Json
          reservation_duration_minutes: number
          schedule_max_days: number
          schedule_min_days: number
          scheduled_alert_minutes: number
          secondary_color: string | null
          service_fee_rate: number
          show_social_on_home: boolean
          show_social_on_profile: boolean
          slideshow_interval_seconds: number
          template_style: string | null
          tenant_name: string
          terms_of_service: string | null
          timezone: string | null
          updated_at: string | null
          vat_number: string | null
          vat_rate: number | null
        }
        Insert: {
          accent_color?: string | null
          allow_customer_cancel?: boolean
          auto_prepare_enabled?: boolean | null
          auto_prepare_percent?: number | null
          auto_ready_enabled?: boolean | null
          background_color?: string | null
          banner_data?: Json
          banner_style?: string
          cashback_rate?: number | null
          created_at?: string | null
          cta_button_text?: string | null
          currency?: string | null
          delivery_base_fee?: number
          delivery_fee_per_km?: number
          font_family?: string | null
          font_size_base?: string | null
          font_size_heading?: string | null
          footer_text?: string | null
          free_delivery_threshold?: number | null
          gradient_primary?: string | null
          gradient_secondary?: string | null
          hero_subtitle?: string | null
          hero_tagline_color?: string | null
          hero_title?: string | null
          home_image_url?: string | null
          id?: string
          language?: string | null
          loading_screen_image?: string | null
          login_bg_color?: string | null
          login_logo_size?: number | null
          login_logo_url?: string | null
          login_tagline?: string | null
          login_tagline_bold?: boolean | null
          login_tagline_color?: string | null
          login_tagline_italic?: boolean | null
          login_tagline_underline?: boolean | null
          logo_url?: string | null
          max_delivery_fee?: number | null
          menu_display_style?: string | null
          min_delivery_fee?: number
          popular_item_ids?: string[]
          popular_section_description?: string
          popular_section_title?: string
          primary_color?: string | null
          privacy_policy?: string | null
          quick_actions_config?: Json
          reservation_duration_minutes?: number
          schedule_max_days?: number
          schedule_min_days?: number
          scheduled_alert_minutes?: number
          secondary_color?: string | null
          service_fee_rate?: number
          show_social_on_home?: boolean
          show_social_on_profile?: boolean
          slideshow_interval_seconds?: number
          template_style?: string | null
          tenant_name?: string
          terms_of_service?: string | null
          timezone?: string | null
          updated_at?: string | null
          vat_number?: string | null
          vat_rate?: number | null
        }
        Update: {
          accent_color?: string | null
          allow_customer_cancel?: boolean
          auto_prepare_enabled?: boolean | null
          auto_prepare_percent?: number | null
          auto_ready_enabled?: boolean | null
          background_color?: string | null
          banner_data?: Json
          banner_style?: string
          cashback_rate?: number | null
          created_at?: string | null
          cta_button_text?: string | null
          currency?: string | null
          delivery_base_fee?: number
          delivery_fee_per_km?: number
          font_family?: string | null
          font_size_base?: string | null
          font_size_heading?: string | null
          footer_text?: string | null
          free_delivery_threshold?: number | null
          gradient_primary?: string | null
          gradient_secondary?: string | null
          hero_subtitle?: string | null
          hero_tagline_color?: string | null
          hero_title?: string | null
          home_image_url?: string | null
          id?: string
          language?: string | null
          loading_screen_image?: string | null
          login_bg_color?: string | null
          login_logo_size?: number | null
          login_logo_url?: string | null
          login_tagline?: string | null
          login_tagline_bold?: boolean | null
          login_tagline_color?: string | null
          login_tagline_italic?: boolean | null
          login_tagline_underline?: boolean | null
          logo_url?: string | null
          max_delivery_fee?: number | null
          menu_display_style?: string | null
          min_delivery_fee?: number
          popular_item_ids?: string[]
          popular_section_description?: string
          popular_section_title?: string
          primary_color?: string | null
          privacy_policy?: string | null
          quick_actions_config?: Json
          reservation_duration_minutes?: number
          schedule_max_days?: number
          schedule_min_days?: number
          scheduled_alert_minutes?: number
          secondary_color?: string | null
          service_fee_rate?: number
          show_social_on_home?: boolean
          show_social_on_profile?: boolean
          slideshow_interval_seconds?: number
          template_style?: string | null
          tenant_name?: string
          terms_of_service?: string | null
          timezone?: string | null
          updated_at?: string | null
          vat_number?: string | null
          vat_rate?: number | null
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          created_at: string | null
          id: string
          is_default: boolean | null
          label: string
          latitude: number | null
          longitude: number | null
          postal_code: string | null
          user_id: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          label: string
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          user_id?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          label?: string
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      check_table_availability: {
        Args: {
          p_branch_id: string
          p_end_time: string
          p_exclude_reservation_id?: string
          p_reservation_date: string
          p_start_time: string
          p_table_object_id: string
        }
        Returns: boolean
      }
      deduct_cashback: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_staff_branch_id: { Args: { _user_id: string }; Returns: string }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "branch_manager"
        | "staff"
        | "user"
        | "manager"
        | "delivery"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      order_type: "delivery" | "pickup" | "dine_in"
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
      app_role: [
        "admin",
        "branch_manager",
        "staff",
        "user",
        "manager",
        "delivery",
      ],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      order_type: ["delivery", "pickup", "dine_in"],
    },
  },
} as const
