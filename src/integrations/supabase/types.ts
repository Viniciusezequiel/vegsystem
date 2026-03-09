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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          entity_description: string | null
          entity_id: string | null
          id: string
          ip_address: string | null
          module: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          entity_description?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          module: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          entity_description?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          module?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      checklist_answers: {
        Row: {
          answer: boolean
          checklist_id: string
          id: string
          notes: string | null
          question_id: string
        }
        Insert: {
          answer: boolean
          checklist_id: string
          id?: string
          notes?: string | null
          question_id: string
        }
        Update: {
          answer?: boolean
          checklist_id?: string
          id?: string
          notes?: string | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_answers_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "room_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "checklist_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_questions: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          order_index: number
          question: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          question: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          question?: string
        }
        Relationships: []
      }
      classroom_calls: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          accepted_by_name: string | null
          created_at: string
          id: string
          is_valid: boolean | null
          reason: string
          resolved_at: string | null
          room_name: string
          status: string
          treatment: string | null
          validation_reason: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_by_name?: string | null
          created_at?: string
          id?: string
          is_valid?: boolean | null
          reason: string
          resolved_at?: string | null
          room_name: string
          status?: string
          treatment?: string | null
          validation_reason?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_by_name?: string | null
          created_at?: string
          id?: string
          is_valid?: boolean | null
          reason?: string
          resolved_at?: string | null
          room_name?: string
          status?: string
          treatment?: string | null
          validation_reason?: string | null
        }
        Relationships: []
      }
      equipment: {
        Row: {
          allow_external_loan: boolean
          available_quantity: number
          campus: Database["public"]["Enums"]["campus_enum"]
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          location: string
          name: string
          patrimony_code: string
          quantity: number
          status: Database["public"]["Enums"]["equipment_status"]
          updated_at: string
          write_off_by: string | null
          write_off_date: string | null
          write_off_reason: string | null
        }
        Insert: {
          allow_external_loan?: boolean
          available_quantity?: number
          campus: Database["public"]["Enums"]["campus_enum"]
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location: string
          name: string
          patrimony_code: string
          quantity?: number
          status?: Database["public"]["Enums"]["equipment_status"]
          updated_at?: string
          write_off_by?: string | null
          write_off_date?: string | null
          write_off_reason?: string | null
        }
        Update: {
          allow_external_loan?: boolean
          available_quantity?: number
          campus?: Database["public"]["Enums"]["campus_enum"]
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string
          name?: string
          patrimony_code?: string
          quantity?: number
          status?: Database["public"]["Enums"]["equipment_status"]
          updated_at?: string
          write_off_by?: string | null
          write_off_date?: string | null
          write_off_reason?: string | null
        }
        Relationships: []
      }
      equipment_loans: {
        Row: {
          actual_return_date: string | null
          all_items_returned: boolean | null
          authorizer_contact: string | null
          authorizer_name: string | null
          borrower_name: string
          borrower_phone: string
          borrower_sector: string
          borrower_signature: string | null
          borrower_type: string | null
          collaborator_name: string | null
          created_at: string
          equipment_id: string
          expected_return_date: string
          id: string
          item_condition: string | null
          loaned_by: string | null
          notes: string | null
          pending_items_description: string | null
          purpose: string | null
          quantity_borrowed: number
          return_collaborator_name: string | null
          return_signature: string | null
          returned_by: string | null
          returner_name: string | null
          returner_phone: string | null
          status: Database["public"]["Enums"]["loan_status"]
          updated_at: string
        }
        Insert: {
          actual_return_date?: string | null
          all_items_returned?: boolean | null
          authorizer_contact?: string | null
          authorizer_name?: string | null
          borrower_name: string
          borrower_phone: string
          borrower_sector: string
          borrower_signature?: string | null
          borrower_type?: string | null
          collaborator_name?: string | null
          created_at?: string
          equipment_id: string
          expected_return_date: string
          id?: string
          item_condition?: string | null
          loaned_by?: string | null
          notes?: string | null
          pending_items_description?: string | null
          purpose?: string | null
          quantity_borrowed?: number
          return_collaborator_name?: string | null
          return_signature?: string | null
          returned_by?: string | null
          returner_name?: string | null
          returner_phone?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          updated_at?: string
        }
        Update: {
          actual_return_date?: string | null
          all_items_returned?: boolean | null
          authorizer_contact?: string | null
          authorizer_name?: string | null
          borrower_name?: string
          borrower_phone?: string
          borrower_sector?: string
          borrower_signature?: string | null
          borrower_type?: string | null
          collaborator_name?: string | null
          created_at?: string
          equipment_id?: string
          expected_return_date?: string
          id?: string
          item_condition?: string | null
          loaned_by?: string | null
          notes?: string | null
          pending_items_description?: string | null
          purpose?: string | null
          quantity_borrowed?: number
          return_collaborator_name?: string | null
          return_signature?: string | null
          returned_by?: string | null
          returner_name?: string | null
          returner_phone?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_loans_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_reservations: {
        Row: {
          created_at: string
          created_by: string | null
          equipment_id: string
          expected_return_date: string | null
          id: string
          notes: string | null
          purpose: string | null
          quantity_reserved: number
          requester_name: string
          requester_phone: string
          requester_sector: string
          requester_type: string
          scheduled_pickup_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_id: string
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          purpose?: string | null
          quantity_reserved?: number
          requester_name: string
          requester_phone: string
          requester_sector: string
          requester_type?: string
          scheduled_pickup_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          purpose?: string | null
          quantity_reserved?: number
          requester_name?: string
          requester_phone?: string
          requester_sector?: string
          requester_type?: string
          scheduled_pickup_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_reservations_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      external_equipment_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          equipment_id: string | null
          equipment_name: string
          expected_return_date: string
          id: string
          processed_at: string | null
          processed_by: string | null
          purpose: string
          quantity_requested: number
          requested_date: string
          requester_email: string
          requester_name: string
          requester_organization: string | null
          requester_phone: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          equipment_id?: string | null
          equipment_name: string
          expected_return_date: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          purpose: string
          quantity_requested?: number
          requested_date: string
          requester_email: string
          requester_name: string
          requester_organization?: string | null
          requester_phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          equipment_id?: string | null
          equipment_name?: string
          expected_return_date?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          purpose?: string
          quantity_requested?: number
          requested_date?: string
          requester_email?: string
          requester_name?: string
          requester_organization?: string | null
          requester_phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_equipment_requests_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      external_users: {
        Row: {
          cpf: string
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          sector: string | null
          updated_at: string
          user_id: string
          user_type: string | null
        }
        Insert: {
          cpf: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          sector?: string | null
          updated_at?: string
          user_id: string
          user_type?: string | null
        }
        Update: {
          cpf?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          sector?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string | null
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          equipment_id: string
          from_campus: string | null
          from_location: string | null
          id: string
          movement_type: string
          notes: string | null
          performed_by: string | null
          performed_by_name: string
          quantity: number
          reason: string | null
          to_campus: string | null
          to_location: string | null
        }
        Insert: {
          created_at?: string
          equipment_id: string
          from_campus?: string | null
          from_location?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          performed_by?: string | null
          performed_by_name: string
          quantity?: number
          reason?: string | null
          to_campus?: string | null
          to_location?: string | null
        }
        Update: {
          created_at?: string
          equipment_id?: string
          from_campus?: string | null
          from_location?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          performed_by?: string | null
          performed_by_name?: string
          quantity?: number
          reason?: string | null
          to_campus?: string | null
          to_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      locker_exchanges: {
        Row: {
          created_at: string
          id: string
          new_loan_id: string | null
          new_locker_id: string
          old_loan_id: string
          old_locker_id: string
          performed_by: string | null
          performed_by_name: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          new_loan_id?: string | null
          new_locker_id: string
          old_loan_id: string
          old_locker_id: string
          performed_by?: string | null
          performed_by_name: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          new_loan_id?: string | null
          new_locker_id?: string
          old_loan_id?: string
          old_locker_id?: string
          performed_by?: string | null
          performed_by_name?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locker_exchanges_new_loan_id_fkey"
            columns: ["new_loan_id"]
            isOneToOne: false
            referencedRelation: "locker_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_exchanges_new_locker_id_fkey"
            columns: ["new_locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_exchanges_old_loan_id_fkey"
            columns: ["old_loan_id"]
            isOneToOne: false
            referencedRelation: "locker_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_exchanges_old_locker_id_fkey"
            columns: ["old_locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
        ]
      }
      locker_loans: {
        Row: {
          actual_return_date: string | null
          borrower_email: string | null
          borrower_name: string
          borrower_phone: string
          borrower_sector: string | null
          borrower_signature: string | null
          created_at: string
          expected_return_date: string
          id: string
          loaned_by: string | null
          locker_id: string
          notes: string | null
          return_signature: string | null
          returned_by: string | null
          returner_name: string | null
          status: Database["public"]["Enums"]["loan_status"]
          updated_at: string
        }
        Insert: {
          actual_return_date?: string | null
          borrower_email?: string | null
          borrower_name: string
          borrower_phone: string
          borrower_sector?: string | null
          borrower_signature?: string | null
          created_at?: string
          expected_return_date: string
          id?: string
          loaned_by?: string | null
          locker_id: string
          notes?: string | null
          return_signature?: string | null
          returned_by?: string | null
          returner_name?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          updated_at?: string
        }
        Update: {
          actual_return_date?: string | null
          borrower_email?: string | null
          borrower_name?: string
          borrower_phone?: string
          borrower_sector?: string | null
          borrower_signature?: string | null
          created_at?: string
          expected_return_date?: string
          id?: string
          loaned_by?: string | null
          locker_id?: string
          notes?: string | null
          return_signature?: string | null
          returned_by?: string | null
          returner_name?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locker_loans_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
        ]
      }
      lockers: {
        Row: {
          campus: Database["public"]["Enums"]["campus_enum"]
          code: string
          created_at: string
          description: string | null
          id: string
          location: string
          status: Database["public"]["Enums"]["locker_status"]
          updated_at: string
        }
        Insert: {
          campus: Database["public"]["Enums"]["campus_enum"]
          code: string
          created_at?: string
          description?: string | null
          id?: string
          location: string
          status?: Database["public"]["Enums"]["locker_status"]
          updated_at?: string
        }
        Update: {
          campus?: Database["public"]["Enums"]["campus_enum"]
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string
          status?: Database["public"]["Enums"]["locker_status"]
          updated_at?: string
        }
        Relationships: []
      }
      lost_items: {
        Row: {
          box: string | null
          box_number: string | null
          campus: Database["public"]["Enums"]["campus_enum"]
          code: string
          created_at: string
          delivered_at: string | null
          delivered_by_contact: string | null
          delivered_by_name: string
          delivered_by_team_member: string | null
          description: string
          found_date: string
          found_location: string
          id: string
          image_url: string | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          owner_signature: string | null
          received_date: string
          registered_by: string | null
          seal_number: string | null
          shelf: string | null
          status: string
          updated_at: string
        }
        Insert: {
          box?: string | null
          box_number?: string | null
          campus: Database["public"]["Enums"]["campus_enum"]
          code: string
          created_at?: string
          delivered_at?: string | null
          delivered_by_contact?: string | null
          delivered_by_name: string
          delivered_by_team_member?: string | null
          description: string
          found_date: string
          found_location: string
          id?: string
          image_url?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_signature?: string | null
          received_date: string
          registered_by?: string | null
          seal_number?: string | null
          shelf?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          box?: string | null
          box_number?: string | null
          campus?: Database["public"]["Enums"]["campus_enum"]
          code?: string
          created_at?: string
          delivered_at?: string | null
          delivered_by_contact?: string | null
          delivered_by_name?: string
          delivered_by_team_member?: string | null
          description?: string
          found_date?: string
          found_location?: string
          id?: string
          image_url?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_signature?: string | null
          received_date?: string
          registered_by?: string | null
          seal_number?: string | null
          shelf?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lost_items_archive: {
        Row: {
          archived_at: string
          archived_by: string | null
          archived_by_name: string | null
          box: string | null
          box_number: string | null
          campus: Database["public"]["Enums"]["campus_enum"]
          code: string
          created_at: string
          delivered_at: string | null
          delivered_by_contact: string | null
          delivered_by_name: string
          delivered_by_team_member: string | null
          description: string
          found_date: string
          found_location: string
          id: string
          image_url: string | null
          original_id: string
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          owner_signature: string | null
          received_date: string
          registered_by: string | null
          seal_number: string | null
          shelf: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          archived_by_name?: string | null
          box?: string | null
          box_number?: string | null
          campus: Database["public"]["Enums"]["campus_enum"]
          code: string
          created_at?: string
          delivered_at?: string | null
          delivered_by_contact?: string | null
          delivered_by_name: string
          delivered_by_team_member?: string | null
          description: string
          found_date: string
          found_location: string
          id?: string
          image_url?: string | null
          original_id: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_signature?: string | null
          received_date: string
          registered_by?: string | null
          seal_number?: string | null
          shelf?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          archived_by_name?: string | null
          box?: string | null
          box_number?: string | null
          campus?: Database["public"]["Enums"]["campus_enum"]
          code?: string
          created_at?: string
          delivered_at?: string | null
          delivered_by_contact?: string | null
          delivered_by_name?: string
          delivered_by_team_member?: string | null
          description?: string
          found_date?: string
          found_location?: string
          id?: string
          image_url?: string | null
          original_id?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_signature?: string | null
          received_date?: string
          registered_by?: string | null
          seal_number?: string | null
          shelf?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      material_requests: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          assigned_to_name: string | null
          created_at: string
          description: string | null
          id: string
          items: Json
          priority: string
          requester_id: string
          requester_name: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          assigned_to_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          items?: Json
          priority?: string
          requester_id: string
          requester_name: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          assigned_to_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          items?: Json
          priority?: string
          requester_id?: string
          requester_name?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string
          email: string | null
          force_password_change: boolean | null
          full_name: string
          id: string
          is_active: boolean
          position: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string
          email?: string | null
          force_password_change?: boolean | null
          full_name: string
          id?: string
          is_active?: boolean
          position?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string
          email?: string | null
          force_password_change?: boolean | null
          full_name?: string
          id?: string
          is_active?: boolean
          position?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservation_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          performed_by: string | null
          performer_name: string | null
          reservation_id: string | null
          room_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          performed_by?: string | null
          performer_name?: string | null
          reservation_id?: string | null
          room_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          performed_by?: string | null
          performer_name?: string | null
          reservation_id?: string | null
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_logs_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_logs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "reservation_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_reschedulings: {
        Row: {
          affected_reservations_count: number
          created_at: string
          id: string
          is_recurring_update: boolean
          new_end_datetime: string
          new_room_id: string
          new_start_datetime: string
          original_end_datetime: string
          original_room_id: string
          original_start_datetime: string
          reason: string | null
          rescheduled_by: string | null
          rescheduled_by_name: string | null
          reservation_id: string
        }
        Insert: {
          affected_reservations_count?: number
          created_at?: string
          id?: string
          is_recurring_update?: boolean
          new_end_datetime: string
          new_room_id: string
          new_start_datetime: string
          original_end_datetime: string
          original_room_id: string
          original_start_datetime: string
          reason?: string | null
          rescheduled_by?: string | null
          rescheduled_by_name?: string | null
          reservation_id: string
        }
        Update: {
          affected_reservations_count?: number
          created_at?: string
          id?: string
          is_recurring_update?: boolean
          new_end_datetime?: string
          new_room_id?: string
          new_start_datetime?: string
          original_end_datetime?: string
          original_room_id?: string
          original_start_datetime?: string
          reason?: string | null
          rescheduled_by?: string | null
          rescheduled_by_name?: string | null
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_reschedulings_new_room_id_fkey"
            columns: ["new_room_id"]
            isOneToOne: false
            referencedRelation: "reservation_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_reschedulings_original_room_id_fkey"
            columns: ["original_room_id"]
            isOneToOne: false
            referencedRelation: "reservation_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_reschedulings_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_rooms: {
        Row: {
          auto_confirm: boolean
          campus: Database["public"]["Enums"]["campus_enum"]
          capacity: number
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location: string | null
          max_advance_days: number | null
          name: string
          updated_at: string
        }
        Insert: {
          auto_confirm?: boolean
          campus: Database["public"]["Enums"]["campus_enum"]
          capacity?: number
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          max_advance_days?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          auto_confirm?: boolean
          campus?: Database["public"]["Enums"]["campus_enum"]
          capacity?: number
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          max_advance_days?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          approved_by: string | null
          attendees_count: number
          created_at: string
          created_by: string | null
          description: string | null
          end_datetime: string
          external_user_id: string | null
          id: string
          is_external: boolean
          is_fixed: boolean
          notes: string | null
          requester_cpf: string | null
          requester_email: string
          requester_name: string
          requester_phone: string | null
          room_id: string
          start_datetime: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          attendees_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_datetime: string
          external_user_id?: string | null
          id?: string
          is_external?: boolean
          is_fixed?: boolean
          notes?: string | null
          requester_cpf?: string | null
          requester_email: string
          requester_name: string
          requester_phone?: string | null
          room_id: string
          start_datetime: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          attendees_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_datetime?: string
          external_user_id?: string | null
          id?: string
          is_external?: boolean
          is_fixed?: boolean
          notes?: string | null
          requester_cpf?: string | null
          requester_email?: string
          requester_name?: string
          requester_phone?: string | null
          room_id?: string
          start_datetime?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_external_user_id_fkey"
            columns: ["external_user_id"]
            isOneToOne: false
            referencedRelation: "external_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "reservation_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          action: string
          allowed: boolean
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          action: string
          allowed?: boolean
          created_at?: string
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          action?: string
          allowed?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      room_checklists: {
        Row: {
          filled_at: string
          filled_by: string
          id: string
          observations: string | null
          room_id: string
          shift: string
        }
        Insert: {
          filled_at?: string
          filled_by: string
          id?: string
          observations?: string | null
          room_id: string
          shift: string
        }
        Update: {
          filled_at?: string
          filled_by?: string
          id?: string
          observations?: string | null
          room_id?: string
          shift?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_checklists_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_combinations: {
        Row: {
          created_at: string
          id: string
          linked_room_id: string
          parent_room_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_room_id: string
          parent_room_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_room_id?: string
          parent_room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_combinations_linked_room_id_fkey"
            columns: ["linked_room_id"]
            isOneToOne: false
            referencedRelation: "reservation_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_combinations_parent_room_id_fkey"
            columns: ["parent_room_id"]
            isOneToOne: false
            referencedRelation: "reservation_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          building: string
          campus: Database["public"]["Enums"]["campus_enum"]
          capacity: number | null
          checklist_items: Json | null
          created_at: string
          description: string | null
          floor: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          building: string
          campus: Database["public"]["Enums"]["campus_enum"]
          capacity?: number | null
          checklist_items?: Json | null
          created_at?: string
          description?: string | null
          floor?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          building?: string
          campus?: Database["public"]["Enums"]["campus_enum"]
          capacity?: number | null
          checklist_items?: Json | null
          created_at?: string
          description?: string | null
          floor?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_handover_incidents: {
        Row: {
          description: string | null
          handover_id: string
          id: string
          incident_type: string
          location: string | null
          treatment: string | null
        }
        Insert: {
          description?: string | null
          handover_id: string
          id?: string
          incident_type: string
          location?: string | null
          treatment?: string | null
        }
        Update: {
          description?: string | null
          handover_id?: string
          id?: string
          incident_type?: string
          location?: string | null
          treatment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_handover_incidents_handover_id_fkey"
            columns: ["handover_id"]
            isOneToOne: false
            referencedRelation: "shift_handovers"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_handover_tasks: {
        Row: {
          answer: boolean
          handover_id: string
          id: string
          observation: string | null
          task_name: string
        }
        Insert: {
          answer?: boolean
          handover_id: string
          id?: string
          observation?: string | null
          task_name: string
        }
        Update: {
          answer?: boolean
          handover_id?: string
          id?: string
          observation?: string | null
          task_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_handover_tasks_handover_id_fkey"
            columns: ["handover_id"]
            isOneToOne: false
            referencedRelation: "shift_handovers"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_handovers: {
        Row: {
          collaborator_name: string
          collaborator_time: string
          created_at: string
          day_of_week: string
          filled_at: string
          filled_by: string
          general_observations: string | null
          handover_date: string
          has_impact_incident: boolean
          id: string
          sector: string
          shift: string
          unit: string
        }
        Insert: {
          collaborator_name: string
          collaborator_time: string
          created_at?: string
          day_of_week: string
          filled_at?: string
          filled_by: string
          general_observations?: string | null
          handover_date?: string
          has_impact_incident?: boolean
          id?: string
          sector?: string
          shift: string
          unit?: string
        }
        Update: {
          collaborator_name?: string
          collaborator_time?: string
          created_at?: string
          day_of_week?: string
          filled_at?: string
          filled_by?: string
          general_observations?: string | null
          handover_date?: string
          has_impact_incident?: boolean
          id?: string
          sector?: string
          shift?: string
          unit?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          action: string
          created_at: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_team_members: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_team_members_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          assigned_to_name: string | null
          attachments: Json | null
          category: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          event_end_datetime: string | null
          event_start_datetime: string | null
          id: string
          notes: string | null
          priority: string
          started_at: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          assigned_to_name?: string | null
          attachments?: Json | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          event_end_datetime?: string | null
          event_start_datetime?: string | null
          id?: string
          notes?: string | null
          priority?: string
          started_at?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          assigned_to_name?: string | null
          attachments?: Json | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          event_end_datetime?: string | null
          event_start_datetime?: string | null
          id?: string
          notes?: string | null
          priority?: string
          started_at?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      check_reservation_conflict:
        | {
            Args: {
              p_end_datetime: string
              p_exclude_reservation_id?: string
              p_room_id: string
              p_start_datetime: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_end_datetime: string
              p_exclude_reservation_id?: string
              p_is_external?: boolean
              p_room_id: string
              p_start_datetime: string
            }
            Returns: boolean
          }
      expire_old_lost_items: { Args: never; Returns: undefined }
      find_available_rooms:
        | {
            Args: {
              p_attendees_count?: number
              p_campus?: Database["public"]["Enums"]["campus_enum"]
              p_end_datetime: string
              p_start_datetime: string
            }
            Returns: {
              campus: Database["public"]["Enums"]["campus_enum"]
              capacity: number
              code: string
              description: string
              id: string
              location: string
              name: string
            }[]
          }
        | {
            Args: {
              p_attendees_count?: number
              p_campus?: Database["public"]["Enums"]["campus_enum"]
              p_end_datetime: string
              p_is_external?: boolean
              p_start_datetime: string
            }
            Returns: {
              campus: Database["public"]["Enums"]["campus_enum"]
              capacity: number
              code: string
              description: string
              id: string
              location: string
              name: string
            }[]
          }
      get_linked_rooms: { Args: { p_room_id: string }; Returns: string[] }
      has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_analista: { Args: { _user_id: string }; Returns: boolean }
      is_internal_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "analista"
        | "assistente"
        | "supervisor"
        | "visualizador"
      campus_enum: "Campus I" | "Campus II" | "Campus IV" | "Campus HUCM Adm"
      equipment_status: "available" | "borrowed" | "maintenance"
      loan_status: "active" | "returned" | "overdue"
      locker_status: "available" | "occupied"
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
        "analista",
        "assistente",
        "supervisor",
        "visualizador",
      ],
      campus_enum: ["Campus I", "Campus II", "Campus IV", "Campus HUCM Adm"],
      equipment_status: ["available", "borrowed", "maintenance"],
      loan_status: ["active", "returned", "overdue"],
      locker_status: ["available", "occupied"],
    },
  },
} as const
