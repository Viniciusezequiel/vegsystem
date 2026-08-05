import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Download, Copy, Plus, X, Search } from 'lucide-react';
import { usePsFiscalBankApplications, usePsFiscalBankConfig, usePsSaveFiscalBankConfig } from '@/hooks/useProcessoSeletivo';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function PsFiscalBank() {
  const { data: applications = [] } = usePsFiscalBankApplications();
  const { data: config } = usePsFiscalBankConfig();
  const saveConfig = usePsSaveFiscalBankConfig();

  const [search, setSearch] = useState('');
  const [newDate, setNewDate] = useState('');
  const dates: string[] = (config as any)?.datas || [];
  const label = (config as any)?.data_indisponivel_label || 'Não tenho disponibilidade';

  const filtered = useMemo(
    () =>
      applications.filter((a: any) =>
        [a.nome_completo, a.email, a.setor, a.instituto].join(' ').toLowerCase().includes(search.toLowerCase()),
      ),
    [applications, search],
  );

  const publicUrl = `${window.location.origin}/ps/banco-fiscais`;

  const persist = (patch: any) => saveConfig.mutate({ id: (config as any)?.id, datas: dates, data_indisponivel_label: label, ...patch });

  const exportXlsx = () => {
    const rows = filtered.map((a: any) => ({
      Nome: a.nome_completo,
      'E-mail': a.email,
      Telefone: a.telefone_contato,
      Instituto: a.instituto,
      Setor: a.setor,
      'Leitura PT': a.leitura_portugues || '',
      'Escrita PT': a.escrita_portugues || '',
      'Letra legível': a.letra_legivel || '',
      Digitação: a.agilidade_digitacao || '',
      'Inglês': a.dominio_ingles || '',
      'Habilidades inglês': (a.habilidades_ingles || []).join(', '),
      Funções: (a.funcoes_com_conforto || []).join(', '),
      Disponibilidade: (a.datas_disponibilidade || []).join(', '),
      Observações: a.observacoes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Banco de Fiscais');
    XLSX.writeFile(wb, 'banco-de-fiscais.xlsx');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Banco de Fiscais</h1>
              <p className="text-muted-foreground">Inscrições públicas e configuração do formulário.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Link copiado!'); }}>
              <Copy className="mr-2 h-4 w-4" />Link público
            </Button>
            <Button variant="outline" onClick={exportXlsx}><Download className="mr-2 h-4 w-4" />Exportar</Button>
          </div>
        </div>

        <Tabs defaultValue="inscricoes">
          <TabsList>
            <TabsTrigger value="inscricoes">Inscrições ({applications.length})</TabsTrigger>
            <TabsTrigger value="config">Configuração</TabsTrigger>
          </TabsList>

          <TabsContent value="inscricoes" className="space-y-4 pt-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar inscrito..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Card className="rounded-2xl">
              <CardContent className="divide-y p-0">
                {filtered.map((a: any) => (
                  <div key={a.id} className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{a.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">{a.email} · {a.telefone_contato} · {a.instituto} / {a.setor}</p>
                      </div>
                      <Badge variant="secondary">{(a.datas_disponibilidade || []).length} datas</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(a.funcoes_com_conforto || []).map((f: string) => <Badge key={f} variant="outline">{f}</Badge>)}
                    </div>
                    {a.observacoes && <p className="text-sm text-muted-foreground">{a.observacoes}</p>}
                  </div>
                ))}
                {filtered.length === 0 && <p className="p-4 text-muted-foreground">Nenhuma inscrição encontrada.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="pt-4">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Datas disponíveis</CardTitle>
                <CardDescription>Datas exibidas no formulário público de inscrição.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Ex.: 15/03/2026 - Manhã" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  <Button
                    onClick={() => {
                      if (!newDate.trim()) return;
                      persist({ datas: [...dates, newDate.trim()] });
                      setNewDate('');
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dates.map((d) => (
                    <Badge key={d} variant="secondary" className="gap-1">
                      {d}
                      <button type="button" onClick={() => persist({ datas: dates.filter((x) => x !== d) })}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {dates.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma data cadastrada.</p>}
                </div>
                <div className="space-y-2">
                  <Label>Rótulo da opção "sem disponibilidade"</Label>
                  <Input
                    defaultValue={label}
                    onBlur={(e) => e.target.value !== label && persist({ data_indisponivel_label: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
