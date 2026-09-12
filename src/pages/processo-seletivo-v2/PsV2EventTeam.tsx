import { useSearchParams } from 'react-router-dom';
import { PsV2SafeOperations } from '@/components/processo-seletivo-v2/PsV2SafeOperations';
import PsV2EventTeamReview from './PsV2EventTeamReview';

export default function PsV2EventTeam() {
  const [params] = useSearchParams();
  const view = params.get('view');
  if (view) return <PsV2SafeOperations />;
  return <PsV2EventTeamReview />;
}
