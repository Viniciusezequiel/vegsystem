import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trophy, Search, Download } from 'lucide-react';
import { usePsCollaborators, usePsEvaluations } from '@/hooks/useProcessoSeletivo';
import { PS_CLASSIFICATION_LABEL, psClassification } from '@/lib/psConstants';
import * as XLSX from 'xlsx';

export default function PsTalentBank() {
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: evaluations = [] } = usePsEvaluations();
  const [search, setSearch] = useState('');

  const ranked = collaborators
    .map((c: any) => ({
      ...c,
      evaluations_count: evaluations.filter((e: any) => e.collaborator_id === c.id).length,
      classification: psClassification(Number(c.average_rating || 0)),
    }))
    .filter((c: any) => c.full_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => Number(b.average_rating) - Number(a.average_rating));

  const exportXlsx = () => {
    const rows = ranked.map((c: any, i: number) => ({
      Posição: i + 1,
      Nome: c.full_name,
      'Nota média': Number(c.average_rating || 0).toFixed(2),
      Classificação: PS_CLASSIFICATION_LABEL[c.classification],
      Processos: c.total_events || 0,
      Avaliações: c.evaluations_count,
      Setor: c.sector || '',
      Telefone: c.phone || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Banco de Talentos');
    XLSX.writeFile(wb, 'banco-de-talentos.xlsx');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Banco de Talentos</h1>
              <p className="text-muted-foreground">Ranking geral por desempenho médio.</p>
            </div>
          </div>
          <Button variant="outline" onClick={exportXlsx}><Download className="mr-2 h-4 w-4" />Exportar</Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar colaborador..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Classificação</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {ranked.map((c: any, i: number) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
                  <div>
                    <p className="font-medium">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.total_events || 0} processos · {c.evaluations_count} avaliações {c.sector ? `· ${c.sector}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{PS_CLASSIFICATION_LABEL[c.classification]}</Badge>
                  <Badge>{Number(c.average_rating || 0).toFixed(2)}</Badge>
                </div>
              </div>
            ))}
            {ranked.length === 0 && <p className="p-4 text-muted-foreground">Nenhum colaborador encontrado.</p>}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
