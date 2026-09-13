import { useSearchParams } from 'react-router-dom';
import PsV2EventOverview from '@/components/processo-seletivo-v2/PsV2EventOverview';
import PsV2EventInsights from '@/components/processo-seletivo-v2/PsV2EventInsights';
import PsV2EventPreparation from '@/components/processo-seletivo-v2/PsV2EventPreparation';
import PsV2EventReadiness from '@/components/processo-seletivo-v2/PsV2EventReadiness';
import PsV2EventReports from '@/components/processo-seletivo-v2/PsV2EventReports';
import PsV2EventClosurePreview from '@/components/processo-seletivo-v2/PsV2EventClosurePreview';
import PsV2IntegrationDryRun from '@/components/processo-seletivo-v2/PsV2IntegrationDryRun';
import { PsV2SafeOperations } from '@/components/processo-seletivo-v2/PsV2SafeOperations';
import PsV2EventTeamReview from './PsV2EventTeamReview';

export default function PsV2EventTeam() {
  const [params] = useSearchParams();
  const view = params.get('view');
  if (view === 'overview') return <PsV2EventOverview />;
  if (view === 'pendencias') return <PsV2EventInsights />;
  if (view === 'preparacao') return <PsV2EventPreparation />;
  if (view === 'prontidao') return <PsV2EventReadiness />;
  if (view === 'relatorios') return <PsV2EventReports />;
  if (view === 'encerramento') return <PsV2EventClosurePreview />;
  if (view === 'integracao') return <PsV2IntegrationDryRun />;
  if (view) return <PsV2SafeOperations />;
  return <PsV2EventTeamReview />;
}
