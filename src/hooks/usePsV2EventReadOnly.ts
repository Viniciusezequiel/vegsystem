import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const safeRows = (result: any) => result?.error ? [] : (result?.data || []);

export function usePsV2EventReadOnly(eventId?: string) {
  return useQuery({
    queryKey: ['ps-v2', 'event-readonly', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const [teamRes, commRes, groupRes, sessionRes, choiceRes, evalRes, selfRes, assignmentRes] = await Promise.all([
        db.from('ps_event_collaborators')
          .select('id,collaborator_id,collaborator_name,role_name,assigned_role,participation_status,present,absent,signed_at,evaluated,pay_value,room,floor,unit,email')
          .eq('event_id', eventId)
          .order('collaborator_name'),
        db.from('ps_event_communications')
          .select('id,event_collaborator_id,communication_type,status,attempt_count,requested_at,sent_at,failed_at,last_error')
          .eq('event_id', eventId)
          .order('requested_at', { ascending: false }),
        db.from('ps_event_training_groups')
          .select('id,name,description,required,active,created_at')
          .eq('event_id', eventId)
          .order('created_at'),
        db.from('ps_event_training_sessions')
          .select('id,event_id,training_group_id,starts_at,capacity,location,active')
          .eq('event_id', eventId)
          .order('starts_at'),
        db.from('ps_event_training_choices')
          .select('id,event_id,training_group_id,event_collaborator_id,session_id,created_at')
          .eq('event_id', eventId),
        db.from('ps_evaluations').select('id,event_id,final_score,created_at').eq('event_id', eventId),
        db.from('ps_self_evaluations').select('id,event_id,created_at').eq('event_id', eventId),
        db.from('ps_event_collaborator_assignments')
          .select('id,event_collaborator_id,role_name,pay_value,is_primary,created_at')
          .eq('event_id', eventId)
          .order('is_primary', { ascending: false })
          .order('created_at'),
      ]);

      if (teamRes.error) throw teamRes.error;
      const team = safeRows(teamRes);
      const communications = safeRows(commRes);
      const trainingGroups = safeRows(groupRes);
      const trainingSessions = safeRows(sessionRes);
      const trainingChoices = safeRows(choiceRes);
      const evaluations = safeRows(evalRes);
      const selfEvaluations = safeRows(selfRes);
      const assignments = safeRows(assignmentRes);

      const activeTeam = team.filter((member: any) => !member.absent && member.participation_status !== 'replaced');
      const confirmed = activeTeam.filter((member: any) => member.participation_status === 'confirmed').length;
      const pendingConfirmation = activeTeam.filter((member: any) => !member.participation_status || member.participation_status === 'pending_confirmation').length;
      const declined = team.filter((member: any) => member.participation_status === 'declined').length;
      const present = activeTeam.filter((member: any) => !!member.present || !!member.signed_at).length;
      const absent = team.filter((member: any) => !!member.absent).length;

      const sent = communications.filter((item: any) => item.status === 'sent').length;
      const failed = communications.filter((item: any) => ['failed', 'failed_missing_recipient'].includes(item.status)).length;
      const waiting = communications.filter((item: any) => ['pending', 'processing', 'waiting_provider_quota'].includes(item.status)).length;

      const activeGroups = trainingGroups.filter((group: any) => group.active !== false);
      const requiredGroups = activeGroups.filter((group: any) => group.required);
      const choiceParticipants = new Set(trainingChoices.map((item: any) => item.event_collaborator_id).filter(Boolean)).size;

      const assignmentMap = new Map<string, number>();
      for (const item of assignments) {
        const current = assignmentMap.get(item.event_collaborator_id) || 0;
        assignmentMap.set(item.event_collaborator_id, current + Number(item.pay_value || 0));
      }
      const financialRows = activeTeam.map((member: any) => ({
        ...member,
        total: assignmentMap.has(member.id) ? Number(assignmentMap.get(member.id) || 0) : Number(member.pay_value || 0),
      }));
      const forecastTotal = financialRows.reduce((sum: number, row: any) => sum + row.total, 0);
      const payableRows = financialRows.filter((row: any) => !!row.present || !!row.signed_at);
      const payableTotal = payableRows.reduce((sum: number, row: any) => sum + row.total, 0);

      return {
        team,
        activeTeam,
        communications,
        trainingGroups: activeGroups,
        trainingSessions: trainingSessions.filter((session: any) => session.active !== false),
        trainingChoices,
        evaluations,
        selfEvaluations,
        assignments,
        financialRows,
        metrics: {
          team: activeTeam.length,
          confirmed,
          pendingConfirmation,
          declined,
          present,
          absent,
          communicationSent: sent,
          communicationFailed: failed,
          communicationWaiting: waiting,
          trainingGroups: activeGroups.length,
          requiredTrainingGroups: requiredGroups.length,
          trainingSessions: trainingSessions.filter((session: any) => session.active !== false).length,
          trainingChoiceParticipants: choiceParticipants,
          evaluations: evaluations.length,
          selfEvaluations: selfEvaluations.length,
          forecastTotal,
          payableTotal,
          payablePeople: payableRows.length,
        },
      };
    },
  });
}
