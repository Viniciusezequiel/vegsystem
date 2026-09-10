import { FileText, IdCard, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePsCandidates, usePsEventCollaborators } from '@/hooks/useProcessoSeletivo';
import { generatePsBadgesPdf, generatePsCandidateBadgesPdf } from '@/lib/psEventPdf';

type Props = { event: any };

export function PsEventDocumentsPanel({ event }: Props) {
  const { data: links = [], isLoading: linksLoading } = usePsEventCollaborators(event.id);
  const { data: candidates = [], isLoading: candidatesLoading } = usePsCandidates(event.id);
  const loading = linksLoading || candidatesLoading;
  const slug = String(event.name || 'evento').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const eventInfo = {
    name: event.name || '',
    date: event.date ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR') : '',
    location: event.location || '',
  };

  const exportTeam = () => {
    const active = links.filter((item: any) => item.participation_status !== 'replaced');
    if (!active.length) return toast.error('Nenhum colaborador vinculado ao evento.');
    generatePsBadgesPdf(eventInfo, active as any).save(`etiquetas-equipe-${slug || 'evento'}.pdf`);
  };

  const exportCandidates = () => {
    if (!candidates.length) return toast.error('Nenhum candidato disponível para geração de etiquetas.');
    const rows = candidates.map((candidate: any) => ({
      full_name: candidate.full_name,
      cpf: candidate.cpf,
      campus: candidate.campus,
      room: candidate.room,
      seat_number: candidate.seat_number || candidate.seat,
      registration_number: candidate.registration_number,
      pcd_type: candidate.pcd_type,
    }));
    generatePsCandidateBadgesPdf(eventInfo, rows).save(`etiquetas-candidatos-${slug || 'evento'}.pdf`);
  };

  if (loading) return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando dados do evento...</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></div>
          <CardTitle className="pt-2 text-base">Etiquetas da equipe</CardTitle>
          <CardDescription>Gera os crachás/etiquetas dos colaboradores vinculados ao evento.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">{links.filter((item: any) => item.participation_status !== 'replaced').length} colaborador(es) disponível(is).</p>
          <Button className="w-full" onClick={exportTeam}><IdCard className="mr-2 h-4 w-4" />Gerar PDF da equipe</Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
          <CardTitle className="pt-2 text-base">Etiquetas dos candidatos</CardTitle>
          <CardDescription>Usa a lista de candidatos importada para o evento.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">{candidates.length} candidato(s) disponível(is).</p>
          <Button className="w-full" onClick={exportCandidates} disabled={!candidates.length}><IdCard className="mr-2 h-4 w-4" />Gerar PDF dos candidatos</Button>
        </CardContent>
      </Card>
    </div>
  );
}
