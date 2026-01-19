import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { ArrowLeft, ClipboardCheck, Eye, Check, X, Plus, Search, User, Calendar, Building2, Clock, MessageSquare } from 'lucide-react';
import { useRoomChecklists, useChecklistWithAnswers, useRoomsList, RoomChecklist } from '@/hooks/useRooms';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

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
  const [searchQuery, setSearchQuery] = useState('');
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

  // Filter checklists by search query (room name)
  const filteredChecklists = useMemo(() => {
    if (!checklists) return [];
    if (!searchQuery.trim()) return checklists;
    
    const query = searchQuery.toLowerCase();
    return checklists.filter((checklist) => 
      checklist.room?.name?.toLowerCase().includes(query) ||
      checklist.room?.building?.toLowerCase().includes(query)
    );
  }, [checklists, searchQuery]);

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
          <Button asChild>
            <Link to="/rooms/checklist/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo Checklist
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Checklists
                </CardTitle>
                <Select value={selectedRoomFilter} onValueChange={setSelectedRoomFilter}>
                  <SelectTrigger className="w-[200px]">
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
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nome ou número da sala..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 max-w-md"
                />
              </div>
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
