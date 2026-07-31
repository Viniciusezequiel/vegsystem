import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, Copy, Plus, MapPin, Navigation, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { UBER_STATUS_LABELS } from '@/hooks/useUberRequests';
import { downloadReceiptPdf, formatDateBR, formatDateTimeBR, receiptToText, type ReceiptData } from '@/lib/uberReceipt';

interface Props {
  data: ReceiptData;
  onNew?: () => void;
  showSuccess?: boolean;
}

export function UberReceipt({ data, onNew, showSuccess = true }: Props) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(receiptToText(data));
      toast.success('Informações copiadas!');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  return (
    <div className="space-y-4">
      {showSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-primary">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="font-medium">Solicitação registrada com sucesso!</span>
        </div>
      )}

      <Card className="overflow-hidden rounded-2xl print:shadow-none" id="uber-receipt">
        <div className="bg-foreground px-6 py-5 text-background">
          <p className="text-xs uppercase tracking-widest opacity-70">Comprovante de solicitação de viagem</p>
          <h2 className="text-2xl font-bold">{data.code}</h2>
        </div>
        <CardContent className="space-y-5 p-6">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Solicitante</p>
            <p className="text-lg font-medium">{data.requester_name}</p>
          </div>

          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-2">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <p className="font-semibold text-primary">Viagem de: {data.origin}</p>
            </div>
            <div className="flex items-start gap-2">
              <Navigation className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <p className="font-semibold text-primary">Para: {data.destination}</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <p className="font-semibold text-primary">Motivo: {data.reason}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Data da viagem</p>
              <p className="flex items-center gap-2 font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {formatDateBR(data.trip_date)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Horário da solicitação</p>
              <p className="flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {data.trip_time}
              </p>
            </div>
          </div>

          {data.notes && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Observações</p>
              <p className="whitespace-pre-wrap">{data.notes}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Registrado em {formatDateTimeBR(data.created_at)}
            </p>
            <Badge variant="secondary">{UBER_STATUS_LABELS[data.status] ?? data.status}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => window.print()} variant="outline" className="transition-transform hover:-translate-y-0.5">
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
        <Button onClick={() => downloadReceiptPdf(data)} variant="outline" className="transition-transform hover:-translate-y-0.5">
          <Download className="mr-2 h-4 w-4" /> Baixar PDF
        </Button>
        <Button onClick={copy} variant="outline" className="transition-transform hover:-translate-y-0.5">
          <Copy className="mr-2 h-4 w-4" /> Copiar informações
        </Button>
        {onNew && (
          <Button onClick={onNew} className="transition-transform hover:-translate-y-0.5">
            <Plus className="mr-2 h-4 w-4" /> Nova solicitação
          </Button>
        )}
      </div>
    </div>
  );
}
