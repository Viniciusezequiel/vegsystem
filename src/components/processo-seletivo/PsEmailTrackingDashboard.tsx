import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo } from 'react';

export function PsEmailTrackingDashboard({ communications = [], events = [] }: { communications?: any[]; events?: any[] }) {
  const stats = useMemo(() => {
    const delivered = events.filter((item) => item.event_type === 'delivered').length;
    const opened = events.filter((item) => item.event_type === 'opened').length;
    const errors = events.filter((item) => ['bounce', 'blocked', 'spam'].includes(item.event_type)).length;

    return {
      sent: communications.filter((item) => item.status === 'sent').length,
      delivered,
      opened,
      errors,
    };
  }, [communications, events]);

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Card className="bg-gradient-to-br from-blue-600/10 to-blue-400/5">
        <CardHeader><CardTitle className="text-sm">Enviados</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">{stats.sent}</CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-emerald-600/10 to-emerald-400/5">
        <CardHeader><CardTitle className="text-sm">Entregues</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">{stats.delivered}</CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-violet-600/10 to-violet-400/5">
        <CardHeader><CardTitle className="text-sm">Abertos</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">{stats.opened}</CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-red-600/10 to-red-400/5">
        <CardHeader><CardTitle className="text-sm">Erros</CardTitle></CardHeader>
        <CardContent className="text-2xl font-bold">{stats.errors}</CardContent>
      </Card>
    </div>
  );
}
