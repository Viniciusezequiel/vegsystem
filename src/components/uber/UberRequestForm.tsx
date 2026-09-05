import { useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  Car,
  CheckCircle2,
  Loader2,
  MapPin,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateUberRequest, type UberRequestInput } from '@/hooks/useUberRequests';
import { formatDateBR, type ReceiptData } from '@/lib/uberReceipt';
import { UberReceipt } from './UberReceipt';

const emptyForm: UberRequestInput = {
  requester_name: '',
  origin: '',
  destination: '',
  trip_date: '',
  trip_time: '',
  reason: '',
  notes: '',
};

export function UberRequestForm() {
  const [form, setForm] = useState<UberRequestInput>(emptyForm);
  const [step, setStep] = useState<'form' | 'confirm' | 'receipt'>('form');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createRequest = useCreateUberRequest();

  const set = (key: keyof UberRequestInput, value: string) => {
    setForm(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: '' }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.requester_name.trim()) next.requester_name = 'Informe o nome do solicitante.';
    if (!form.origin.trim()) next.origin = 'Informe o local de saída.';
    if (!form.destination.trim()) next.destination = 'Informe o local de destino.';
    if (!form.trip_date) next.trip_date = 'Informe a data da viagem.';
    if (!form.trip_time) next.trip_time = 'Informe o horário da solicitação.';
    if (!form.reason.trim()) next.reason = 'Informe o motivo da viagem.';
    setErrors(next);

    if (Object.keys(next).length) {
      toast.error('Preencha todos os campos obrigatórios.');
      return false;
    }
    return true;
  };

  const submit = async () => {
    const created = await createRequest.mutateAsync({
      ...form,
      requester_name: form.requester_name.trim(),
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      reason: form.reason.trim(),
      notes: form.notes?.trim() || null,
    });
    setReceipt({ ...created, status: 'registrada' });
    setStep('receipt');
  };

  if (step === 'receipt' && receipt) {
    return (
      <UberReceipt
        data={receipt}
        onNew={() => {
          setForm(emptyForm);
          setReceipt(null);
          setStep('form');
        }}
      />
    );
  }

  if (step === 'confirm') {
    const rows: [string, string][] = [
      ['Solicitante', form.requester_name],
      ['Origem', form.origin],
      ['Destino', form.destination],
      ['Data da viagem', formatDateBR(form.trip_date)],
      ['Horário', form.trip_time],
      ['Motivo', form.reason],
      ['Observações', form.notes || '—'],
    ];

    return (
      <Card className="border-border/60 bg-card/75 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <CardTitle className="pt-2 text-lg">Revise antes de enviar</CardTitle>
          <CardDescription>Confira os dados da viagem. Você ainda pode voltar e editar qualquer informação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/10">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 border-b border-border/50 px-4 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="max-w-md break-words text-sm font-medium sm:text-right">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setStep('form')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar e editar
            </Button>
            <Button onClick={() => void submit()} disabled={createRequest.isPending}>
              {createRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Finalizar solicitação
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const field = (
    key: keyof UberRequestInput,
    label: string,
    type = 'text',
    required = true,
    placeholder?: string,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key} className="text-xs text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={key}
        type={type}
        value={(form[key] as string) ?? ''}
        onChange={event => set(key, event.target.value)}
        aria-invalid={!!errors[key]}
        placeholder={placeholder}
      />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <Card className="border-border/60 bg-card/75 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Car className="h-4 w-4" />
        </div>
        <CardTitle className="pt-2 text-lg">Dados da viagem</CardTitle>
        <CardDescription>Preencha os campos obrigatórios e revise antes de finalizar.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <UserRound className="h-3.5 w-3.5" />
            Solicitante
          </div>
          {field('requester_name', 'Nome do solicitante', 'text', true, 'Nome completo')}
        </section>

        <section className="space-y-4 border-t border-border/50 pt-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Trajeto
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('origin', 'Local de saída', 'text', true, 'Origem da viagem')}
            {field('destination', 'Local de destino', 'text', true, 'Destino da viagem')}
          </div>
        </section>

        <section className="space-y-4 border-t border-border/50 pt-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            Data e horário
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('trip_date', 'Data da viagem', 'date')}
            {field('trip_time', 'Horário da solicitação', 'time')}
          </div>
        </section>

        <section className="space-y-4 border-t border-border/50 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs text-muted-foreground">
              Motivo da viagem <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              rows={3}
              value={form.reason}
              onChange={event => set('reason', event.target.value)}
              placeholder="Descreva o motivo da solicitação"
            />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs text-muted-foreground">Observações adicionais</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes ?? ''}
              onChange={event => set('notes', event.target.value)}
              placeholder="Informações complementares, se necessário"
            />
          </div>
        </section>

        <div className="border-t border-border/50 pt-4">
          <Button className="w-full sm:w-auto" onClick={() => validate() && setStep('confirm')}>
            Revisar e continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
