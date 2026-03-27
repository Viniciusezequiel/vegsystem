import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
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
import { ArrowLeft, ClipboardCheck, Eye, Check, X, Plus, Search, User, Calendar, Building2, Clock, MessageSquare, Download, Trash2 } from 'lucide-react';
import { useRoomChecklists, useChecklistWithAnswers, useRoomsList, RoomChecklist } from '@/hooks/useRooms';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';

// Custom hook to get profile name for checklist
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

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const filteredChecklists = useMemo(() => {
    if (!checklists) return [];
    
    return checklists.filter((checklist) => {
      // Search by room name/building
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          checklist.room?.name?.toLowerCase().includes(query) ||
          checklist.room?.building?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Filter by shift
      if (selectedShiftFilter !== 'all' && checklist.shift !== selectedShiftFilter) {
        return false;
      }

      // Filter by date range
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
  
  // Parse custom items from observations
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
      // Not JSON, treat as plain text
      return { customItems: null, generalObservations: observations };
    }
    return { customItems: null, generalObservations: observations };
  };
  
  const parsedObservations = parseObservations(checklistDetail?.observations || null);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link to="/rooms">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Histórico de Checklists</h1>
              <p className="text-muted-foreground">Visualize os checklists preenchidos</p>
            </div>
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Checklists
                </CardTitle>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar sala..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedRoomFilter} onValueChange={setSelectedRoomFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por sala" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as salas</SelectItem>
                    {rooms?.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
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
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="Data início"
                    className="flex-1"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="Data fim"
                    className="flex-1"
                  />
                </div>
              </div>
              {(searchQuery || selectedRoomFilter !== 'all' || selectedShiftFilter !== 'all' || startDate || endDate) && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {filteredChecklists.length} resultado(s) encontrado(s)
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedRoomFilter('all');
                      setSelectedShiftFilter('all');
                      setStartDate('');
                      setEndDate('');
                    }}
                  >
                    Limpar filtros
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredChecklists.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Nenhum checklist encontrado para esta pesquisa' : 'Nenhum checklist encontrado'}
              </div>
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
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Detalhes do Checklist
              </DialogTitle>
            </DialogHeader>
            {loadingDetail ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : checklistDetail && (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Sala</p>
                        <p className="font-semibold">{checklistDetail.room?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Campus / Prédio</p>
                        <p className="font-medium">{checklistDetail.room?.campus} - {checklistDetail.room?.building}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Preenchido por</p>
                        <p className="font-medium">{profileName || 'Carregando...'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Turno</p>
                        <Badge variant="outline">{checklistDetail.shift}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 md:col-span-2">
                      <Calendar className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Data/Hora do preenchimento</p>
                        <p className="font-medium">{formatDate(checklistDetail.filled_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Answers by Category */}
                {Object.entries(groupedAnswers || {}).map(([category, categoryAnswers]) => (
                  <div key={category} className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-3 text-sm text-primary uppercase tracking-wide">
                      {category}
                    </h4>
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
                          <div key={answer.id} className="flex flex-col gap-2 pb-3 border-b last:border-b-0 last:pb-0">
                            <div className="flex items-start justify-between gap-4">
                              <span className="text-sm">{answer.question?.question}</span>
                              <Badge variant={answer.answer ? 'default' : 'destructive'} className="flex-shrink-0">
                                {answer.answer ? (
                                  <><Check className="h-3 w-3 mr-1" /> OK</>
                                ) : (
                                  <><X className="h-3 w-3 mr-1" /> Pendente</>
                                )}
                              </Badge>
                            </div>
                            {!answer.answer && parsedNotes && (
                              <div className="ml-0 space-y-1 bg-destructive/10 p-2 rounded-md">
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

                {/* Custom Items from Observations */}
                {parsedObservations.customItems && Object.keys(parsedObservations.customItems).length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-3 text-sm text-primary uppercase tracking-wide">
                      Itens Personalizados da Sala
                    </h4>
                    <div className="space-y-3">
                      {Object.entries(parsedObservations.customItems).map(([itemId, itemData]: [string, any]) => (
                        <div key={itemId} className="flex flex-col gap-2 pb-3 border-b last:border-b-0 last:pb-0">
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-sm">{itemData.label}</span>
                            <Badge variant={itemData.answer ? 'default' : 'destructive'} className="flex-shrink-0">
                              {itemData.answer ? (
                                <><Check className="h-3 w-3 mr-1" /> OK</>
                              ) : (
                                <><X className="h-3 w-3 mr-1" /> Pendente</>
                              )}
                            </Badge>
                          </div>
                          {!itemData.answer && itemData.notes && (
                            <div className="ml-0 space-y-1 bg-destructive/10 p-2 rounded-md">
                              <div className="text-xs">
                                <span className="font-medium text-destructive">Observação: </span>
                                <span className="text-muted-foreground">{itemData.notes}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* General Observations */}
                {parsedObservations.generalObservations && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2 text-sm text-primary uppercase tracking-wide flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Observações Gerais
                    </h4>
                    <p className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                      {parsedObservations.generalObservations}
                    </p>
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

// Separate component for checklist row to fetch profile name
function ChecklistRow({ 
  checklist, 
  onViewDetails, 
  formatDate 
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
      <TableCell>
        <Badge variant="outline">{checklist.shift}</Badge>
      </TableCell>
      <TableCell>{isLoading ? '...' : profileName || 'N/A'}</TableCell>
      <TableCell>{formatDate(checklist.filled_at)}</TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewDetails}
        >
          <Eye className="h-4 w-4 mr-1" />
          Ver Detalhes
        </Button>
      </TableCell>
    </TableRow>
  );
}
