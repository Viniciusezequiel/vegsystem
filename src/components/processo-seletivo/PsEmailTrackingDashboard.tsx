import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo } from 'react';

const errorStatuses = new Set(['soft_bounce', 'hard_bounce', 'blocked', 'spam', 'invalid', 'error', 'unsubscribed']);

export function PsEmailTrackingDashboard({ communications = [] }: { communications?: any[] }) {
  const stats = useMemo(() => {
    const delivered = communications.filter((item) => ['delivered', 'opened', 'clicked'].includes(item.delivery_status)).length;
    const opened = communications.filter((item) => ['opened', 'clicked'].includes(item.delivery_status)).length;
    const errors = communications.filter((item) => errorStatuses.has(item.delivery_status) || ['failed', 'failed_missing_recipient'].includes(item.status)).length;

    return {
      sent: communications.filter((item) => item.status === 'sent').length,
      delivered,
      opened,
      errors,
    };
  }, [communications]);

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Card className="bg-gradient-to-br from-blue-600/10 to-blue-400/5">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Enviados</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">{stats.sent}</CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-emerald-600/10 to-emerald-400/5">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Entregues</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">{stats.delivered}</CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-violet-600/10 to-violet-400/5">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Abertos</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">{stats.opened}</CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-red-600/10 to-red-400/5">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Erros</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">{stats.errors}</CardContent>
      </Card>
    </div>
  );
}
