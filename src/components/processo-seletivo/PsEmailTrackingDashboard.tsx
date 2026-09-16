import { Card, CardContent } from '@/components/ui/card';
import { CheckCheck, Eye, MailCheck, TriangleAlert } from 'lucide-react';
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

  const items = [
    { label: 'Enviados', value: stats.sent, icon: MailCheck, tone: 'text-blue-400', surface: 'from-blue-600/12 to-blue-400/5' },
    { label: 'Entregues', value: stats.delivered, icon: CheckCheck, tone: 'text-emerald-400', surface: 'from-emerald-600/12 to-emerald-400/5' },
    { label: 'Abertos', value: stats.opened, icon: Eye, tone: 'text-violet-400', surface: 'from-violet-600/12 to-violet-400/5' },
    { label: 'Erros', value: stats.errors, icon: TriangleAlert, tone: 'text-rose-400', surface: 'from-rose-600/12 to-rose-400/5' },
  ];

  return (
    <Card className="overflow-hidden border-primary/15 bg-card/60">
      <CardContent className="grid grid-cols-2 divide-x divide-y p-0 sm:grid-cols-4 sm:divide-y-0">
        {items.map(({ label, value, icon: Icon, tone, surface }) => (
          <div key={label} className={`flex min-h-14 items-center gap-3 bg-gradient-to-br ${surface} px-3 py-2.5`}>
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background/45 ${tone}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold leading-none tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
