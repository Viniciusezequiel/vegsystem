// Supabase client.
//
// `types.ts` is generated from Supabase and currently predates a group of
// Processo Seletivo migrations committed in September/2026. Keep that
// generated file untouched and bridge only the known schema delta here until
// the next official `supabase gen types` regeneration.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type PublicSchema = Database['public'];
type EventCollaboratorsTable = PublicSchema['Tables']['ps_event_collaborators'];
type EventsTable = PublicSchema['Tables']['ps_events'];
type EvaluationsTable = PublicSchema['Tables']['ps_evaluations'];
type SelfEvaluationsTable = PublicSchema['Tables']['ps_self_evaluations'];

type Table<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type EventCollaboratorExtra = {
  attendance_pix_confirmed_at: string | null;
  attendance_pix_snapshot: string | null;
  attendance_role_snapshot: string | null;
  confirmation_requested_at: string | null;
  confirmation_token_version: number;
  confirmed_at: string | null;
  decline_reason: string | null;
  declined_at: string | null;
  departed_at: string | null;
  original_event_collaborator_id: string | null;
  participation_status: string;
  public_confirmation_token_expires_at: string | null;
  public_confirmation_token_hash: string | null;
  public_confirmation_token_revoked_at: string | null;
  replacement_for_event_collaborator_id: string | null;
};

type EvaluationExtra = {
  evaluation_level: string;
  evaluator_event_collaborator_id: string | null;
  evaluator_role: string | null;
  evaluator_campus: string | null;
  evaluator_building: string | null;
  evaluator_floor: string | null;
  role_changed: boolean;
  original_role: string | null;
  reported_role: string | null;
  role_change_justification: string | null;
};

type SelfEvaluationExtra = {
  campus: string | null;
  building: string | null;
  floor: string | null;
  room: string | null;
};

type PsEventCommunicationRow = {
  id: string;
  batch_id: string;
  event_id: string;
  event_collaborator_id: string;
  communication_type: string;
  logical_recipient: string | null;
  actual_recipient: string | null;
  subject: string;
  body_template: string;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  test_mode: boolean;
  provider_quota_date: string | null;
  confirmation_token_version: number | null;
  idempotency_key: string;
  attempt_count: number;
  requested_at: string;
  processing_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type PsEventEvaluatorScopeRow = {
  id: string;
  event_id: string;
  evaluator_event_collaborator_id: string;
  campus: string | null;
  building: string | null;
  floor: string | null;
  scope_type: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type PsEvaluationScopeOverrideRow = {
  id: string;
  event_id: string;
  evaluator_event_collaborator_id: string;
  event_collaborator_id: string;
  reason: string | null;
  created_at: string;
};

type PsEventCollaboratorAdjustmentRow = {
  id: string;
  event_id: string;
  event_collaborator_id: string;
  adjustment_type: string;
  source: string;
  old_value: string | null;
  new_value: string;
  justification: string | null;
  reported_by_event_collaborator_id: string | null;
  reported_by_name: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type PsAttendanceAbsenceRow = {
  id: string;
  event_id: string;
  event_collaborator_id: string;
  responsible_event_collaborator_id: string | null;
  responsible_name: string;
  reason: string | null;
  signature_url: string;
  signature_ip: string | null;
  created_at: string;
};

type PsAttendanceClosureRow = {
  id: string;
  event_id: string;
  campus: string | null;
  building: string;
  coordinator_event_collaborator_id: string | null;
  coordinator_name: string;
  signature_url: string;
  signature_ip: string | null;
  present_count: number;
  absent_count: number;
  pending_count: number;
  role_adjustments_count: number;
  pix_adjustments_count: number;
  signed_at: string;
  created_at: string;
};

type PsConfirmationHistoryRow = {
  id: string;
  event_id: string;
  event_collaborator_id: string;
  previous_status: string | null;
  new_status: string;
  decline_reason: string | null;
  replacement_event_collaborator_id: string | null;
  source: string;
  actor_name: string | null;
  collaborator_name_snapshot: string | null;
  role_name_snapshot: string | null;
  campus_snapshot: string | null;
  unit_snapshot: string | null;
  building_snapshot: string | null;
  floor_snapshot: string | null;
  room_snapshot: string | null;
  replacement_collaborator_name_snapshot: string | null;
  created_at: string;
};

type DatabaseCompat = Omit<Database, 'public'> & {
  public: Omit<PublicSchema, 'Tables' | 'Functions'> & {
    Tables: Omit<
      PublicSchema['Tables'],
      'ps_event_collaborators' | 'ps_events' | 'ps_evaluations' | 'ps_self_evaluations'
    > & {
      ps_event_collaborators: {
        Row: EventCollaboratorsTable['Row'] & EventCollaboratorExtra;
        Insert: EventCollaboratorsTable['Insert'] & Partial<EventCollaboratorExtra>;
        Update: EventCollaboratorsTable['Update'] & Partial<EventCollaboratorExtra>;
        Relationships: EventCollaboratorsTable['Relationships'];
      };
      ps_events: {
        Row: EventsTable['Row'] & { self_evaluation_enabled: boolean };
        Insert: EventsTable['Insert'] & { self_evaluation_enabled?: boolean };
        Update: EventsTable['Update'] & { self_evaluation_enabled?: boolean };
        Relationships: EventsTable['Relationships'];
      };
      ps_evaluations: {
        Row: EvaluationsTable['Row'] & EvaluationExtra;
        Insert: EvaluationsTable['Insert'] & Partial<EvaluationExtra>;
        Update: EvaluationsTable['Update'] & Partial<EvaluationExtra>;
        Relationships: EvaluationsTable['Relationships'];
      };
      ps_self_evaluations: {
        Row: SelfEvaluationsTable['Row'] & SelfEvaluationExtra;
        Insert: SelfEvaluationsTable['Insert'] & Partial<SelfEvaluationExtra>;
        Update: SelfEvaluationsTable['Update'] & Partial<SelfEvaluationExtra>;
        Relationships: SelfEvaluationsTable['Relationships'];
      };
      ps_event_communications: Table<PsEventCommunicationRow>;
      ps_event_evaluator_scopes: Table<PsEventEvaluatorScopeRow>;
      ps_evaluation_scope_overrides: Table<PsEvaluationScopeOverrideRow>;
      ps_event_collaborator_adjustments: Table<PsEventCollaboratorAdjustmentRow>;
      ps_attendance_absences: Table<PsAttendanceAbsenceRow>;
      ps_attendance_closures: Table<PsAttendanceClosureRow>;
      ps_confirmation_history: Table<PsConfirmationHistoryRow>;
    };
    Functions: PublicSchema['Functions'] & {
      ps_admin_cancel_attendance_absence: {
        Args: { p_event_collaborator_id: string };
        Returns: boolean;
      };
      ps_admin_close_attendance_building: {
        Args: {
          p_event_id: string;
          p_campus: string | null;
          p_building: string;
          p_coordinator_event_collaborator_id: string;
          p_signature: string;
        };
        Returns: {
          success: boolean;
          message: string;
          present_count: number;
          absent_count: number;
          pending_count: number;
          role_adjustments_count: number;
          pix_adjustments_count: number;
        }[];
      };
      ps_admin_register_attendance_absence: {
        Args: {
          p_event_collaborator_id: string;
          p_responsible_event_collaborator_id: string;
          p_reason: string;
          p_signature: string;
        };
        Returns: { success: boolean; message: string }[];
      };
      ps_admin_sync_imported_evaluators: {
        Args: { p_event_id: string; p_event_collaborator_ids: string[] | null };
        Returns: {
          coordenadores_identificados: number;
          subcoordenadores_identificados: number;
          contas_criadas: number;
          contas_sincronizadas: number;
          escopos_criados: number;
          escopos_local_incompleto: number;
        }[];
      };
      ps_event_collaborator_confirmation_summary: {
        Args: { p_event_id: string | undefined };
        Returns: { status: string; total: number }[];
      };
      ps_public_search_event_roster: {
        Args: { p_event_id: string; p_search?: string };
        Returns: {
          id: string;
          collaborator_id: string | null;
          collaborator_name: string;
          role_name: string | null;
          assigned_role: string | null;
          campus: string | null;
          unit: string | null;
          sector: string | null;
          building: string | null;
          floor: string | null;
          room: string | null;
          present: boolean;
          absent: boolean;
          signed_at: string | null;
          departed_at: string | null;
          matricula_masked: string | null;
          email_masked: string | null;
        }[];
      };
      ps_set_event_participant_state: {
        Args: {
          p_link_id: string;
          p_expected_updated_at: string;
          p_present: boolean;
          p_absent: boolean;
          p_departed_at: string | null;
        };
        Returns: { success: boolean; updated_at: string | null }[];
      };
    };
  };
};

export const supabase = createClient<DatabaseCompat>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
});
