import { Navigate, useParams } from 'react-router-dom';

export default function PsPublicEvaluation() {
  const { eventId } = useParams<{ eventId?: string }>();

  return (
    <Navigate
      replace
      to={
        eventId
          ? `/ps/avaliador/${eventId}`
          : '/ps/avaliador'
      }
    />
  );
}
