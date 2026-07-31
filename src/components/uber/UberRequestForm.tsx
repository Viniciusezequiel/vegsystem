import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Car } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateUberRequest, type UberRequestInput } from '@/hooks/useUberRequests';
import { UberReceipt } from './UberReceipt';
import type { ReceiptData } from '@/lib/uberReceipt';
import { formatDateBR } from '@/lib/uberReceipt';

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
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
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
      ['Nome do solicitante', form.requester_name],
      ['Local de saída', form.origin],
      ['Local de destino', form.destination],
      ['Data da viagem', formatDateBR(form.trip_date)],
      ['Horário da solicitação', form.trip_time],
      ['Motivo da viagem', form.reason],
      ['Observações', form.notes || '—'],
    ];
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Confirme os dados da solicitação</CardTitle>
          <CardDescription>Revise as informações antes de finalizar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="divide-y rounded-xl border">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="font-medium sm:text-right">{value}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep('form')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar e editar
            </Button>
            <Button onClick={submit} disabled={createRequest.isPending} className="transition-transform hover:-translate-y-0.5">
              {createRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Finalizar solicitação
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const field = (key: keyof UberRequestInput, label: string, type = 'text', required = true) => (
    <div className="space-y-2">
      <Label htmlFor={key}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={key}
        type={type}
        value={(form[key] as string) ?? ''}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={!!errors[key]}
      />
      {errors[key] && <p className="text-sm text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" /> Nova solicitação de Uber
        </CardTitle>
        <CardDescription>Preencha os dados da viagem. Campos com * são obrigatórios.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {field('requester_name', 'Nome do solicitante')}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('origin', 'Local de saída')}
          {field('destination', 'Local de destino')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('trip_date', 'Data da viagem', 'date')}
          {field('trip_time', 'Horário da solicitação', 'time')}
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">
            Motivo da viagem <span className="text-destructive">*</span>
          </Label>
          <Textarea id="reason" rows={3} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
          {errors.reason && <p className="text-sm text-destructive">{errors.reason}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Observações adicionais</Label>
          <Textarea id="notes" rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </div>
        <Button
          className="w-full transition-transform hover:-translate-y-0.5"
          onClick={() => validate() && setStep('confirm')}
        >
          Revisar e continuar
        </Button>
      </CardContent>
    </Card>
  );
}
