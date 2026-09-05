import { useState } from 'react';
import { CheckCircle2, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePsFiscalBankConfig } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';

const LEVELS = ['Ruim', 'Regular', 'Bom', 'Ótimo', 'Excelente'];
const FUNCOES = ['Fiscal de Sala', 'Fiscal Volante', 'Chefe de Andar', 'Subcoordenador', 'Coordenação', 'Apoio', 'Recepção', 'Digitação'];
const INGLES = ['Leitura', 'Escrita', 'Conversação', 'Compreensão auditiva', 'Nenhuma'];

export default function PsPublicFiscalBank() {
  const { data: config } = usePsFiscalBankConfig();
  const dates: string[] = (config as any)?.datas || [];
  const unavailableLabel = (config as any)?.data_indisponivel_label || 'Não tenho disponibilidade';

  const [form, setForm] = useState<any>({
    nome_completo: '',
    email: '',
    telefone_contato: '',
    instituto: '',
    setor: '',
    leitura_portugues: '',
    escrita_portugues: '',
    letra_legivel: '',
    agilidade_digitacao: '',
    dominio_ingles: '',
    observacoes: '',
  });
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [ingles, setIngles] = useState<string[]>([]);
  const [datas, setDatas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const toggle = (items: string[], setItems: (value: string[]) => void, value: string) =>
    setItems(items.includes(value) ? items.filter(item => item !== value) : [...items, value]);

  const submit = async () => {
    if (!form.nome_completo.trim() || !form.email.trim() || !form.telefone_contato.trim() || !form.instituto.trim() || !form.setor.trim()) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('ps_fiscal_bank_applications').insert({
      ...form,
      funcoes_com_conforto: funcoes,
      habilidades_ingles: ingles,
      datas_disponibilidade: datas,
    } as any);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 to-transparent" />
        <Card className="relative w-full max-w-md border-border/60 bg-card/90 text-center shadow-xl shadow-black/5">
          <CardHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <CardTitle className="pt-2">Inscrição enviada</CardTitle>
            <CardDescription className="leading-relaxed">Sua candidatura ao banco de fiscais foi registrada com sucesso.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const selectRow = (label: string, key: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={form[key]} onValueChange={value => set(key, value)}>
        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>{LEVELS.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  const checkGrid = (items: string[], selected: string[], setSelected: (value: string[]) => void) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(item => (
        <label key={item} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition-colors ${selected.includes(item) ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-muted/10 hover:bg-muted/20'}`}>
          <Checkbox checked={selected.includes(item)} onCheckedChange={() => toggle(selected, setSelected, item)} />
          {item}
        </label>
      ))}
    </div>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-7 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />

      <div className="relative mx-auto max-w-2xl space-y-5">
        <header className="flex items-start gap-3 border-b border-border/50 pb-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Banco de Fiscais</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Cadastre seu perfil, habilidades e disponibilidade para participar dos processos seletivos.</p>
          </div>
        </header>

        <Card className="border-border/60 bg-card/85 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dados pessoais</CardTitle>
            <CardDescription>Informações usadas para identificar e contatar você.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Nome completo *</Label>
              <Input value={form.nome_completo} onChange={event => set('nome_completo', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">E-mail *</Label>
              <Input type="email" value={form.email} onChange={event => set('email', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Telefone *</Label>
              <Input value={form.telefone_contato} onChange={event => set('telefone_contato', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Instituto *</Label>
              <Input value={form.instituto} onChange={event => set('instituto', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Setor *</Label>
              <Input value={form.setor} onChange={event => set('setor', event.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/85 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Habilidades</CardTitle>
            <CardDescription>Ajude a equipe a entender seus pontos de conforto e experiência.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {selectRow('Leitura em português', 'leitura_portugues')}
              {selectRow('Escrita em português', 'escrita_portugues')}
              {selectRow('Letra legível', 'letra_legivel')}
              {selectRow('Agilidade de digitação', 'agilidade_digitacao')}
              {selectRow('Domínio de inglês', 'dominio_ingles')}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Habilidades em inglês</Label>
              {checkGrid(INGLES, ingles, setIngles)}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Funções em que se sente confortável</Label>
              {checkGrid(FUNCOES, funcoes, setFuncoes)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/85 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Disponibilidade</CardTitle>
            <CardDescription>Selecione as datas em que você pode atuar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {checkGrid([...dates, unavailableLabel], datas, setDatas)}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea rows={3} value={form.observacoes} onChange={event => set('observacoes', event.target.value)} placeholder="Inclua alguma informação que possa ajudar na sua alocação" />
            </div>

            <div className="border-t border-border/50 pt-4">
              <Button className="w-full" onClick={() => void submit()} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar inscrição
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
