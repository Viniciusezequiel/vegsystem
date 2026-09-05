import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { ContentState } from '@/components/layout/ContentState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ClipboardCheck, Eye, Check, X, Plus, Search, User, Calendar, Building2, Clock, MessageSquare, Download, Trash2 } from 'lucide-react';
import { useRoomChecklists, useChecklistWithAnswers, useRoomsList, RoomChecklist } from '@/hooks/useRooms';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { RoomsModuleNav } from '@/components/rooms/RoomsModuleNav';

function useProfileName(userId: string) {
  return useQuery({
    queryKey: ['profile-name', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.full_name || null;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export default function ChecklistHistory() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null);

  const { data: rooms } = useRoomsList();
  const { data: checklists, isLoading } = useRoomChecklists(
    selectedRoomFilter === 'all' ? undefined : selectedRoomFilter
  );
  const { data: checklistDetail, isLoading: loadingDetail } = useChecklistWithAnswers(selectedChecklist || '');
  const { data: profileName } = useProfileName(checklistDetail?.filled_by || '');

  const handleExport = async () => {
    if (!filteredChecklists.length) return;
    try {
      const chunk = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };

      const ids = filteredChecklists.map(c => c.id);
      const userIds = [...new Set(filteredChecklists.map(c => c.filled_by).filter(Boolean))] as string[];
      const profileMap = new Map<string, string>();

      for (const part of chunk(userIds, 100)) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', part);
        (profiles || []).forEach(p => profileMap.set(p.user_id, p.full_name));
      }

      const answers: any[] = [];
      for (const part of chunk(ids, 100)) {
        const { data, error: ansErr } = await supabase
          .from('checklist_answers')
          .select('checklist_id, answer, notes, question:checklist_questions(question, category)')
          .in('checklist_id', part)
          .limit(10000);
        if (ansErr) throw ansErr;
        answers.push(...(data || []));
      }

      const answersByChecklist = new Map<string, any[]>();
      answers.forEach((a: any) => {
        const arr = answersByChecklist.get(a.checklist_id) || [];
        arr.push(a);
        answersByChecklist.set(a.checklist_id, arr);
      });

      const parseObs = (observations: string | null) => {
        if (!observations) return { customItems: null as any, generalObservations: null as string | null };
        try {
          const parsed = JSON.parse(observations);
          if (parsed && typeof parsed === 'object') {
            return {
              customItems: parsed.customItems || null,
              generalObservations: parsed.generalObservations || null,
            };
          }
        } catch {
          return { customItems: null, generalObservations: observations };
        }
        return { customItems: null, generalObservations: observations };
      };

      const rows = filteredChecklists.map(c => {
        const cAnswers = answersByChecklist.get(c.id) || [];
        const { customItems, generalObservations } = parseObs(c.observations);

        const respostas = cAnswers
          .map((a: any) => {
            const status = a.answer ? 'OK' : 'PENDENTE';
            const cat = a.question?.category ? `[${a.question.category}] ` : '';
            const note = a.notes ? ` — ${a.notes}` : '';
            return `${cat}${a.question?.question || '-'}: ${status}${note}`;
          })
          .join('\n');

        const itensPersonalizados = customItems
          ? Object.values(customItems)
              .map((it: any) => {
                const status = it.answer ? 'OK' : 'PENDENTE';
                const note = it.notes ? ` — ${it.notes}` : '';
                return `${it.label}: ${status}${note}`;
              })
              .join('\n')
          : '';

        return {
          Sala: c.room?.name || 'N/A',
          Campus: c.room?.campus || '',
          Prédio: c.room?.building || '',
          Turno: c.shift,
          'Preenchido por': profileMap.get(c.filled_by) || 'N/A',
          'Data/Hora': format(parseISO(c.filled_at), 'dd/MM/yyyy HH:mm'),
          Respostas: respostas,
          'Itens Personalizados': itensPersonalizados,
          'Observações Gerais': generalObservations || '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 25 },
        { wch: 18 }, { wch: 60 }, { wch: 40 }, { wch: 40 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Checklists');
      XLSX.writeFile(wb, `checklists_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Exportação realizada!');
    } catch (err: any) {
      toast.error('Erro ao exportar: ' + (err.message || err));
    }
  };

  const handleCleanup = async () => {
    if (!filteredChecklists.length) return;
    const ids = filteredChecklists.map(c => c.id);
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));

    try {
      for (const part of batches) {
        const { error: ansErr } = await supabase.from('checklist_answers').delete().in('checklist_id', part);
        if (ansErr) throw ansErr;
        const { error } = await supabase.from('room_checklists').delete().in('id', part);
        if (error) throw error;
      }
      toast.success(`${ids.length} checklist(s) removido(s).`);
      queryClient.invalidateQueries({ queryKey: ['room-checklists'] });
    } catch (e: any) {
      toast.error('Erro ao limpar checklists: ' + (e.message || e));
    }
  };

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const filteredChecklists = useMemo(() => {
    if (!checklists) return [];

    return checklists.filter((checklist) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          checklist.room?.name?.toLowerCase().includes(query) ||
          checklist.room?.building?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (selectedShiftFilter !== 'all' && checklist.shift !== selectedShiftFilter) return false;

      if (startDate) {
        const checklistDate = parseISO(checklist.filled_at);
        const start = new Date(startDate + 'T00:00:00');
        if (checklistDate < start) return false;
      }
      if (endDate) {
        const checklistDate = parseISO(checklist.filled_at);
        const end = new Date(endDate + 'T23:59:59');
        if (checklistDate > end) return false;
      }

      return true;
    });
  }, [checklists, searchQuery, selectedShiftFilter, startDate, endDate]);

  const groupedAnswers = checklistDetail?.answers?.reduce((acc, a) => {
    const category = a.question?.category || 'Geral';
    if (!acc[category]) acc[category] = [];
    acc[category].push(a);
    return acc;
  }, {} as Record<string, typeof checklistDetail.answers>);

  const parseObservations = (observations: string | null) => {
    if (!observations) return { customItems: null, generalObservations: null };

    try {
      const parsed = JSON.parse(observations);
      if (parsed && typeof parsed === 'object') {
        return {
          customItems: parsed.customItems || null,
          generalObservations: parsed.generalObservations || null,
        };
      }
    } catch {
      return { customItems: null, generalObservations: observations };
    }
    return { customItems: null, generalObservations: observations };
  };

  const parsedObservations = parseObservations(checklistDetail?.observations || null);
  const hasActiveFilters = searchQuery || selectedRoomFilter !== 'all' || selectedShiftFilter !== 'all' || startDate || endDate;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedRoomFilter('all');
    setSelectedShiftFilter('all');
    setStartDate('');
    setEndDate('');
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <RoomsModuleNav />

        <PageHeader
          title="Histórico de Checklists"
          description="Visualize e acompanhe os checklists preenchidos"
          actions={
            <>
              <Button variant="outline" onClick={handleExport} disabled={!filteredChecklists.length}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Período
              </Button>
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={!filteredChecklists.length || (!startDate && !endDate)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Limpar Período
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar checklists do período?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Serão excluídos {filteredChecklists.length} checklist(s) do período selecionado. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCleanup}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button asChild>
                <Link to="/rooms/checklist/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Checklist
                </Link>
              </Button>
            </>
          }
        />

        <PageToolbar className="mb-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar sala ou prédio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedRoomFilter} onValueChange={setSelectedRoomFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por sala" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as salas</SelectItem>
                {rooms?.map((room) => (
                  <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedShiftFilter} onValueChange={setSelectedShiftFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por turno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os turnos</SelectItem>
                <SelectItem value="Manhã">Manhã</SelectItem>
                <SelectItem value="Tarde">Tarde</SelectItem>
                <SelectItem value="Noite">Noite</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1" />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1" />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
              <p className="text-xs text-muted-foreground">{filteredChecklists.length} resultado(s)</p>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Limpar filtros
              </Button>
            </div>
          )}
        </PageToolbar>

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4" />
              Checklists
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ContentState loading title="Carregando checklists" description="Buscando os registros do período." />
            ) : filteredChecklists.length === 0 ? (
              <ContentState
                icon={ClipboardCheck}
                title="Nenhum checklist encontrado"
                description={searchQuery ? 'Ajuste a pesquisa ou os filtros.' : 'Os próximos checklists preenchidos aparecerão aqui.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sala</TableHead>
                      <TableHead>Campus</TableHead>
                      <TableHead>Prédio</TableHead>
                      <TableHead>Turno</TableHead>
                      <TableHead>Preenchido por</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChecklists.map((checklist) => (
                      <ChecklistRow
                        key={checklist.id}
                        checklist={checklist}
                        onViewDetails={() => setSelectedChecklist(checklist.id)}
                        formatDate={formatDate}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedChecklist} onOpenChange={() => setSelectedChecklist(null)}>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Detalhes do Checklist
              </DialogTitle>
            </DialogHeader>
            {loadingDetail ? (
              <ContentState loading title="Carregando detalhes" className="min-h-[120px]" />
            ) : checklistDetail && (
              <div className="space-y-6">
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Sala</p>
                        <p className="font-semibold">{checklistDetail.room?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Campus / Prédio</p>
                        <p className="font-medium">{checklistDetail.room?.campus} - {checklistDetail.room?.building}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Preenchido por</p>
                        <p className="font-medium">{profileName || 'Carregando...'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Turno</p>
                        <Badge variant="outline">{checklistDetail.shift}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 md:col-span-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Data/Hora do preenchimento</p>
                        <p className="font-medium">{formatDate(checklistDetail.filled_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {Object.entries(groupedAnswers || {}).map(([category, categoryAnswers]) => (
                  <div key={category} className="rounded-lg border border-border/60 p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">{category}</h4>
                    <div className="space-y-3">
                      {categoryAnswers?.map((answer) => {
                        const parseNotes = (notes: string | null) => {
                          if (!notes) return null;
                          const motivoMatch = notes.match(/Motivo:\s*([^|]+)/);
                          const tratativaMatch = notes.match(/Tratativa:\s*(.+)/);
                          return {
                            motivo: motivoMatch ? motivoMatch[1].trim() : null,
                            tratativa: tratativaMatch ? tratativaMatch[1].trim() : null,
                          };
                        };
                        const parsedNotes = parseNotes(answer.notes);

                        return (
                          <div key={answer.id} className="flex flex-col gap-2 border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
                            <div className="flex items-start justify-between gap-4">
                              <span className="text-sm">{answer.question?.question}</span>
                              <Badge variant={answer.answer ? 'default' : 'destructive'} className="shrink-0">
                                {answer.answer ? <><Check className="mr-1 h-3 w-3" /> OK</> : <><X className="mr-1 h-3 w-3" /> Pendente</>}
                              </Badge>
                            </div>
                            {!answer.answer && parsedNotes && (
                              <div className="space-y-1 rounded-md bg-destructive/10 p-2">
                                {parsedNotes.motivo && (
                                  <div className="text-xs">
                                    <span className="font-medium text-destructive">Motivo: </span>
                                    <span className="text-muted-foreground">{parsedNotes.motivo}</span>
                                  </div>
                                )}
                                {parsedNotes.tratativa && (
                                  <div className="text-xs">
                                    <span className="font-medium text-primary">Tratativa: </span>
                                    <span className="text-muted-foreground">{parsedNotes.tratativa}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {parsedObservations.customItems && Object.keys(parsedObservations.customItems).length > 0 && (
                  <div className="rounded-lg border border-border/60 p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">Itens Personalizados da Sala</h4>
                    <div className="space-y-3">
                      {Object.entries(parsedObservations.customItems).map(([itemId, itemData]: [string, any]) => (
                        <div key={itemId} className="flex flex-col gap-2 border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-sm">{itemData.label}</span>
                            <Badge variant={itemData.answer ? 'default' : 'destructive'} className="shrink-0">
                              {itemData.answer ? <><Check className="mr-1 h-3 w-3" /> OK</> : <><X className="mr-1 h-3 w-3" /> Pendente</>}
                            </Badge>
                          </div>
                          {!itemData.answer && itemData.notes && (
                            <div className="rounded-md bg-destructive/10 p-2 text-xs">
                              <span className="font-medium text-destructive">Observação: </span>
                              <span className="text-muted-foreground">{itemData.notes}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parsedObservations.generalObservations && (
                  <div className="rounded-lg border border-border/60 p-4">
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
                      <MessageSquare className="h-4 w-4" />
                      Observações Gerais
                    </h4>
                    <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{parsedObservations.generalObservations}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

function ChecklistRow({
  checklist,
  onViewDetails,
  formatDate,
}: {
  checklist: RoomChecklist;
  onViewDetails: () => void;
  formatDate: (date: string) => string;
}) {
  const { data: profileName, isLoading } = useProfileName(checklist.filled_by);

  return (
    <TableRow>
      <TableCell className="font-medium">{checklist.room?.name}</TableCell>
      <TableCell>{checklist.room?.campus}</TableCell>
      <TableCell>{checklist.room?.building}</TableCell>
      <TableCell><Badge variant="outline">{checklist.shift}</Badge></TableCell>
      <TableCell>{isLoading ? '...' : profileName || 'N/A'}</TableCell>
      <TableCell>{formatDate(checklist.filled_at)}</TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" onClick={onViewDetails}>
          <Eye className="mr-1 h-4 w-4" />
          Ver Detalhes
        </Button>
      </TableCell>
    </TableRow>
  );
}
