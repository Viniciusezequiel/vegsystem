import { useSearchParams } from 'react-router-dom';
import PsV2EventOverview from '@/components/processo-seletivo-v2/PsV2EventOverview';
import PsV2EventInsights from '@/components/processo-seletivo-v2/PsV2EventInsights';
import { PsV2SafeOperations } from '@/components/processo-seletivo-v2/PsV2SafeOperations';
import PsV2EventTeamReview from './PsV2EventTeamReview';

export default function PsV2EventTeam() {
  const [params] = useSearchParams();
  const view = params.get('view');
  if (view === 'overview') return <PsV2EventOverview />;
  if (view === 'pendencias') return <PsV2EventInsights />;
  if (view) return <PsV2SafeOperations />;
  return <PsV2EventTeamReview />;
}
