import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, CheckCircle2 } from 'lucide-react';
import { usePsFiscalBankConfig } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LEVELS = ['Ruim', 'Regular', 'Bom', 'Ótimo', 'Excelente'];
const FUNCOES = ['Fiscal de Sala', 'Fiscal Volante', 'Chefe de Andar', 'Subcoordenador', 'Coordenação', 'Apoio', 'Recepção', 'Digitação'];
const INGLES = ['Leitura', 'Escrita', 'Conversação', 'Compreensão auditiva', 'Nenhuma'];

export default function PsPublicFiscalBank() {
  const { data: config } = usePsFiscalBankConfig();
  const dates: string[] = (config as any)?.datas || [];
  const unavailableLabel = (config as any)?.data_indisponivel_label || 'Não tenho disponibilidade';

  const [form, setForm] = useState<any>({
    nome_completo: '', email: '', telefone_contato: '', instituto: '', setor: '',
    leitura_portugues: '', escrita_portugues: '', letra_legivel: '', agilidade_digitacao: '',
    dominio_ingles: '', observacoes: '',
  });
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [ingles, setIngles] = useState<string[]>([]);
  const [datas, setDatas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggle = (arr: string[], setArr: (v: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

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
    if (error) { toast.error(error.message); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md rounded-2xl text-center">
          <CardHeader>
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <CardTitle>Inscrição enviada!</CardTitle>
            <CardDescription>Sua candidatura ao banco de fiscais foi registrada.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const selectRow = (label: string, key: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={form[key]} onValueChange={(v) => set(key, v)}>
        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Banco de Fiscais</h1>
            <p className="text-muted-foreground">Cadastre-se para participar dos processos seletivos.</p>
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Dados pessoais</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome completo *</Label>
              <Input value={form.nome_completo} onChange={(e) => set('nome_completo', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input value={form.telefone_contato} onChange={(e) => set('telefone_contato', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Instituto *</Label>
              <Input value={form.instituto} onChange={(e) => set('instituto', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Setor *</Label>
              <Input value={form.setor} onChange={(e) => set('setor', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Habilidades</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {selectRow('Leitura em português', 'leitura_portugues')}
            {selectRow('Escrita em português', 'escrita_portugues')}
            {selectRow('Letra legível', 'letra_legivel')}
            {selectRow('Agilidade de digitação', 'agilidade_digitacao')}
            {selectRow('Domínio de inglês', 'dominio_ingles')}
            <div className="space-y-2 sm:col-span-2">
              <Label>Habilidades em inglês</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {INGLES.map((i) => (
                  <label key={i} className="flex items-center gap-2 rounded-xl border p-2 text-sm">
                    <Checkbox checked={ingles.includes(i)} onCheckedChange={() => toggle(ingles, setIngles, i)} />
                    {i}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Funções em que se sente confortável</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {FUNCOES.map((f) => (
                  <label key={f} className="flex items-center gap-2 rounded-xl border p-2 text-sm">
                    <Checkbox checked={funcoes.includes(f)} onCheckedChange={() => toggle(funcoes, setFuncoes, f)} />
                    {f}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Disponibilidade</CardTitle>
            <CardDescription>Selecione as datas em que pode atuar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {[...dates, unavailableLabel].map((d) => (
                <label key={d} className="flex items-center gap-2 rounded-xl border p-2 text-sm">
                  <Checkbox checked={datas.includes(d)} onCheckedChange={() => toggle(datas, setDatas, d)} />
                  {d}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
            </div>
            <Button className="w-full" onClick={submit} disabled={saving}>
              {saving ? 'Enviando...' : 'Enviar inscrição'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
