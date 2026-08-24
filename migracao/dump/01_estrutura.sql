-- Estrutura completa do banco (estado real atual)
-- Gerada a partir dos catalogos do Postgres

SET statement_timeout = 0;
SET client_min_messages = warning;

-- Extensoes devem existir antes de tabelas, defaults, funcoes e indices dependentes.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ============ ENUMS ============

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'analista', 'assistente', 'supervisor', 'visualizador', 'atendente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.campus_enum AS ENUM ('Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.equipment_status AS ENUM ('available', 'borrowed', 'maintenance'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.loan_status AS ENUM ('active', 'returned', 'overdue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.locker_status AS ENUM ('available', 'occupied'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.semester_competency_status AS ENUM ('draft', 'released', 'blocked', 'finished'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.semester_item_status AS ENUM ('pending_analysis', 'pending_ticket', 'ticket_opened', 'in_maintenance', 'waiting_parts', 'completed', 'written_off', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.semester_maintenance_type AS ENUM ('internal', 'external'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABELAS ============

CREATE TABLE IF NOT EXISTS public.activity_logs (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "user_name" text NOT NULL,
  "module" text NOT NULL,
  "action" text NOT NULL,
  "entity_id" text,
  "entity_description" text,
  "details" text,
  "ip_address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.app_settings (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.checklist_answers (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "checklist_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "answer" boolean NOT NULL,
  "notes" text
);
CREATE TABLE IF NOT EXISTS public.checklist_questions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "question" text NOT NULL,
  "category" text,
  "order_index" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.classroom_call_responses (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "message" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.classroom_call_room_issues (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "room_id" uuid NOT NULL,
  "description" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.classroom_call_rooms (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "campus" text DEFAULT 'Campus I'::text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.classroom_calls (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "room_name" text NOT NULL,
  "reason" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "accepted_by" uuid,
  "accepted_by_name" text,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "is_valid" boolean,
  "validation_reason" text,
  "treatment" text,
  "response_message" text,
  "campus" text
);
CREATE TABLE IF NOT EXISTS public.equipment (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "patrimony_code" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "available_quantity" integer DEFAULT 1 NOT NULL,
  "location" text NOT NULL,
  "campus" campus_enum NOT NULL,
  "description" text,
  "category" text,
  "image_url" text,
  "status" equipment_status DEFAULT 'available'::equipment_status NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "allow_external_loan" boolean DEFAULT true NOT NULL,
  "write_off_date" date,
  "write_off_reason" text,
  "write_off_by" uuid,
  "old_patrimony_code" text
);
CREATE TABLE IF NOT EXISTS public.equipment_loans (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "equipment_id" uuid NOT NULL,
  "quantity_borrowed" integer DEFAULT 1 NOT NULL,
  "borrower_name" text NOT NULL,
  "borrower_sector" text NOT NULL,
  "borrower_phone" text NOT NULL,
  "expected_return_date" date NOT NULL,
  "actual_return_date" date,
  "status" loan_status DEFAULT 'active'::loan_status NOT NULL,
  "loaned_by" uuid,
  "returned_by" uuid,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "borrower_signature" text,
  "return_signature" text,
  "borrower_type" text DEFAULT 'aluno'::text,
  "purpose" text,
  "authorizer_name" text,
  "authorizer_contact" text,
  "collaborator_name" text,
  "return_collaborator_name" text,
  "returner_name" text,
  "returner_phone" text,
  "item_condition" text,
  "all_items_returned" boolean DEFAULT true,
  "pending_items_description" text,
  "loan_group_id" uuid
);
CREATE TABLE IF NOT EXISTS public.equipment_reservations (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "equipment_id" uuid NOT NULL,
  "quantity_reserved" integer DEFAULT 1 NOT NULL,
  "requester_name" text NOT NULL,
  "requester_phone" text NOT NULL,
  "requester_sector" text NOT NULL,
  "requester_type" text DEFAULT 'aluno'::text NOT NULL,
  "purpose" text,
  "scheduled_pickup_date" date NOT NULL,
  "status" text DEFAULT 'awaiting_pickup'::text NOT NULL,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expected_return_date" date,
  "reservation_group_id" uuid
);
CREATE TABLE IF NOT EXISTS public.external_equipment_requests (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "equipment_id" uuid,
  "equipment_name" text NOT NULL,
  "quantity_requested" integer DEFAULT 1 NOT NULL,
  "requester_name" text NOT NULL,
  "requester_email" text NOT NULL,
  "requester_phone" text NOT NULL,
  "requester_organization" text,
  "purpose" text NOT NULL,
  "requested_date" date NOT NULL,
  "expected_return_date" date NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "admin_notes" text,
  "processed_by" uuid,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.external_users (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "cpf" text NOT NULL,
  "phone" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_type" text DEFAULT 'professor'::text,
  "sector" text,
  "approval_status" text DEFAULT 'pending'::text NOT NULL,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "rejection_reason" text
);
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "equipment_id" uuid NOT NULL,
  "movement_type" text NOT NULL,
  "from_location" text,
  "to_location" text,
  "from_campus" text,
  "to_campus" text,
  "quantity" integer DEFAULT 1 NOT NULL,
  "reason" text,
  "notes" text,
  "performed_by" uuid,
  "performed_by_name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.locker_exchanges (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "old_loan_id" uuid NOT NULL,
  "old_locker_id" uuid NOT NULL,
  "new_locker_id" uuid NOT NULL,
  "new_loan_id" uuid,
  "reason" text,
  "performed_by" uuid,
  "performed_by_name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.locker_loans (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "locker_id" uuid NOT NULL,
  "borrower_name" text NOT NULL,
  "borrower_phone" text NOT NULL,
  "borrower_sector" text,
  "expected_return_date" date NOT NULL,
  "actual_return_date" date,
  "status" loan_status DEFAULT 'active'::loan_status NOT NULL,
  "loaned_by" uuid,
  "returned_by" uuid,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "borrower_email" text,
  "return_signature" text,
  "returner_name" text,
  "borrower_signature" text
);
CREATE TABLE IF NOT EXISTS public.lockers (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "campus" campus_enum NOT NULL,
  "location" text NOT NULL,
  "description" text,
  "status" locker_status DEFAULT 'available'::locker_status NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.lost_items (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "description" text NOT NULL,
  "image_url" text,
  "campus" campus_enum NOT NULL,
  "found_location" text NOT NULL,
  "found_date" date NOT NULL,
  "received_date" date NOT NULL,
  "shelf" text,
  "box" text,
  "seal_number" text,
  "delivered_by_name" text NOT NULL,
  "delivered_by_contact" text,
  "registered_by" uuid,
  "status" text DEFAULT 'available'::text NOT NULL,
  "owner_name" text,
  "owner_email" text,
  "owner_phone" text,
  "owner_signature" text,
  "delivered_at" timestamp with time zone,
  "delivered_by_team_member" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "box_number" text
);
CREATE TABLE IF NOT EXISTS public.lost_items_archive (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "description" text NOT NULL,
  "image_url" text,
  "campus" campus_enum NOT NULL,
  "found_location" text NOT NULL,
  "found_date" date NOT NULL,
  "received_date" date NOT NULL,
  "delivered_by_name" text NOT NULL,
  "delivered_by_contact" text,
  "delivered_by_team_member" uuid,
  "owner_name" text,
  "owner_phone" text,
  "owner_email" text,
  "owner_signature" text,
  "status" text DEFAULT 'delivered'::text NOT NULL,
  "delivered_at" timestamp with time zone,
  "registered_by" uuid,
  "shelf" text,
  "box" text,
  "seal_number" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_by" uuid,
  "archived_by_name" text,
  "original_id" uuid NOT NULL,
  "box_number" text
);
CREATE TABLE IF NOT EXISTS public.material_requests (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "requester_id" uuid NOT NULL,
  "requester_name" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "priority" text DEFAULT 'normal'::text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "admin_notes" text,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "assigned_to" uuid,
  "assigned_to_name" text
);
CREATE TABLE IF NOT EXISTS public.profiles (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "position" text DEFAULT ''::text NOT NULL,
  "department" text DEFAULT ''::text NOT NULL,
  "avatar_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "email" text,
  "force_password_change" boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.ps_campus_floors (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "campus_id" uuid,
  "campus_name" text,
  "name" text NOT NULL,
  "rooms" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ps_campuses (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ps_candidates (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "registration_number" text,
  "cpf" text,
  "rg" text,
  "room" text,
  "campus" text,
  "exam_type" text,
  "seat_number" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "process_name" text,
  "phone" text,
  "email" text,
  "barcode" text
);
CREATE TABLE IF NOT EXISTS public.ps_collaborators (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text NOT NULL,
  "cpf" text,
  "matricula" text,
  "email" text,
  "phone" text,
  "role" text,
  "unit" text,
  "sector" text,
  "position" text,
  "journey" text,
  "pcd" text DEFAULT 'NORMAL'::text NOT NULL,
  "city" text,
  "state" text,
  "pix" text,
  "total_events" integer DEFAULT 0 NOT NULL,
  "average_rating" numeric DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "identity_doc" text,
  "mobile" text,
  "institution" text,
  "preferred_role" text,
  "notes" text,
  "active" boolean DEFAULT true NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ps_evaluation_retifications (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "evaluation_id" uuid NOT NULL,
  "collaborator_id" uuid,
  "collaborator_name" text,
  "requested_by" text NOT NULL,
  "criteria" text[] DEFAULT '{}'::text[] NOT NULL,
  "reason" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "coordinator_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ps_evaluations (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "collaborator_id" uuid,
  "assigned_role" text DEFAULT ''::text NOT NULL,
  "collaborator_name" text,
  "sector" text,
  "punctuality" integer DEFAULT 0 NOT NULL,
  "domain" integer DEFAULT 0 NOT NULL,
  "room_control" integer DEFAULT 0 NOT NULL,
  "attention_vigilance" integer DEFAULT 0 NOT NULL,
  "professional_posture" integer DEFAULT 0 NOT NULL,
  "communication" integer DEFAULT 0 NOT NULL,
  "organization" integer DEFAULT 0 NOT NULL,
  "incident_management" integer DEFAULT 0 NOT NULL,
  "teamwork" integer DEFAULT 0 NOT NULL,
  "final_score" numeric DEFAULT 0 NOT NULL,
  "classification" text,
  "observations" text,
  "evaluator_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ps_event_collaborators (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "collaborator_id" uuid,
  "collaborator_name" text NOT NULL,
  "assigned_role" text,
  "sector" text,
  "campus" text,
  "evaluated" boolean DEFAULT false NOT NULL,
  "absent" boolean DEFAULT false NOT NULL,
  "signature_url" text,
  "signed_at" timestamp with time zone,
  "signature_ip" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "role_value" text,
  "role_name" text,
  "pay_value" numeric DEFAULT 0 NOT NULL,
  "room" text,
  "building" text,
  "floor" text,
  "present" boolean DEFAULT false NOT NULL,
  "cpf" text,
  "identity_doc" text,
  "email" text,
  "phone" text,
  "mobile" text,
  "unit" text,
  "institution" text,
  "deposit_info" text,
  "pix" text,
  "notes" text,
  "import_tag" text
);
CREATE TABLE IF NOT EXISTS public.ps_events (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "date" date NOT NULL,
  "location" text,
  "description" text,
  "status" text DEFAULT 'planejamento'::text NOT NULL,
  "coordinator_name" text,
  "notes" text,
  "hidden_from_evaluation" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ps_fiscal_bank_applications (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "nome_completo" text NOT NULL,
  "telefone_contato" text NOT NULL,
  "instituto" text NOT NULL,
  "setor" text NOT NULL,
  "dominio_ingles" text,
  "habilidades_ingles" text[] DEFAULT '{}'::text[] NOT NULL,
  "leitura_portugues" text,
  "escrita_portugues" text,
  "letra_legivel" text,
  "agilidade_digitacao" text,
  "funcoes_com_conforto" text[] DEFAULT '{}'::text[] NOT NULL,
  "datas_disponibilidade" text[] DEFAULT '{}'::text[] NOT NULL,
  "observacoes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ps_fiscal_bank_config (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "datas" text[] DEFAULT '{}'::text[] NOT NULL,
  "data_indisponivel_label" text DEFAULT 'Não tenho disponibilidade'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ps_general_evaluations (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "batch_name" text NOT NULL,
  "evaluator_name" text NOT NULL,
  "evaluation_date" date DEFAULT CURRENT_DATE NOT NULL,
  "collaborator_name" text NOT NULL,
  "collaborator_id" uuid,
  "collaborator_role" text,
  "collaborator_position" text,
  "punctuality" integer DEFAULT 0 NOT NULL,
  "domain" integer DEFAULT 0 NOT NULL,
  "room_control" integer DEFAULT 0 NOT NULL,
  "attention_vigilance" integer DEFAULT 0 NOT NULL,
  "professional_posture" integer DEFAULT 0 NOT NULL,
  "communication" integer DEFAULT 0 NOT NULL,
  "organization" integer DEFAULT 0 NOT NULL,
  "incident_management" integer DEFAULT 0 NOT NULL,
  "teamwork" integer DEFAULT 0 NOT NULL,
  "final_score" numeric DEFAULT 0 NOT NULL,
  "classification" text,
  "observations" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ps_roles (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "value" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "pay_value" numeric DEFAULT 0 NOT NULL,
  "combined_roles" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ps_self_evaluations (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid,
  "respondent_name" text,
  "identified" boolean DEFAULT false NOT NULL,
  "role" text,
  "training_rating" integer,
  "training_comment" text,
  "organization_rating" integer,
  "organization_comment" text,
  "snack_rating" integer,
  "snack_comment" text,
  "partner_fiscal_rating" integer,
  "partner_fiscal_comment" text,
  "had_incident" boolean DEFAULT false NOT NULL,
  "incident_comment" text,
  "suggestions" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.reservation_logs (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "reservation_id" uuid,
  "room_id" uuid,
  "action" text NOT NULL,
  "details" text,
  "performed_by" uuid,
  "performer_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.reservation_reschedulings (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "reservation_id" uuid NOT NULL,
  "original_room_id" uuid NOT NULL,
  "new_room_id" uuid NOT NULL,
  "original_start_datetime" timestamp with time zone NOT NULL,
  "original_end_datetime" timestamp with time zone NOT NULL,
  "new_start_datetime" timestamp with time zone NOT NULL,
  "new_end_datetime" timestamp with time zone NOT NULL,
  "reason" text,
  "rescheduled_by" uuid,
  "rescheduled_by_name" text,
  "is_recurring_update" boolean DEFAULT false NOT NULL,
  "affected_reservations_count" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.reservation_rooms (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "capacity" integer DEFAULT 30 NOT NULL,
  "description" text,
  "location" text,
  "campus" campus_enum NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "auto_confirm" boolean DEFAULT true NOT NULL,
  "max_advance_days" integer,
  "observations" text,
  "equipment" jsonb DEFAULT '[]'::jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS public.reservations (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "room_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "requester_name" text NOT NULL,
  "requester_email" text NOT NULL,
  "requester_phone" text,
  "attendees_count" integer DEFAULT 1 NOT NULL,
  "start_datetime" timestamp with time zone NOT NULL,
  "end_datetime" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "is_external" boolean DEFAULT false NOT NULL,
  "created_by" uuid,
  "approved_by" uuid,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_fixed" boolean DEFAULT false NOT NULL,
  "external_user_id" uuid,
  "requester_cpf" text,
  "original_reservation_id" uuid,
  "import_tag" text
);
CREATE TABLE IF NOT EXISTS public.role_permissions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "role" app_role NOT NULL,
  "module" text NOT NULL,
  "action" text NOT NULL,
  "allowed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.room_checklists (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "room_id" uuid NOT NULL,
  "filled_by" uuid NOT NULL,
  "shift" text NOT NULL,
  "observations" text,
  "filled_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.room_combinations (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "parent_room_id" uuid NOT NULL,
  "linked_room_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.rooms (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "campus" campus_enum NOT NULL,
  "building" text NOT NULL,
  "floor" text,
  "capacity" integer,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "checklist_items" jsonb DEFAULT '[]'::jsonb
);
CREATE TABLE IF NOT EXISTS public.semester_checklist_items (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "checklist_id" uuid NOT NULL,
  "category" text NOT NULL,
  "item_name" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "observation" text,
  "maintenance_type" semester_maintenance_type,
  "needs_ticket" boolean DEFAULT false NOT NULL,
  "needs_label" boolean DEFAULT false NOT NULL,
  "photo_url" text,
  "status" semester_item_status DEFAULT 'pending_analysis'::semester_item_status NOT NULL,
  "ticket_number" text,
  "ticket_opened_at" timestamp with time zone,
  "ticket_responsible" text,
  "maintenance_done_at" timestamp with time zone,
  "closure_observation" text,
  "closure_responsible" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.semester_checklists (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "competency_id" uuid NOT NULL,
  "room_id" uuid,
  "room_name" text NOT NULL,
  "room_code" text,
  "campus" text,
  "floor" text,
  "responsible_id" uuid,
  "responsible_name" text NOT NULL,
  "checklist_date" date DEFAULT CURRENT_DATE NOT NULL,
  "general_observation" text,
  "status" semester_item_status DEFAULT 'pending_analysis'::semester_item_status NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "confirmed_categories" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_by_id" uuid,
  "created_by_name" text,
  "filled_by_id" uuid,
  "filled_by_name" text,
  "filled_at" timestamp with time zone,
  "projectors_confirmed" boolean DEFAULT false NOT NULL
);
CREATE TABLE IF NOT EXISTS public.semester_competencies (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "status" semester_competency_status DEFAULT 'draft'::semester_competency_status NOT NULL,
  "start_date" date,
  "end_date" date,
  "created_by" uuid,
  "created_by_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.semester_furniture_details (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "checklist_item_id" uuid NOT NULL,
  "item_type" text NOT NULL,
  "problem_type" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "maintenance_type" semester_maintenance_type,
  "observation" text,
  "status" semester_item_status DEFAULT 'pending_analysis'::semester_item_status NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.semester_item_options (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "category" text NOT NULL,
  "label" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.semester_labels (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "checklist_item_id" uuid,
  "furniture_detail_id" uuid,
  "competency_id" uuid,
  "label_code" text NOT NULL,
  "sequence_number" integer NOT NULL,
  "sequence_total" integer NOT NULL,
  "generated_by" uuid,
  "generated_by_name" text,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.semester_projectors (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "checklist_id" uuid NOT NULL,
  "patrimony" text,
  "model" text,
  "lamp_hours" integer,
  "actions" text[] DEFAULT '{}'::text[] NOT NULL,
  "others_text" text,
  "observation" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.shift_handover_incidents (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "handover_id" uuid NOT NULL,
  "incident_type" text NOT NULL,
  "description" text,
  "location" text,
  "treatment" text
);
CREATE TABLE IF NOT EXISTS public.shift_handover_tasks (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "handover_id" uuid NOT NULL,
  "task_name" text NOT NULL,
  "answer" boolean DEFAULT false NOT NULL,
  "observation" text
);
CREATE TABLE IF NOT EXISTS public.shift_handovers (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shift" text NOT NULL,
  "day_of_week" text NOT NULL,
  "handover_date" date DEFAULT CURRENT_DATE NOT NULL,
  "sector" text DEFAULT 'Recursos Didáticos'::text NOT NULL,
  "unit" text DEFAULT 'FCM Unidade I'::text NOT NULL,
  "has_impact_incident" boolean DEFAULT false NOT NULL,
  "general_observations" text,
  "collaborator_name" text NOT NULL,
  "collaborator_time" text NOT NULL,
  "filled_by" uuid NOT NULL,
  "filled_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.task_comments (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "user_id" uuid,
  "user_name" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "attachment_urls" text[]
);
CREATE TABLE IF NOT EXISTS public.task_history (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "user_id" uuid,
  "user_name" text NOT NULL,
  "action" text NOT NULL,
  "field_changed" text,
  "old_value" text,
  "new_value" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.task_team_members (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "user_name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.tasks (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "priority" text DEFAULT 'normal'::text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "category" text,
  "due_date" date,
  "created_by" uuid,
  "assigned_to" uuid,
  "created_by_name" text NOT NULL,
  "assigned_to_name" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "estimated_hours" numeric(5,2),
  "actual_hours" numeric(5,2),
  "tags" text[],
  "attachments" jsonb DEFAULT '[]'::jsonb,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "event_start_datetime" timestamp with time zone,
  "event_end_datetime" timestamp with time zone,
  "recurrence_type" text,
  "recurrence_days" text[],
  "recurrence_last_run_date" date
);
CREATE TABLE IF NOT EXISTS public.uber_requests (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "requester_name" text NOT NULL,
  "origin" text NOT NULL,
  "destination" text NOT NULL,
  "trip_date" date NOT NULL,
  "trip_time" text NOT NULL,
  "reason" text NOT NULL,
  "notes" text,
  "status" text DEFAULT 'registrada'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "role" app_role DEFAULT 'assistente'::app_role NOT NULL
);

-- ============ CONSTRAINTS (PK / UNIQUE / CHECK) ============

DO $$ BEGIN ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_key_key UNIQUE (key); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.checklist_answers ADD CONSTRAINT checklist_answers_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.checklist_questions ADD CONSTRAINT checklist_questions_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.classroom_call_responses ADD CONSTRAINT classroom_call_responses_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.classroom_call_room_issues ADD CONSTRAINT classroom_call_room_issues_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.classroom_call_rooms ADD CONSTRAINT classroom_call_rooms_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.classroom_calls ADD CONSTRAINT classroom_calls_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.equipment ADD CONSTRAINT equipment_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.equipment ADD CONSTRAINT equipment_patrimony_code_key UNIQUE (patrimony_code); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.equipment_loans ADD CONSTRAINT equipment_loans_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.equipment_reservations ADD CONSTRAINT equipment_reservations_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.external_equipment_requests ADD CONSTRAINT external_equipment_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'awaiting_pickup'::text, 'loaned'::text, 'returned'::text]))); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.external_equipment_requests ADD CONSTRAINT external_equipment_requests_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.external_users ADD CONSTRAINT external_users_user_type_check CHECK ((user_type = ANY (ARRAY['professor'::text, 'colaborador'::text]))); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.external_users ADD CONSTRAINT external_users_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.external_users ADD CONSTRAINT external_users_user_id_key UNIQUE (user_id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['transfer'::text, 'write_off'::text, 'import'::text, 'adjustment'::text]))); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.locker_exchanges ADD CONSTRAINT locker_exchanges_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.locker_loans ADD CONSTRAINT locker_loans_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.lockers ADD CONSTRAINT lockers_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.lockers ADD CONSTRAINT lockers_code_key UNIQUE (code); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.lost_items ADD CONSTRAINT lost_items_status_check CHECK ((status = ANY (ARRAY['available'::text, 'pending'::text, 'delivered'::text, 'expired'::text]))); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.lost_items ADD CONSTRAINT lost_items_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.lost_items ADD CONSTRAINT lost_items_code_key UNIQUE (code); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.lost_items_archive ADD CONSTRAINT lost_items_archive_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.material_requests ADD CONSTRAINT material_requests_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.material_requests ADD CONSTRAINT material_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'delivered'::text]))); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.material_requests ADD CONSTRAINT material_requests_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_campus_floors ADD CONSTRAINT ps_campus_floors_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_campuses ADD CONSTRAINT ps_campuses_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_candidates ADD CONSTRAINT ps_candidates_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_collaborators ADD CONSTRAINT ps_collaborators_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_evaluation_retifications ADD CONSTRAINT ps_evaluation_retifications_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_evaluations ADD CONSTRAINT ps_evaluations_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_event_collaborators ADD CONSTRAINT ps_event_collaborators_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_events ADD CONSTRAINT ps_events_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_fiscal_bank_applications ADD CONSTRAINT ps_fiscal_bank_applications_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_fiscal_bank_config ADD CONSTRAINT ps_fiscal_bank_config_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_general_evaluations ADD CONSTRAINT ps_general_evaluations_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_roles ADD CONSTRAINT ps_roles_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_roles ADD CONSTRAINT ps_roles_value_key UNIQUE (value); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_self_evaluations ADD CONSTRAINT ps_self_evaluations_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservation_logs ADD CONSTRAINT reservation_logs_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservation_reschedulings ADD CONSTRAINT reservation_reschedulings_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_code_key UNIQUE (code); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservations ADD CONSTRAINT reservations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text]))); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservations ADD CONSTRAINT reservations_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_module_action_key UNIQUE (role, module, action); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.room_checklists ADD CONSTRAINT room_checklists_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.room_combinations ADD CONSTRAINT room_combinations_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.room_combinations ADD CONSTRAINT room_combinations_parent_room_id_linked_room_id_key UNIQUE (parent_room_id, linked_room_id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.rooms ADD CONSTRAINT rooms_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_checklist_items ADD CONSTRAINT semester_checklist_items_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_checklists ADD CONSTRAINT semester_checklists_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_competencies ADD CONSTRAINT semester_competencies_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_furniture_details ADD CONSTRAINT semester_furniture_details_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_item_options ADD CONSTRAINT semester_item_options_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_item_options ADD CONSTRAINT semester_item_options_category_label_key UNIQUE (category, label); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_labels ADD CONSTRAINT semester_labels_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_labels ADD CONSTRAINT semester_labels_label_code_key UNIQUE (label_code); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_projectors ADD CONSTRAINT semester_projectors_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shift_handover_incidents ADD CONSTRAINT shift_handover_incidents_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shift_handover_tasks ADD CONSTRAINT shift_handover_tasks_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shift_handovers ADD CONSTRAINT shift_handovers_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.task_history ADD CONSTRAINT task_history_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.task_team_members ADD CONSTRAINT task_team_members_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.task_team_members ADD CONSTRAINT task_team_members_task_id_user_id_key UNIQUE (task_id, user_id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.uber_requests ADD CONSTRAINT uber_requests_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.uber_requests ADD CONSTRAINT uber_requests_code_key UNIQUE (code); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;

-- ============ FOREIGN KEYS ============

DO $$ BEGIN ALTER TABLE public.checklist_answers ADD CONSTRAINT checklist_answers_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES room_checklists(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.checklist_answers ADD CONSTRAINT checklist_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES checklist_questions(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.classroom_call_room_issues ADD CONSTRAINT classroom_call_room_issues_room_id_fkey FOREIGN KEY (room_id) REFERENCES classroom_call_rooms(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.classroom_calls ADD CONSTRAINT classroom_calls_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.equipment ADD CONSTRAINT equipment_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.equipment_loans ADD CONSTRAINT equipment_loans_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.equipment_loans ADD CONSTRAINT equipment_loans_loaned_by_fkey FOREIGN KEY (loaned_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.equipment_loans ADD CONSTRAINT equipment_loans_returned_by_fkey FOREIGN KEY (returned_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.equipment_reservations ADD CONSTRAINT equipment_reservations_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.external_equipment_requests ADD CONSTRAINT external_equipment_requests_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.locker_exchanges ADD CONSTRAINT locker_exchanges_new_loan_id_fkey FOREIGN KEY (new_loan_id) REFERENCES locker_loans(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.locker_exchanges ADD CONSTRAINT locker_exchanges_new_locker_id_fkey FOREIGN KEY (new_locker_id) REFERENCES lockers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.locker_exchanges ADD CONSTRAINT locker_exchanges_old_loan_id_fkey FOREIGN KEY (old_loan_id) REFERENCES locker_loans(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.locker_exchanges ADD CONSTRAINT locker_exchanges_old_locker_id_fkey FOREIGN KEY (old_locker_id) REFERENCES lockers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.locker_exchanges ADD CONSTRAINT locker_exchanges_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.locker_loans ADD CONSTRAINT locker_loans_loaned_by_fkey FOREIGN KEY (loaned_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.locker_loans ADD CONSTRAINT locker_loans_locker_id_fkey FOREIGN KEY (locker_id) REFERENCES lockers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.locker_loans ADD CONSTRAINT locker_loans_returned_by_fkey FOREIGN KEY (returned_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.lost_items ADD CONSTRAINT lost_items_delivered_by_team_member_fkey FOREIGN KEY (delivered_by_team_member) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.lost_items ADD CONSTRAINT lost_items_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.material_requests ADD CONSTRAINT material_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_campus_floors ADD CONSTRAINT ps_campus_floors_campus_id_fkey FOREIGN KEY (campus_id) REFERENCES ps_campuses(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_candidates ADD CONSTRAINT ps_candidates_event_id_fkey FOREIGN KEY (event_id) REFERENCES ps_events(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_evaluation_retifications ADD CONSTRAINT ps_evaluation_retifications_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES ps_collaborators(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_evaluation_retifications ADD CONSTRAINT ps_evaluation_retifications_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES ps_evaluations(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_evaluation_retifications ADD CONSTRAINT ps_evaluation_retifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES ps_events(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_evaluations ADD CONSTRAINT ps_evaluations_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES ps_collaborators(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_evaluations ADD CONSTRAINT ps_evaluations_event_id_fkey FOREIGN KEY (event_id) REFERENCES ps_events(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_event_collaborators ADD CONSTRAINT ps_event_collaborators_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES ps_collaborators(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_event_collaborators ADD CONSTRAINT ps_event_collaborators_event_id_fkey FOREIGN KEY (event_id) REFERENCES ps_events(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_general_evaluations ADD CONSTRAINT ps_general_evaluations_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES ps_collaborators(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ps_self_evaluations ADD CONSTRAINT ps_self_evaluations_event_id_fkey FOREIGN KEY (event_id) REFERENCES ps_events(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservation_logs ADD CONSTRAINT reservation_logs_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservation_logs ADD CONSTRAINT reservation_logs_room_id_fkey FOREIGN KEY (room_id) REFERENCES reservation_rooms(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservation_reschedulings ADD CONSTRAINT reservation_reschedulings_new_room_id_fkey FOREIGN KEY (new_room_id) REFERENCES reservation_rooms(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservation_reschedulings ADD CONSTRAINT reservation_reschedulings_original_room_id_fkey FOREIGN KEY (original_room_id) REFERENCES reservation_rooms(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservation_reschedulings ADD CONSTRAINT reservation_reschedulings_rescheduled_by_fkey FOREIGN KEY (rescheduled_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservation_reschedulings ADD CONSTRAINT reservation_reschedulings_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservations ADD CONSTRAINT reservations_external_user_id_fkey FOREIGN KEY (external_user_id) REFERENCES external_users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reservations ADD CONSTRAINT reservations_room_id_fkey FOREIGN KEY (room_id) REFERENCES reservation_rooms(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.room_checklists ADD CONSTRAINT room_checklists_filled_by_fkey FOREIGN KEY (filled_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.room_checklists ADD CONSTRAINT room_checklists_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.room_combinations ADD CONSTRAINT room_combinations_linked_room_id_fkey FOREIGN KEY (linked_room_id) REFERENCES reservation_rooms(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.room_combinations ADD CONSTRAINT room_combinations_parent_room_id_fkey FOREIGN KEY (parent_room_id) REFERENCES reservation_rooms(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_checklist_items ADD CONSTRAINT semester_checklist_items_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES semester_checklists(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_checklists ADD CONSTRAINT semester_checklists_competency_id_fkey FOREIGN KEY (competency_id) REFERENCES semester_competencies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_checklists ADD CONSTRAINT semester_checklists_room_id_fkey FOREIGN KEY (room_id) REFERENCES reservation_rooms(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_furniture_details ADD CONSTRAINT semester_furniture_details_checklist_item_id_fkey FOREIGN KEY (checklist_item_id) REFERENCES semester_checklist_items(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_item_options ADD CONSTRAINT semester_item_options_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_labels ADD CONSTRAINT semester_labels_checklist_item_id_fkey FOREIGN KEY (checklist_item_id) REFERENCES semester_checklist_items(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_labels ADD CONSTRAINT semester_labels_competency_id_fkey FOREIGN KEY (competency_id) REFERENCES semester_competencies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_labels ADD CONSTRAINT semester_labels_furniture_detail_id_fkey FOREIGN KEY (furniture_detail_id) REFERENCES semester_furniture_details(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.semester_projectors ADD CONSTRAINT semester_projectors_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES semester_checklists(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shift_handover_incidents ADD CONSTRAINT shift_handover_incidents_handover_id_fkey FOREIGN KEY (handover_id) REFERENCES shift_handovers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shift_handover_tasks ADD CONSTRAINT shift_handover_tasks_handover_id_fkey FOREIGN KEY (handover_id) REFERENCES shift_handovers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.task_history ADD CONSTRAINT task_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.task_team_members ADD CONSTRAINT task_team_members_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;

-- ============ INDICES ============

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON public.activity_logs USING btree (module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_external_users_approval_status ON public.external_users USING btree (approval_status);
CREATE INDEX IF NOT EXISTS idx_external_users_cpf ON public.external_users USING btree (cpf);
CREATE INDEX IF NOT EXISTS idx_external_users_email ON public.external_users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON public.inventory_movements USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_equipment_id ON public.inventory_movements USING btree (equipment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON public.inventory_movements USING btree (movement_type);
CREATE INDEX IF NOT EXISTS idx_lost_items_campus ON public.lost_items USING btree (campus);
CREATE INDEX IF NOT EXISTS idx_lost_items_code ON public.lost_items USING btree (code);
CREATE INDEX IF NOT EXISTS idx_lost_items_code_trgm ON public.lost_items USING gin (code extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lost_items_created_at ON public.lost_items USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_items_description_trgm ON public.lost_items USING gin (description extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lost_items_found_location_trgm ON public.lost_items USING gin (found_location extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lost_items_owner_name ON public.lost_items USING btree (owner_name);
CREATE INDEX IF NOT EXISTS idx_lost_items_received_date ON public.lost_items USING btree (received_date);
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON public.lost_items USING btree (status);
CREATE INDEX IF NOT EXISTS idx_lost_items_status_campus ON public.lost_items USING btree (status, campus);
CREATE INDEX IF NOT EXISTS idx_lost_items_status_created_at ON public.lost_items USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_items_archive_archived_at ON public.lost_items_archive USING btree (archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_items_archive_campus ON public.lost_items_archive USING btree (campus);
CREATE INDEX IF NOT EXISTS idx_lost_items_archive_campus_archived ON public.lost_items_archive USING btree (campus, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_items_archive_code ON public.lost_items_archive USING btree (code);
CREATE INDEX IF NOT EXISTS idx_material_requests_assigned_to ON public.material_requests USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email);
CREATE UNIQUE INDEX IF NOT EXISTS ps_collaborators_cpf_unique ON public.ps_collaborators USING btree (cpf) WHERE ((cpf IS NOT NULL) AND (cpf <> ''::text));
CREATE UNIQUE INDEX IF NOT EXISTS ps_event_collaborators_event_collab_unique ON public.ps_event_collaborators USING btree (event_id, collaborator_id) WHERE (collaborator_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_reschedulings_created_at ON public.reservation_reschedulings USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reschedulings_new_start_datetime ON public.reservation_reschedulings USING btree (new_start_datetime);
CREATE INDEX IF NOT EXISTS idx_reschedulings_reservation_id ON public.reservation_reschedulings USING btree (reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservations_external_user ON public.reservations USING btree (external_user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_import_tag ON public.reservations USING btree (import_tag) WHERE (import_tag IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_reservations_original ON public.reservations USING btree (original_reservation_id);
CREATE INDEX IF NOT EXISTS idx_semester_items_checklist ON public.semester_checklist_items USING btree (checklist_id);
CREATE INDEX IF NOT EXISTS idx_semester_items_status ON public.semester_checklist_items USING btree (status);
CREATE INDEX IF NOT EXISTS idx_semester_checklists_competency ON public.semester_checklists USING btree (competency_id);
CREATE INDEX IF NOT EXISTS idx_semester_checklists_room ON public.semester_checklists USING btree (room_id);
CREATE INDEX IF NOT EXISTS idx_semester_furniture_item ON public.semester_furniture_details USING btree (checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_semester_item_options_category ON public.semester_item_options USING btree (category, sort_order);
CREATE INDEX IF NOT EXISTS idx_semester_labels_competency ON public.semester_labels USING btree (competency_id);
CREATE INDEX IF NOT EXISTS idx_semester_labels_furniture ON public.semester_labels USING btree (furniture_detail_id);
CREATE INDEX IF NOT EXISTS idx_semester_labels_item ON public.semester_labels USING btree (checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_semester_projectors_checklist ON public.semester_projectors USING btree (checklist_id);
CREATE INDEX IF NOT EXISTS idx_uber_requests_created_at ON public.uber_requests USING btree (created_at DESC);

-- ============ FUNCOES ============

CREATE OR REPLACE FUNCTION public.check_reservation_conflict(p_room_id uuid, p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_exclude_reservation_id uuid DEFAULT NULL::uuid, p_is_external boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    linked_rooms UUID[];
    parent_rooms UUID[];
    check_start TIMESTAMP WITH TIME ZONE;
    check_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- For external reservations, add 15 minute buffer before and after
    IF p_is_external THEN
        check_start := p_start_datetime - INTERVAL '15 minutes';
        check_end := p_end_datetime + INTERVAL '15 minutes';
    ELSE
        check_start := p_start_datetime;
        check_end := p_end_datetime;
    END IF;

    -- Get rooms linked to this room
    SELECT ARRAY_AGG(linked_room_id) INTO linked_rooms
    FROM public.room_combinations
    WHERE parent_room_id = p_room_id;
    
    -- Get parent rooms that link to this room
    SELECT ARRAY_AGG(parent_room_id) INTO parent_rooms
    FROM public.room_combinations
    WHERE linked_room_id = p_room_id;
    
    linked_rooms := COALESCE(linked_rooms, ARRAY[]::UUID[]);
    parent_rooms := COALESCE(parent_rooms, ARRAY[]::UUID[]);

    RETURN EXISTS (
        SELECT 1
        FROM public.reservations
        WHERE status NOT IN ('cancelled')
          AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
          AND (
              (check_start >= start_datetime AND check_start < end_datetime)
              OR (check_end > start_datetime AND check_end <= end_datetime)
              OR (check_start <= start_datetime AND check_end >= end_datetime)
          )
          AND (
              room_id = p_room_id
              OR room_id = ANY(linked_rooms)
              OR room_id = ANY(parent_rooms)
          )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_reservation_conflict(p_room_id uuid, p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_exclude_reservation_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    linked_rooms UUID[];
    parent_rooms UUID[];
BEGIN
    -- Get rooms linked to this room
    SELECT ARRAY_AGG(linked_room_id) INTO linked_rooms
    FROM public.room_combinations
    WHERE parent_room_id = p_room_id;
    
    -- Get parent rooms that link to this room
    SELECT ARRAY_AGG(parent_room_id) INTO parent_rooms
    FROM public.room_combinations
    WHERE linked_room_id = p_room_id;
    
    linked_rooms := COALESCE(linked_rooms, ARRAY[]::UUID[]);
    parent_rooms := COALESCE(parent_rooms, ARRAY[]::UUID[]);

    RETURN EXISTS (
        SELECT 1
        FROM public.reservations
        WHERE status NOT IN ('cancelled')
          AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
          AND (
              (p_start_datetime >= start_datetime AND p_start_datetime < end_datetime)
              OR (p_end_datetime > start_datetime AND p_end_datetime <= end_datetime)
              OR (p_start_datetime <= start_datetime AND p_end_datetime >= end_datetime)
          )
          AND (
              room_id = p_room_id
              OR room_id = ANY(linked_rooms)
              OR room_id = ANY(parent_rooms)
          )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_public_classroom_call(p_room_name text, p_reason text, p_campus text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF coalesce(trim(p_room_name),'') = '' THEN
    RAISE EXCEPTION 'Sala obrigatória';
  END IF;
  INSERT INTO public.classroom_calls (room_name, reason, status, campus)
  VALUES (left(trim(p_room_name), 200), left(coalesce(trim(p_reason),''), 1000), 'pending', left(coalesce(trim(p_campus),''), 100))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_public_uber_request(p_requester_name text, p_origin text, p_destination text, p_trip_date date, p_trip_time time without time zone, p_reason text, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, code text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
BEGIN
  IF coalesce(trim(p_requester_name),'') = '' OR coalesce(trim(p_origin),'') = ''
     OR coalesce(trim(p_destination),'') = '' OR coalesce(trim(p_reason),'') = ''
     OR p_trip_date IS NULL OR p_trip_time IS NULL THEN
    RAISE EXCEPTION 'Preencha todos os campos obrigatórios';
  END IF;

  v_code := 'UBR-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text), 1, 5));

  RETURN QUERY
  INSERT INTO public.uber_requests (
    code, requester_name, origin, destination, trip_date, trip_time, reason, notes, status
  ) VALUES (
    v_code,
    left(trim(p_requester_name), 200),
    left(trim(p_origin), 300),
    left(trim(p_destination), 300),
    p_trip_date,
    p_trip_time,
    left(trim(p_reason), 1000),
    left(NULLIF(trim(coalesce(p_notes,'')),''), 1000),
    'registrada'
  )
  RETURNING uber_requests.id, uber_requests.code, uber_requests.created_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_task_creator_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name text;
  v_email text;
BEGIN
  -- Keep creator immutable after creation
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    RETURN NEW;
  END IF;

  -- On insert, bind creator to authenticated user when available
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();

    SELECT p.full_name, p.email
      INTO v_full_name, v_email
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    ORDER BY p.created_at DESC
    LIMIT 1;

    NEW.created_by_name := COALESCE(v_full_name, v_email, NEW.created_by_name, 'Sistema');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_old_lost_items()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE public.lost_items
    SET status = 'expired', updated_at = now()
    WHERE status = 'available'
      AND received_date < CURRENT_DATE - INTERVAL '60 days';
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_available_rooms(p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_attendees_count integer DEFAULT 1, p_campus campus_enum DEFAULT NULL::campus_enum, p_is_external boolean DEFAULT false)
 RETURNS TABLE(id uuid, name text, code text, capacity integer, description text, location text, campus campus_enum)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    check_start TIMESTAMP WITH TIME ZONE;
    check_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- For external reservations, add 15 minute buffer before and after
    IF p_is_external THEN
        check_start := p_start_datetime - INTERVAL '15 minutes';
        check_end := p_end_datetime + INTERVAL '15 minutes';
    ELSE
        check_start := p_start_datetime;
        check_end := p_end_datetime;
    END IF;

    RETURN QUERY
    SELECT 
        rr.id,
        rr.name,
        rr.code,
        rr.capacity,
        rr.description,
        rr.location,
        rr.campus
    FROM public.reservation_rooms rr
    WHERE rr.is_active = true
      AND rr.capacity >= p_attendees_count
      AND (p_campus IS NULL OR rr.campus = p_campus)
      AND NOT EXISTS (
          SELECT 1
          FROM public.reservations r
          WHERE r.status NOT IN ('cancelled')
            AND (
                (check_start >= r.start_datetime AND check_start < r.end_datetime)
                OR (check_end > r.start_datetime AND check_end <= r.end_datetime)
                OR (check_start <= r.start_datetime AND check_end >= r.end_datetime)
            )
            AND (
                -- Direct reservation on this room
                r.room_id = rr.id
                -- Reservation on a linked room (this room is parent)
                OR rr.id = ANY(get_linked_rooms(r.room_id))
                -- Reservation on a parent room (this room is linked)
                OR r.room_id = ANY(
                    SELECT rc.parent_room_id FROM public.room_combinations rc WHERE rc.linked_room_id = rr.id
                )
                -- NEW: This room is a parent and one of its linked rooms has a reservation
                OR EXISTS (
                    SELECT 1 FROM public.room_combinations rc 
                    WHERE rc.parent_room_id = rr.id AND rc.linked_room_id = r.room_id
                )
                -- NEW: This room is a parent and one of its linked rooms is blocked by another parent
                OR EXISTS (
                    SELECT 1 FROM public.room_combinations rc 
                    WHERE rc.parent_room_id = rr.id 
                    AND rc.linked_room_id = ANY(get_linked_rooms(r.room_id))
                )
            )
      )
    ORDER BY rr.code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_available_rooms(p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_attendees_count integer DEFAULT 1, p_campus campus_enum DEFAULT NULL::campus_enum)
 RETURNS TABLE(id uuid, name text, code text, capacity integer, description text, location text, campus campus_enum)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        rr.id,
        rr.name,
        rr.code,
        rr.capacity,
        rr.description,
        rr.location,
        rr.campus
    FROM public.reservation_rooms rr
    WHERE rr.is_active = true
      AND rr.capacity >= p_attendees_count
      AND (p_campus IS NULL OR rr.campus = p_campus)
      AND NOT EXISTS (
          SELECT 1
          FROM public.reservations r
          WHERE r.status NOT IN ('cancelled')
            AND (
                (p_start_datetime >= r.start_datetime AND p_start_datetime < r.end_datetime)
                OR (p_end_datetime > r.start_datetime AND p_end_datetime <= r.end_datetime)
                OR (p_start_datetime <= r.start_datetime AND p_end_datetime >= r.end_datetime)
            )
            AND (
                -- Direct reservation on this room
                r.room_id = rr.id
                -- Reservation on a linked room (this room is parent)
                OR rr.id = ANY(get_linked_rooms(r.room_id))
                -- Reservation on a parent room (this room is linked)
                OR r.room_id = ANY(
                    SELECT rc.parent_room_id FROM public.room_combinations rc WHERE rc.linked_room_id = rr.id
                )
                -- NEW: This room is a parent and one of its linked rooms has a reservation
                OR EXISTS (
                    SELECT 1 FROM public.room_combinations rc 
                    WHERE rc.parent_room_id = rr.id AND rc.linked_room_id = r.room_id
                )
                -- NEW: This room is a parent and one of its linked rooms is blocked by another parent
                OR EXISTS (
                    SELECT 1 FROM public.room_combinations rc 
                    WHERE rc.parent_room_id = rr.id 
                    AND rc.linked_room_id = ANY(get_linked_rooms(r.room_id))
                )
            )
      )
    ORDER BY rr.code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_linked_rooms(p_room_id uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    result UUID[];
BEGIN
    -- Get rooms linked to this room (as parent)
    SELECT ARRAY_AGG(linked_room_id) INTO result
    FROM public.room_combinations
    WHERE parent_room_id = p_room_id;
    
    RETURN COALESCE(result, ARRAY[]::UUID[]);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_classroom_call_status(p_id uuid)
 RETURNS TABLE(status text, accepted_by_name text, accepted_at timestamp with time zone, response_message text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.status, c.accepted_by_name, c.accepted_at, c.response_message
  FROM public.classroom_calls c
  WHERE c.id = p_id AND c.created_at > now() - interval '6 hours';
$function$;

CREATE OR REPLACE FUNCTION public.get_public_reservations(p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS TABLE(id uuid, title text, start_datetime timestamp with time zone, end_datetime timestamp with time zone, status text, attendees_count integer, room_id uuid, description text, notes text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, title, start_datetime, end_datetime, status, attendees_count, room_id, description, notes
  FROM public.reservations
  WHERE status IN ('pending','confirmed')
    AND start_datetime >= p_start
    AND start_datetime <= p_end;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT rp.allowed
     FROM public.role_permissions rp
     INNER JOIN public.user_roles ur ON ur.role = rp.role
     WHERE ur.user_id = _user_id
       AND rp.module = _module
       AND rp.action = _action
     LIMIT 1),
    -- Default: admin has all permissions, others depend on action type
    CASE 
      WHEN is_admin(_user_id) THEN true
      ELSE false
    END
  )
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_or_analista(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'analista')
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.ps_public_event_roster(p_event_id uuid)
 RETURNS TABLE(id uuid, collaborator_id uuid, collaborator_name text, assigned_role text, role_name text, sector text, signed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ec.id, ec.collaborator_id, ec.collaborator_name, ec.assigned_role, ec.role_name, ec.sector, ec.signed_at
  FROM public.ps_event_collaborators ec
  JOIN public.ps_events e ON e.id = ec.event_id
  WHERE ec.event_id = p_event_id
    AND COALESCE(e.hidden_from_evaluation, false) = false
  ORDER BY ec.collaborator_name;
$function$;

CREATE OR REPLACE FUNCTION public.ps_public_sign_attendance(p_link_id uuid, p_signature text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_signature IS NULL OR length(p_signature) < 50 OR length(p_signature) > 500000 THEN
    RAISE EXCEPTION 'Assinatura inválida';
  END IF;
  UPDATE public.ps_event_collaborators ec
  SET signature_url = p_signature, signed_at = now()
  WHERE ec.id = p_link_id
    AND ec.signed_at IS NULL
    AND EXISTS (SELECT 1 FROM public.ps_events e WHERE e.id = ec.event_id AND COALESCE(e.hidden_from_evaluation,false) = false);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado ou já assinado';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ps_public_submit_evaluation(p_event_id uuid, p_link_id uuid, p_assigned_role text, p_evaluator_name text, p_observations text, p_criteria jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link public.ps_event_collaborators%ROWTYPE;
  v_keys text[] := ARRAY['punctuality','domain','room_control','attention_vigilance','professional_posture','communication','organization','incident_management','teamwork'];
  k text;
  v int;
  v_sum numeric := 0;
  v_score numeric;
  v_class text;
  v_id uuid;
BEGIN
  IF coalesce(trim(p_evaluator_name),'') = '' THEN
    RAISE EXCEPTION 'Informe o nome do avaliador';
  END IF;

  SELECT * INTO v_link FROM public.ps_event_collaborators
  WHERE id = p_link_id AND event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fiscal não encontrado neste evento';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ps_events e WHERE e.id = p_event_id AND COALESCE(e.hidden_from_evaluation,false) = false) THEN
    RAISE EXCEPTION 'Evento não disponível para avaliação';
  END IF;

  FOREACH k IN ARRAY v_keys LOOP
    v := (p_criteria ->> k)::int;
    IF v IS NULL OR v < 1 OR v > 5 THEN
      RAISE EXCEPTION 'Critério inválido: %', k;
    END IF;
    v_sum := v_sum + v;
  END LOOP;

  v_score := round((v_sum / array_length(v_keys,1))::numeric, 2);
  v_class := CASE
    WHEN v_score >= 4.5 THEN 'excelente'
    WHEN v_score >= 3.5 THEN 'bom'
    WHEN v_score >= 2.5 THEN 'regular'
    ELSE 'insuficiente'
  END;

  INSERT INTO public.ps_evaluations (
    event_id, collaborator_id, collaborator_name, sector, assigned_role,
    evaluator_name, observations,
    punctuality, domain, room_control, attention_vigilance, professional_posture,
    communication, organization, incident_management, teamwork,
    final_score, classification
  ) VALUES (
    p_event_id, v_link.collaborator_id, v_link.collaborator_name, v_link.sector,
    COALESCE(NULLIF(trim(p_assigned_role),''), v_link.assigned_role, 'fiscal_sala'),
    left(trim(p_evaluator_name), 200), left(NULLIF(trim(coalesce(p_observations,'')),''), 2000),
    (p_criteria->>'punctuality')::int, (p_criteria->>'domain')::int, (p_criteria->>'room_control')::int,
    (p_criteria->>'attention_vigilance')::int, (p_criteria->>'professional_posture')::int,
    (p_criteria->>'communication')::int, (p_criteria->>'organization')::int,
    (p_criteria->>'incident_management')::int, (p_criteria->>'teamwork')::int,
    v_score, v_class
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;


-- ============ TRIGGERS ============

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_equipment_updated_at ON public.equipment;
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_equipment_loans_updated_at ON public.equipment_loans;
CREATE TRIGGER update_equipment_loans_updated_at BEFORE UPDATE ON public.equipment_loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_external_equipment_requests_updated_at ON public.external_equipment_requests;
CREATE TRIGGER update_external_equipment_requests_updated_at BEFORE UPDATE ON public.external_equipment_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_external_users_updated_at ON public.external_users;
CREATE TRIGGER update_external_users_updated_at BEFORE UPDATE ON public.external_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_locker_loans_updated_at ON public.locker_loans;
CREATE TRIGGER update_locker_loans_updated_at BEFORE UPDATE ON public.locker_loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_lockers_updated_at ON public.lockers;
CREATE TRIGGER update_lockers_updated_at BEFORE UPDATE ON public.lockers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_lost_items_updated_at ON public.lost_items;
CREATE TRIGGER update_lost_items_updated_at BEFORE UPDATE ON public.lost_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_material_requests_updated_at ON public.material_requests;
CREATE TRIGGER update_material_requests_updated_at BEFORE UPDATE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS ps_collaborators_updated ON public.ps_collaborators;
CREATE TRIGGER ps_collaborators_updated BEFORE UPDATE ON public.ps_collaborators FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS ps_retif_updated ON public.ps_evaluation_retifications;
CREATE TRIGGER ps_retif_updated BEFORE UPDATE ON public.ps_evaluation_retifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS ps_evaluations_updated ON public.ps_evaluations;
CREATE TRIGGER ps_evaluations_updated BEFORE UPDATE ON public.ps_evaluations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS ps_evcol_updated ON public.ps_event_collaborators;
CREATE TRIGGER ps_evcol_updated BEFORE UPDATE ON public.ps_event_collaborators FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS ps_events_updated ON public.ps_events;
CREATE TRIGGER ps_events_updated BEFORE UPDATE ON public.ps_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS ps_fb_cfg_updated ON public.ps_fiscal_bank_config;
CREATE TRIGGER ps_fb_cfg_updated BEFORE UPDATE ON public.ps_fiscal_bank_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS ps_gen_eval_updated ON public.ps_general_evaluations;
CREATE TRIGGER ps_gen_eval_updated BEFORE UPDATE ON public.ps_general_evaluations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS ps_roles_updated ON public.ps_roles;
CREATE TRIGGER ps_roles_updated BEFORE UPDATE ON public.ps_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_reservation_rooms_updated_at ON public.reservation_rooms;
CREATE TRIGGER update_reservation_rooms_updated_at BEFORE UPDATE ON public.reservation_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_reservations_updated_at ON public.reservations;
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER update_role_permissions_updated_at BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_rooms_updated_at ON public.rooms;
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_semester_items_updated ON public.semester_checklist_items;
CREATE TRIGGER trg_semester_items_updated BEFORE UPDATE ON public.semester_checklist_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_semester_checklists_updated ON public.semester_checklists;
CREATE TRIGGER trg_semester_checklists_updated BEFORE UPDATE ON public.semester_checklists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_semester_competencies_updated ON public.semester_competencies;
CREATE TRIGGER trg_semester_competencies_updated BEFORE UPDATE ON public.semester_competencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_semester_furniture_updated ON public.semester_furniture_details;
CREATE TRIGGER trg_semester_furniture_updated BEFORE UPDATE ON public.semester_furniture_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_semester_item_options_updated_at ON public.semester_item_options;
CREATE TRIGGER update_semester_item_options_updated_at BEFORE UPDATE ON public.semester_item_options FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_semester_projectors_updated ON public.semester_projectors;
CREATE TRIGGER trg_semester_projectors_updated BEFORE UPDATE ON public.semester_projectors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_enforce_task_creator_fields ON public.tasks;
CREATE TRIGGER trg_enforce_task_creator_fields BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION enforce_task_creator_fields();
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_uber_requests_updated_at ON public.uber_requests;
CREATE TRIGGER update_uber_requests_updated_at BEFORE UPDATE ON public.uber_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============ RLS ============

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_call_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_call_room_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_call_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_equipment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locker_exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locker_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_items REPLICA IDENTITY FULL;
ALTER TABLE public.lost_items_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_campus_floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_evaluation_retifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_event_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_fiscal_bank_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_fiscal_bank_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_general_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_self_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_reschedulings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_furniture_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_projectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handover_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handover_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uber_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============

DROP POLICY IF EXISTS "Internal users can insert activity logs" ON public.activity_logs;
CREATE POLICY "Internal users can insert activity logs" ON public.activity_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'visualizador'::app_role) OR has_role(auth.uid(), 'atendente'::app_role)));
DROP POLICY IF EXISTS "Internal users can view activity logs" ON public.activity_logs;
CREATE POLICY "Internal users can view activity logs" ON public.activity_logs AS PERMISSIVE FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete activity logs" ON public.activity_logs;
CREATE POLICY "Only admins can delete activity logs" ON public.activity_logs AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
CREATE POLICY "Admins can manage settings" ON public.app_settings AS PERMISSIVE FOR ALL TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can read settings" ON public.app_settings;
CREATE POLICY "Internal staff can read settings" ON public.app_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete checklist answers" ON public.checklist_answers;
CREATE POLICY "Admins can delete checklist answers" ON public.checklist_answers AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can insert checklist answers" ON public.checklist_answers;
CREATE POLICY "Internal staff can insert checklist answers" ON public.checklist_answers AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can view checklist answers" ON public.checklist_answers;
CREATE POLICY "Internal staff can view checklist answers" ON public.checklist_answers AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can view checklist questions" ON public.checklist_questions;
CREATE POLICY "Internal staff can view checklist questions" ON public.checklist_questions AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Only admins can manage checklist questions" ON public.checklist_questions;
CREATE POLICY "Only admins can manage checklist questions" ON public.checklist_questions AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can view responses" ON public.classroom_call_responses;
CREATE POLICY "Authenticated can view responses" ON public.classroom_call_responses AS PERMISSIVE FOR SELECT TO authenticated
  USING (((is_active = true) OR is_internal_user(auth.uid())));
DROP POLICY IF EXISTS "Internal users can manage responses" ON public.classroom_call_responses;
CREATE POLICY "Internal users can manage responses" ON public.classroom_call_responses AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Public can view active responses" ON public.classroom_call_responses;
CREATE POLICY "Public can view active responses" ON public.classroom_call_responses AS PERMISSIVE FOR SELECT TO anon
  USING ((is_active = true));
DROP POLICY IF EXISTS "Authenticated can view issues" ON public.classroom_call_room_issues;
CREATE POLICY "Authenticated can view issues" ON public.classroom_call_room_issues AS PERMISSIVE FOR SELECT TO authenticated
  USING (((is_active = true) OR is_internal_user(auth.uid())));
DROP POLICY IF EXISTS "Internal users can manage issues" ON public.classroom_call_room_issues;
CREATE POLICY "Internal users can manage issues" ON public.classroom_call_room_issues AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Public can view active issues" ON public.classroom_call_room_issues;
CREATE POLICY "Public can view active issues" ON public.classroom_call_room_issues AS PERMISSIVE FOR SELECT TO anon
  USING ((is_active = true));
DROP POLICY IF EXISTS "Authenticated can view rooms" ON public.classroom_call_rooms;
CREATE POLICY "Authenticated can view rooms" ON public.classroom_call_rooms AS PERMISSIVE FOR SELECT TO authenticated
  USING (((is_active = true) OR is_internal_user(auth.uid())));
DROP POLICY IF EXISTS "Internal users can manage rooms" ON public.classroom_call_rooms;
CREATE POLICY "Internal users can manage rooms" ON public.classroom_call_rooms AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Public can view active rooms" ON public.classroom_call_rooms;
CREATE POLICY "Public can view active rooms" ON public.classroom_call_rooms AS PERMISSIVE FOR SELECT TO anon
  USING ((is_active = true));
DROP POLICY IF EXISTS "Authenticated users can create classroom calls" ON public.classroom_calls;
CREATE POLICY "Authenticated users can create classroom calls" ON public.classroom_calls AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS "Internal users can update classroom calls" ON public.classroom_calls;
CREATE POLICY "Internal users can update classroom calls" ON public.classroom_calls AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'atendente'::app_role)));
DROP POLICY IF EXISTS "Internal users can view classroom calls" ON public.classroom_calls;
CREATE POLICY "Internal users can view classroom calls" ON public.classroom_calls AS PERMISSIVE FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'atendente'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete classroom calls" ON public.classroom_calls;
CREATE POLICY "Only admins can delete classroom calls" ON public.classroom_calls AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins and analistas can insert equipment" ON public.equipment;
CREATE POLICY "Admins and analistas can insert equipment" ON public.equipment AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Internal staff can view equipment" ON public.equipment;
CREATE POLICY "Internal staff can view equipment" ON public.equipment AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal users can update equipment" ON public.equipment;
CREATE POLICY "Internal users can update equipment" ON public.equipment AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete equipment" ON public.equipment;
CREATE POLICY "Only admins can delete equipment" ON public.equipment AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal users can insert equipment loans" ON public.equipment_loans;
CREATE POLICY "Internal users can insert equipment loans" ON public.equipment_loans AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal users can update equipment loans" ON public.equipment_loans;
CREATE POLICY "Internal users can update equipment loans" ON public.equipment_loans AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal users can view equipment loans" ON public.equipment_loans;
CREATE POLICY "Internal users can view equipment loans" ON public.equipment_loans AS PERMISSIVE FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete equipment loans" ON public.equipment_loans;
CREATE POLICY "Only admins can delete equipment loans" ON public.equipment_loans AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal users can insert equipment reservations" ON public.equipment_reservations;
CREATE POLICY "Internal users can insert equipment reservations" ON public.equipment_reservations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal users can update equipment reservations" ON public.equipment_reservations;
CREATE POLICY "Internal users can update equipment reservations" ON public.equipment_reservations AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal users can view equipment reservations" ON public.equipment_reservations;
CREATE POLICY "Internal users can view equipment reservations" ON public.equipment_reservations AS PERMISSIVE FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete equipment reservations" ON public.equipment_reservations;
CREATE POLICY "Only admins can delete equipment reservations" ON public.equipment_reservations AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Anyone can create external equipment requests" ON public.external_equipment_requests;
CREATE POLICY "Anyone can create external equipment requests" ON public.external_equipment_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS "External users can update their own equipment requests" ON public.external_equipment_requests;
CREATE POLICY "External users can update their own equipment requests" ON public.external_equipment_requests AS PERMISSIVE FOR UPDATE TO public
  USING (((lower(requester_email) = lower(auth.email())) AND (status = ANY (ARRAY['pending'::text, 'approved'::text, 'awaiting_pickup'::text]))))
  WITH CHECK ((status = ANY (ARRAY['pending'::text, 'cancelled'::text])));
DROP POLICY IF EXISTS "External users can view their own equipment requests" ON public.external_equipment_requests;
CREATE POLICY "External users can view their own equipment requests" ON public.external_equipment_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((lower(requester_email) = lower(auth.email())));
DROP POLICY IF EXISTS "Internal users can update external requests" ON public.external_equipment_requests;
CREATE POLICY "Internal users can update external requests" ON public.external_equipment_requests AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal users can view all external requests" ON public.external_equipment_requests;
CREATE POLICY "Internal users can view all external requests" ON public.external_equipment_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete external requests" ON public.external_equipment_requests;
CREATE POLICY "Only admins can delete external requests" ON public.external_equipment_requests AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins and analistas can delete external users" ON public.external_users;
CREATE POLICY "Admins and analistas can delete external users" ON public.external_users AS PERMISSIVE FOR DELETE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Admins and analistas can insert external users" ON public.external_users;
CREATE POLICY "Admins and analistas can insert external users" ON public.external_users AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Admins and analistas can update external users" ON public.external_users;
CREATE POLICY "Admins and analistas can update external users" ON public.external_users AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "External users can insert own record" ON public.external_users;
CREATE POLICY "External users can insert own record" ON public.external_users AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "External users can insert their own profile" ON public.external_users;
CREATE POLICY "External users can insert their own profile" ON public.external_users AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "External users can update own record" ON public.external_users;
CREATE POLICY "External users can update own record" ON public.external_users AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "External users can update their own profile" ON public.external_users;
CREATE POLICY "External users can update their own profile" ON public.external_users AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "External users can view own record" ON public.external_users;
CREATE POLICY "External users can view own record" ON public.external_users AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "External users can view their own profile" ON public.external_users;
CREATE POLICY "External users can view their own profile" ON public.external_users AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Internal users can view all external users" ON public.external_users;
CREATE POLICY "Internal users can view all external users" ON public.external_users AS PERMISSIVE FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can change approval_status" ON public.external_users;
CREATE POLICY "Only admins can change approval_status" ON public.external_users AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Internal users can insert inventory movements" ON public.inventory_movements;
CREATE POLICY "Internal users can insert inventory movements" ON public.inventory_movements AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal users can update inventory movements" ON public.inventory_movements;
CREATE POLICY "Internal users can update inventory movements" ON public.inventory_movements AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal users can view inventory movements" ON public.inventory_movements;
CREATE POLICY "Internal users can view inventory movements" ON public.inventory_movements AS PERMISSIVE FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete inventory movements" ON public.inventory_movements;
CREATE POLICY "Only admins can delete inventory movements" ON public.inventory_movements AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal users can insert locker exchanges" ON public.locker_exchanges;
CREATE POLICY "Internal users can insert locker exchanges" ON public.locker_exchanges AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal users can view locker exchanges" ON public.locker_exchanges;
CREATE POLICY "Internal users can view locker exchanges" ON public.locker_exchanges AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete locker exchanges" ON public.locker_exchanges;
CREATE POLICY "Only admins can delete locker exchanges" ON public.locker_exchanges AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal users can insert locker loans" ON public.locker_loans;
CREATE POLICY "Internal users can insert locker loans" ON public.locker_loans AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal users can update locker loans" ON public.locker_loans;
CREATE POLICY "Internal users can update locker loans" ON public.locker_loans AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal users can view locker loans" ON public.locker_loans;
CREATE POLICY "Internal users can view locker loans" ON public.locker_loans AS PERMISSIVE FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete locker loans" ON public.locker_loans;
CREATE POLICY "Only admins can delete locker loans" ON public.locker_loans AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins and analistas can insert lockers" ON public.lockers;
CREATE POLICY "Admins and analistas can insert lockers" ON public.lockers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Internal staff can view lockers" ON public.lockers;
CREATE POLICY "Internal staff can view lockers" ON public.lockers AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal users can update lockers" ON public.lockers;
CREATE POLICY "Internal users can update lockers" ON public.lockers AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete lockers" ON public.lockers;
CREATE POLICY "Only admins can delete lockers" ON public.lockers AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Authorized users can delete lost items" ON public.lost_items;
CREATE POLICY "Authorized users can delete lost items" ON public.lost_items AS PERMISSIVE FOR DELETE TO public
  USING (has_permission(auth.uid(), 'lostAndFound'::text, 'delete'::text));
DROP POLICY IF EXISTS "Internal staff can view lost items" ON public.lost_items;
CREATE POLICY "Internal staff can view lost items" ON public.lost_items AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal users can insert lost items" ON public.lost_items;
CREATE POLICY "Internal users can insert lost items" ON public.lost_items AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal users can update lost items" ON public.lost_items;
CREATE POLICY "Internal users can update lost items" ON public.lost_items AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Admins and analistas can insert archived items" ON public.lost_items_archive;
CREATE POLICY "Admins and analistas can insert archived items" ON public.lost_items_archive AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Internal users can view archived items" ON public.lost_items_archive;
CREATE POLICY "Internal users can view archived items" ON public.lost_items_archive AS PERMISSIVE FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete archived items" ON public.lost_items_archive;
CREATE POLICY "Only admins can delete archived items" ON public.lost_items_archive AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal managers can manage requests" ON public.material_requests;
CREATE POLICY "Internal managers can manage requests" ON public.material_requests AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete requests" ON public.material_requests;
CREATE POLICY "Only admins can delete requests" ON public.material_requests AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can create their own requests" ON public.material_requests;
CREATE POLICY "Users can create their own requests" ON public.material_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = requester_id));
DROP POLICY IF EXISTS "Users can update their own requests" ON public.material_requests;
CREATE POLICY "Users can update their own requests" ON public.material_requests AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.uid() = requester_id) AND (status = ANY (ARRAY['pending'::text, 'rejected'::text]))))
  WITH CHECK (((auth.uid() = requester_id) AND (status = ANY (ARRAY['pending'::text, 'rejected'::text]))));
DROP POLICY IF EXISTS "Users can view material requests" ON public.material_requests;
CREATE POLICY "Users can view material requests" ON public.material_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = requester_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal users can view all profiles" ON public.profiles;
CREATE POLICY "Internal users can view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "ps_floors internal manage" ON public.ps_campus_floors;
CREATE POLICY "ps_floors internal manage" ON public.ps_campus_floors AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_floors public read" ON public.ps_campus_floors;
CREATE POLICY "ps_floors public read" ON public.ps_campus_floors AS PERMISSIVE FOR SELECT TO anon
  USING (true);
DROP POLICY IF EXISTS "ps_campuses internal manage" ON public.ps_campuses;
CREATE POLICY "ps_campuses internal manage" ON public.ps_campuses AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_campuses public read" ON public.ps_campuses;
CREATE POLICY "ps_campuses public read" ON public.ps_campuses AS PERMISSIVE FOR SELECT TO anon
  USING (true);
DROP POLICY IF EXISTS "ps_candidates internal manage" ON public.ps_candidates;
CREATE POLICY "ps_candidates internal manage" ON public.ps_candidates AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_collaborators internal manage" ON public.ps_collaborators;
CREATE POLICY "ps_collaborators internal manage" ON public.ps_collaborators AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_retif internal manage" ON public.ps_evaluation_retifications;
CREATE POLICY "ps_retif internal manage" ON public.ps_evaluation_retifications AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_retif public insert validated" ON public.ps_evaluation_retifications;
CREATE POLICY "ps_retif public insert validated" ON public.ps_evaluation_retifications AS PERMISSIVE FOR INSERT TO anon
  WITH CHECK (((EXISTS ( SELECT 1
   FROM ps_evaluations ev
  WHERE ((ev.id = ps_evaluation_retifications.evaluation_id) AND (ev.event_id = ps_evaluation_retifications.event_id) AND (ev.collaborator_id = ps_evaluation_retifications.collaborator_id)))) AND ((COALESCE(length(TRIM(BOTH FROM reason)), 0) >= 5) AND (COALESCE(length(TRIM(BOTH FROM reason)), 0) <= 4000)) AND (COALESCE(length(requested_by), 0) <= 200) AND (status = 'pendente'::text)));
DROP POLICY IF EXISTS "ps_evaluations internal manage" ON public.ps_evaluations;
CREATE POLICY "ps_evaluations internal manage" ON public.ps_evaluations AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_evcol internal manage" ON public.ps_event_collaborators;
CREATE POLICY "ps_evcol internal manage" ON public.ps_event_collaborators AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_events internal manage" ON public.ps_events;
CREATE POLICY "ps_events internal manage" ON public.ps_events AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_fb_app internal manage" ON public.ps_fiscal_bank_applications;
CREATE POLICY "ps_fb_app internal manage" ON public.ps_fiscal_bank_applications AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_fb_app public insert validated" ON public.ps_fiscal_bank_applications;
CREATE POLICY "ps_fb_app public insert validated" ON public.ps_fiscal_bank_applications AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((((length(TRIM(BOTH FROM nome_completo)) >= 2) AND (length(TRIM(BOTH FROM nome_completo)) <= 200)) AND ((length(TRIM(BOTH FROM email)) >= 5) AND (length(TRIM(BOTH FROM email)) <= 255)) AND (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND ((length(TRIM(BOTH FROM COALESCE(telefone_contato, ''::text))) >= 8) AND (length(TRIM(BOTH FROM COALESCE(telefone_contato, ''::text))) <= 30)) AND (COALESCE(length(instituto), 0) <= 200) AND (COALESCE(length(setor), 0) <= 200) AND (COALESCE(length(observacoes), 0) <= 4000) AND (COALESCE(array_length(habilidades_ingles, 1), 0) <= 50) AND (COALESCE(array_length(funcoes_com_conforto, 1), 0) <= 50) AND (COALESCE(array_length(datas_disponibilidade, 1), 0) <= 100)));
DROP POLICY IF EXISTS "ps_fb_cfg internal manage" ON public.ps_fiscal_bank_config;
CREATE POLICY "ps_fb_cfg internal manage" ON public.ps_fiscal_bank_config AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_fb_cfg public read" ON public.ps_fiscal_bank_config;
CREATE POLICY "ps_fb_cfg public read" ON public.ps_fiscal_bank_config AS PERMISSIVE FOR SELECT TO anon
  USING (true);
DROP POLICY IF EXISTS "ps_gen_eval internal manage" ON public.ps_general_evaluations;
CREATE POLICY "ps_gen_eval internal manage" ON public.ps_general_evaluations AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_roles internal manage" ON public.ps_roles;
CREATE POLICY "ps_roles internal manage" ON public.ps_roles AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_self_eval internal manage" ON public.ps_self_evaluations;
CREATE POLICY "ps_self_eval internal manage" ON public.ps_self_evaluations AS PERMISSIVE FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "ps_self_eval public insert validated" ON public.ps_self_evaluations;
CREATE POLICY "ps_self_eval public insert validated" ON public.ps_self_evaluations AS PERMISSIVE FOR INSERT TO anon
  WITH CHECK (((EXISTS ( SELECT 1
   FROM ps_events e
  WHERE ((e.id = ps_self_evaluations.event_id) AND (COALESCE(e.hidden_from_evaluation, false) = false)))) AND ((identified = false) OR ((COALESCE(length(TRIM(BOTH FROM respondent_name)), 0) >= 2) AND (COALESCE(length(TRIM(BOTH FROM respondent_name)), 0) <= 200))) AND ((training_rating IS NULL) OR ((training_rating >= 1) AND (training_rating <= 5))) AND ((organization_rating IS NULL) OR ((organization_rating >= 1) AND (organization_rating <= 5))) AND ((snack_rating IS NULL) OR ((snack_rating >= 1) AND (snack_rating <= 5))) AND ((partner_fiscal_rating IS NULL) OR ((partner_fiscal_rating >= 1) AND (partner_fiscal_rating <= 5))) AND (COALESCE(length(suggestions), 0) <= 4000) AND (COALESCE(length(incident_comment), 0) <= 4000) AND (COALESCE(length(training_comment), 0) <= 4000) AND (COALESCE(length(organization_comment), 0) <= 4000) AND (COALESCE(length(snack_comment), 0) <= 4000) AND (COALESCE(length(partner_fiscal_comment), 0) <= 4000)));
DROP POLICY IF EXISTS "Internal users can view logs" ON public.reservation_logs;
CREATE POLICY "Internal users can view logs" ON public.reservation_logs AS PERMISSIVE FOR SELECT TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "System can insert logs" ON public.reservation_logs;
CREATE POLICY "System can insert logs" ON public.reservation_logs AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Admins and analistas can insert reschedulings" ON public.reservation_reschedulings;
CREATE POLICY "Admins and analistas can insert reschedulings" ON public.reservation_reschedulings AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Admins and analistas can update reschedulings" ON public.reservation_reschedulings;
CREATE POLICY "Admins and analistas can update reschedulings" ON public.reservation_reschedulings AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Internal staff or owner can view reschedulings" ON public.reservation_reschedulings;
CREATE POLICY "Internal staff or owner can view reschedulings" ON public.reservation_reschedulings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_internal_user(auth.uid()) OR (EXISTS ( SELECT 1
   FROM reservations r
  WHERE ((r.id = reservation_reschedulings.reservation_id) AND ((r.requester_email = auth.email()) OR (r.created_by = auth.uid())))))));
DROP POLICY IF EXISTS "Only admins can delete reschedulings" ON public.reservation_reschedulings;
CREATE POLICY "Only admins can delete reschedulings" ON public.reservation_reschedulings AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins and analistas can manage rooms" ON public.reservation_rooms;
CREATE POLICY "Admins and analistas can manage rooms" ON public.reservation_rooms AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin_or_analista(auth.uid()))
  WITH CHECK (is_admin_or_analista(auth.uid()));
DROP POLICY IF EXISTS "Anyone can view active reservation rooms" ON public.reservation_rooms;
CREATE POLICY "Anyone can view active reservation rooms" ON public.reservation_rooms AS PERMISSIVE FOR SELECT TO anon
  USING ((is_active = true));
DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.reservation_rooms;
CREATE POLICY "Anyone can view active rooms" ON public.reservation_rooms AS PERMISSIVE FOR SELECT TO public
  USING (((is_active = true) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Authenticated users can insert reservations" ON public.reservations;
CREATE POLICY "Authenticated users can insert reservations" ON public.reservations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS "External users can cancel their own reservations" ON public.reservations;
CREATE POLICY "External users can cancel their own reservations" ON public.reservations AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((is_external = true) AND (lower(requester_email) = lower(auth.email())) AND (status = ANY (ARRAY['pending'::text, 'confirmed'::text]))))
  WITH CHECK (((is_external = true) AND (status = 'cancelled'::text)));
DROP POLICY IF EXISTS "Internal staff or owner can view reservations" ON public.reservations;
CREATE POLICY "Internal staff or owner can view reservations" ON public.reservations AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_internal_user(auth.uid()) OR (requester_email = auth.email()) OR (created_by = auth.uid())));
DROP POLICY IF EXISTS "Internal users can update reservations" ON public.reservations;
CREATE POLICY "Internal users can update reservations" ON public.reservations AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role) OR has_role(auth.uid(), 'assistente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Only admins can delete reservations" ON public.reservations;
CREATE POLICY "Only admins can delete reservations" ON public.reservations AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.role_permissions;
CREATE POLICY "Admins can manage permissions" ON public.role_permissions AS PERMISSIVE FOR ALL TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can view permissions" ON public.role_permissions;
CREATE POLICY "Internal staff can view permissions" ON public.role_permissions AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete room checklists" ON public.room_checklists;
CREATE POLICY "Admins can delete room checklists" ON public.room_checklists AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can insert room checklists" ON public.room_checklists;
CREATE POLICY "Internal staff can insert room checklists" ON public.room_checklists AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((is_internal_user(auth.uid()) AND (auth.uid() = filled_by)));
DROP POLICY IF EXISTS "Internal staff can view room checklists" ON public.room_checklists;
CREATE POLICY "Internal staff can view room checklists" ON public.room_checklists AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Only admins can delete room checklists" ON public.room_checklists;
CREATE POLICY "Only admins can delete room checklists" ON public.room_checklists AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins and analistas can manage room combinations" ON public.room_combinations;
CREATE POLICY "Admins and analistas can manage room combinations" ON public.room_combinations AS PERMISSIVE FOR ALL TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Internal staff can view room combinations" ON public.room_combinations;
CREATE POLICY "Internal staff can view room combinations" ON public.room_combinations AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Admins and analistas can insert rooms" ON public.rooms;
CREATE POLICY "Admins and analistas can insert rooms" ON public.rooms AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Admins and analistas can update rooms" ON public.rooms;
CREATE POLICY "Admins and analistas can update rooms" ON public.rooms AS PERMISSIVE FOR UPDATE TO public
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role)));
DROP POLICY IF EXISTS "Internal staff can view rooms" ON public.rooms;
CREATE POLICY "Internal staff can view rooms" ON public.rooms AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Only admins can delete rooms" ON public.rooms;
CREATE POLICY "Only admins can delete rooms" ON public.rooms AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "admin delete items" ON public.semester_checklist_items;
CREATE POLICY "admin delete items" ON public.semester_checklist_items AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "admin update items" ON public.semester_checklist_items;
CREATE POLICY "admin update items" ON public.semester_checklist_items AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
DROP POLICY IF EXISTS "auth insert items when released" ON public.semester_checklist_items;
CREATE POLICY "auth insert items when released" ON public.semester_checklist_items AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (semester_checklists ch
     JOIN semester_competencies c ON ((c.id = ch.competency_id)))
  WHERE ((ch.id = semester_checklist_items.checklist_id) AND (c.status = 'released'::semester_competency_status))))));
DROP POLICY IF EXISTS "internal view items" ON public.semester_checklist_items;
CREATE POLICY "internal view items" ON public.semester_checklist_items AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "admin delete checklists" ON public.semester_checklists;
CREATE POLICY "admin delete checklists" ON public.semester_checklists AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "admin update checklists" ON public.semester_checklists;
CREATE POLICY "admin update checklists" ON public.semester_checklists AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
DROP POLICY IF EXISTS "auth insert checklists when released" ON public.semester_checklists;
CREATE POLICY "auth insert checklists when released" ON public.semester_checklists AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM semester_competencies c
  WHERE ((c.id = semester_checklists.competency_id) AND (c.status = 'released'::semester_competency_status))))));
DROP POLICY IF EXISTS "internal view checklists" ON public.semester_checklists;
CREATE POLICY "internal view checklists" ON public.semester_checklists AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "admin manage competencies" ON public.semester_competencies;
CREATE POLICY "admin manage competencies" ON public.semester_competencies AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
DROP POLICY IF EXISTS "internal view competencies" ON public.semester_competencies;
CREATE POLICY "internal view competencies" ON public.semester_competencies AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "admin delete furniture" ON public.semester_furniture_details;
CREATE POLICY "admin delete furniture" ON public.semester_furniture_details AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "admin update furniture" ON public.semester_furniture_details;
CREATE POLICY "admin update furniture" ON public.semester_furniture_details AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
DROP POLICY IF EXISTS "auth insert furniture when released" ON public.semester_furniture_details;
CREATE POLICY "auth insert furniture when released" ON public.semester_furniture_details AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM ((semester_checklist_items i
     JOIN semester_checklists ch ON ((ch.id = i.checklist_id)))
     JOIN semester_competencies c ON ((c.id = ch.competency_id)))
  WHERE ((i.id = semester_furniture_details.checklist_item_id) AND (c.status = 'released'::semester_competency_status))))));
DROP POLICY IF EXISTS "internal view furniture" ON public.semester_furniture_details;
CREATE POLICY "internal view furniture" ON public.semester_furniture_details AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Admins manage options - delete" ON public.semester_item_options;
CREATE POLICY "Admins manage options - delete" ON public.semester_item_options AS PERMISSIVE FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins manage options - insert" ON public.semester_item_options;
CREATE POLICY "Admins manage options - insert" ON public.semester_item_options AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins manage options - update" ON public.semester_item_options;
CREATE POLICY "Admins manage options - update" ON public.semester_item_options AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Internal staff can view options" ON public.semester_item_options;
CREATE POLICY "Internal staff can view options" ON public.semester_item_options AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "admin delete labels" ON public.semester_labels;
CREATE POLICY "admin delete labels" ON public.semester_labels AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "internal insert labels" ON public.semester_labels;
CREATE POLICY "internal insert labels" ON public.semester_labels AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "internal view labels" ON public.semester_labels;
CREATE POLICY "internal view labels" ON public.semester_labels AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can view projectors" ON public.semester_projectors;
CREATE POLICY "Internal staff can view projectors" ON public.semester_projectors AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "admin delete projectors" ON public.semester_projectors;
CREATE POLICY "admin delete projectors" ON public.semester_projectors AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "auth insert projectors when released" ON public.semester_projectors;
CREATE POLICY "auth insert projectors when released" ON public.semester_projectors AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (semester_checklists ch
     JOIN semester_competencies c ON ((c.id = ch.competency_id)))
  WHERE ((ch.id = semester_projectors.checklist_id) AND (c.status = 'released'::semester_competency_status))))));
DROP POLICY IF EXISTS "auth update projectors when released" ON public.semester_projectors;
CREATE POLICY "auth update projectors when released" ON public.semester_projectors AS PERMISSIVE FOR UPDATE TO public
  USING ((is_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (semester_checklists ch
     JOIN semester_competencies c ON ((c.id = ch.competency_id)))
  WHERE ((ch.id = semester_projectors.checklist_id) AND (c.status = 'released'::semester_competency_status))))));
DROP POLICY IF EXISTS "Internal staff can insert shift handover incidents" ON public.shift_handover_incidents;
CREATE POLICY "Internal staff can insert shift handover incidents" ON public.shift_handover_incidents AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((is_internal_user(auth.uid()) AND (EXISTS ( SELECT 1
   FROM shift_handovers h
  WHERE ((h.id = shift_handover_incidents.handover_id) AND (h.filled_by = auth.uid()))))));
DROP POLICY IF EXISTS "Internal staff can view shift handover incidents" ON public.shift_handover_incidents;
CREATE POLICY "Internal staff can view shift handover incidents" ON public.shift_handover_incidents AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can insert shift handover tasks" ON public.shift_handover_tasks;
CREATE POLICY "Internal staff can insert shift handover tasks" ON public.shift_handover_tasks AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((is_internal_user(auth.uid()) AND (EXISTS ( SELECT 1
   FROM shift_handovers h
  WHERE ((h.id = shift_handover_tasks.handover_id) AND (h.filled_by = auth.uid()))))));
DROP POLICY IF EXISTS "Internal staff can view shift handover tasks" ON public.shift_handover_tasks;
CREATE POLICY "Internal staff can view shift handover tasks" ON public.shift_handover_tasks AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can insert shift handovers" ON public.shift_handovers;
CREATE POLICY "Internal staff can insert shift handovers" ON public.shift_handovers AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((is_internal_user(auth.uid()) AND (auth.uid() = filled_by)));
DROP POLICY IF EXISTS "Internal staff can view shift handovers" ON public.shift_handovers;
CREATE POLICY "Internal staff can view shift handovers" ON public.shift_handovers AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Only admins can delete shift handovers" ON public.shift_handovers;
CREATE POLICY "Only admins can delete shift handovers" ON public.shift_handovers AS PERMISSIVE FOR DELETE TO public
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can insert comments" ON public.task_comments;
CREATE POLICY "Internal staff can insert comments" ON public.task_comments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can view task comments" ON public.task_comments;
CREATE POLICY "Internal staff can view task comments" ON public.task_comments AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.task_comments;
CREATE POLICY "Users can delete their own comments" ON public.task_comments AS PERMISSIVE FOR DELETE TO public
  USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Internal staff can insert task history" ON public.task_history;
CREATE POLICY "Internal staff can insert task history" ON public.task_history AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can view task history" ON public.task_history;
CREATE POLICY "Internal staff can view task history" ON public.task_history AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Admins and supervisors can delete task team members" ON public.task_team_members;
CREATE POLICY "Admins and supervisors can delete task team members" ON public.task_team_members AS PERMISSIVE FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Admins and supervisors can manage task team members" ON public.task_team_members;
CREATE POLICY "Admins and supervisors can manage task team members" ON public.task_team_members AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
DROP POLICY IF EXISTS "Internal staff can view task team members" ON public.task_team_members;
CREATE POLICY "Internal staff can view task team members" ON public.task_team_members AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Admins or assigned users can update tasks" ON public.tasks;
CREATE POLICY "Admins or assigned users can update tasks" ON public.tasks AS PERMISSIVE FOR UPDATE TO public
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role) OR (assigned_to = auth.uid()) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM task_team_members
  WHERE ((task_team_members.task_id = tasks.id) AND (task_team_members.user_id = auth.uid()))))))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role) OR (assigned_to = auth.uid()) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM task_team_members
  WHERE ((task_team_members.task_id = tasks.id) AND (task_team_members.user_id = auth.uid()))))));
DROP POLICY IF EXISTS "Internal staff can create tasks" ON public.tasks;
CREATE POLICY "Internal staff can create tasks" ON public.tasks AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can view tasks" ON public.tasks;
CREATE POLICY "Internal staff can view tasks" ON public.tasks AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Only admins can delete tasks" ON public.tasks;
CREATE POLICY "Only admins can delete tasks" ON public.tasks AS PERMISSIVE FOR DELETE TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can delete uber requests" ON public.uber_requests;
CREATE POLICY "Admins can delete uber requests" ON public.uber_requests AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update uber requests" ON public.uber_requests;
CREATE POLICY "Admins can update uber requests" ON public.uber_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can view uber requests" ON public.uber_requests;
CREATE POLICY "Admins can view uber requests" ON public.uber_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Internal staff can create uber requests" ON public.uber_requests;
CREATE POLICY "Internal staff can create uber requests" ON public.uber_requests AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

-- ============ GRANTS ============


-- Grants em sequences e funcoes

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_reservation_conflict(p_room_id uuid, p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_exclude_reservation_id uuid, p_is_external boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_reservation_conflict(p_room_id uuid, p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_exclude_reservation_id uuid, p_is_external boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_reservation_conflict(p_room_id uuid, p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_exclude_reservation_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_reservation_conflict(p_room_id uuid, p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_exclude_reservation_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_classroom_call(p_room_name text, p_reason text, p_campus text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_classroom_call(p_room_name text, p_reason text, p_campus text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_public_classroom_call(p_room_name text, p_reason text, p_campus text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_uber_request(p_requester_name text, p_origin text, p_destination text, p_trip_date date, p_trip_time time without time zone, p_reason text, p_notes text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_public_uber_request(p_requester_name text, p_origin text, p_destination text, p_trip_date date, p_trip_time time without time zone, p_reason text, p_notes text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_uber_request(p_requester_name text, p_origin text, p_destination text, p_trip_date date, p_trip_time time without time zone, p_reason text, p_notes text) TO anon;
GRANT EXECUTE ON FUNCTION public.enforce_task_creator_fields() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_old_lost_items() TO service_role;
GRANT EXECUTE ON FUNCTION public.find_available_rooms(p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_attendees_count integer, p_campus campus_enum, p_is_external boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_available_rooms(p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_attendees_count integer, p_campus campus_enum) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_available_rooms(p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_attendees_count integer, p_campus campus_enum, p_is_external boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_available_rooms(p_start_datetime timestamp with time zone, p_end_datetime timestamp with time zone, p_attendees_count integer, p_campus campus_enum) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_linked_rooms(p_room_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_classroom_call_status(p_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_classroom_call_status(p_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_classroom_call_status(p_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_reservations(p_start timestamp with time zone, p_end timestamp with time zone) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_reservations(p_start timestamp with time zone, p_end timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_reservations(p_start timestamp with time zone, p_end timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(_user_id uuid, _module text, _action text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(_user_id uuid, _module text, _action text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_analista(_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_analista(_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user(_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_internal_user(_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_event_roster(p_event_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.ps_public_event_roster(p_event_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_event_roster(p_event_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ps_public_sign_attendance(p_link_id uuid, p_signature text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_sign_attendance(p_link_id uuid, p_signature text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ps_public_sign_attendance(p_link_id uuid, p_signature text) TO anon;
GRANT EXECUTE ON FUNCTION public.ps_public_submit_evaluation(p_event_id uuid, p_link_id uuid, p_assigned_role text, p_evaluator_name text, p_observations text, p_criteria jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_submit_evaluation(p_event_id uuid, p_link_id uuid, p_assigned_role text, p_evaluator_name text, p_observations text, p_criteria jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ps_public_submit_evaluation(p_event_id uuid, p_link_id uuid, p_assigned_role text, p_evaluator_name text, p_observations text, p_criteria jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- ============ REALTIME ============

DO $$ BEGIN CREATE PUBLICATION supabase_realtime; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_answers; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_questions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_call_responses; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_call_room_issues; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_call_rooms; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_calls; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_loans; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_reservations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.external_equipment_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.locker_exchanges; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.locker_loans; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lockers; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lost_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lost_items_archive; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.material_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_reschedulings; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_rooms; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.room_checklists; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_handover_incidents; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_handover_tasks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_handovers; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_history; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.task_team_members; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
