import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { ArrowLeft, ClipboardCheck, Eye, Check, X, Plus } from 'lucide-react';
import { useRoomChecklists, useChecklistWithAnswers, useRoomsList, RoomChecklist } from '@/hooks/useRooms';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ChecklistHistory() {
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null);
  
  const { data: rooms } = useRoomsList();
  const { data: checklists, isLoading } = useRoomChecklists(
    selectedRoomFilter === 'all' ? undefined : selectedRoomFilter
  );
  const { data: checklistDetail, isLoading: loadingDetail } = useChecklistWithAnswers(selectedChecklist || '');

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const groupedAnswers = checklistDetail?.answers?.reduce((acc, a) => {
    const category = a.question?.category || 'Geral';
    if (!acc[category]) acc[category] = [];
    acc[category].push(a);
    return acc;
  }, {} as Record<string, typeof checklistDetail.answers>);

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
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : checklists?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum checklist encontrado
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
                    {checklists?.map((checklist) => (
                      <TableRow key={checklist.id}>
                        <TableCell className="font-medium">{checklist.room?.name}</TableCell>
                        <TableCell>{checklist.room?.campus}</TableCell>
                        <TableCell>{checklist.room?.building}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{checklist.shift}</Badge>
                        </TableCell>
                        <TableCell>{checklist.profile?.full_name || 'N/A'}</TableCell>
                        <TableCell>{formatDate(checklist.filled_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedChecklist(checklist.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedChecklist} onOpenChange={() => setSelectedChecklist(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Checklist</DialogTitle>
            </DialogHeader>
            {loadingDetail ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : checklistDetail && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Sala:</span>
                    <span className="ml-2 font-medium">{checklistDetail.room?.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Campus:</span>
                    <span className="ml-2 font-medium">{checklistDetail.room?.campus}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Turno:</span>
                    <span className="ml-2 font-medium">{checklistDetail.shift}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Preenchido por:</span>
                    <span className="ml-2 font-medium">{checklistDetail.profile?.full_name}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Data/Hora:</span>
                    <span className="ml-2 font-medium">{formatDate(checklistDetail.filled_at)}</span>
                  </div>
                </div>

                {Object.entries(groupedAnswers || {}).map(([category, categoryAnswers]) => (
                  <div key={category}>
                    <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">
                      {category}
                    </h4>
                    <div className="space-y-3">
                      {categoryAnswers?.map((answer) => {
                        // Parse notes to extract Motivo and Tratativa
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
                          <div key={answer.id} className="flex flex-col gap-2 pb-3 border-b">
                            <div className="flex items-start justify-between gap-4">
                              <span className="text-sm">{answer.question?.question}</span>
                              <Badge variant={answer.answer ? 'default' : 'destructive'}>
                                {answer.answer ? (
                                  <><Check className="h-3 w-3 mr-1" /> Verificado</>
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

                {checklistDetail.observations && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase">
                      Observações Gerais
                    </h4>
                    <p className="text-sm bg-muted p-3 rounded-md">
                      {checklistDetail.observations}
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
