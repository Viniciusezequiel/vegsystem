import { useMemo, useState } from 'react';
import { Search, Sparkles, UserCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { rankPsV2CandidatesForRequirement, type PsV2RankedCandidate } from '@/lib/psV2AllocationEngine';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: Record<string, any> | null;
  collaborators: Record<string, any>[];
  participations: Record<string, any>[];
  eligibilityRules: Record<string, any>[];
  eventId?: string;
  eventDate?: string | null;
  excludedCollaboratorIds?: string[];
  onSelect: (candidate: PsV2RankedCandidate) => void;
  isSaving?: boolean;
};

export function PsV2CandidateDialog({
  open,
  onOpenChange,
  requirement,
  collaborators,
  participations,
  eligibilityRules,
  eventId,
  eventDate,
  excludedCollaboratorIds = [],
  onSelect,
  isSaving = false,
}: Props) {
  const [search, setSearch] = useState('');

  const candidates = useMemo(() => {
    if (!requirement) return [];
    return rankPsV2CandidatesForRequirement({
      requirement,
      collaborators,
      participations,
      eligibilityRules,
      eventId,
      eventDate,
      excludedCollaboratorIds,
    });
  }, [requirement, collaborators, participations, eligibilityRules, eventId, eventDate, excludedCollaboratorIds]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return candidates.slice(0, 30);
    return candidates.filter(({ collaborator }) => [
      collaborator.full_name,
      collaborator.role,
      collaborator.position,
      collaborator.sector,
      collaborator.unit,
      collaborator.preferred_role,
    ].filter(Boolean).some((value) => String(value).toLocaleLowerCase('pt-BR').includes(needle))).slice(0, 30);
  }, [candidates, search]);

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) setSearch(''); }}>
      <DialogContent className="max-h-[86vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle>Trocar fiscal da alocação</DialogTitle>
          <DialogDescription>
            Ranking calculado para {requirement?.role_name_snapshot || 'a função selecionada'}. A troca fica somente na proposta V2.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, cargo, setor ou unidade..." className="pl-9" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{candidates.length} elegíveis</Badge>
            <span>Ordenados por compatibilidade, experiência e histórico.</span>
          </div>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-6 pb-6 pt-4">
          {filtered.length ? (
            <div className="space-y-2">
              {filtered.map((candidate, index) => {
                const collaborator = candidate.collaborator;
                return (
                  <button
                    type="button"
                    key={collaborator.id}
                    disabled={isSaving}
                    onClick={() => onSelect(candidate)}
                    className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card/50 p-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{collaborator.full_name}</p>
                        <Badge variant="outline" className="font-mono text-[10px]">{candidate.score.toFixed(1)}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{collaborator.position || collaborator.role || 'Perfil sem cargo informado'}{collaborator.sector ? ` · ${collaborator.sector}` : ''}</p>
                      {candidate.reasons.length ? <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{candidate.reasons.join(' · ')}</p> : null}
                    </div>
                    <UserCheck className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <Sparkles className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">Nenhum candidato elegível encontrado.</p>
              <p className="mt-1 text-xs text-muted-foreground">Revise a matriz de elegibilidade ou os dados dos fiscais.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
