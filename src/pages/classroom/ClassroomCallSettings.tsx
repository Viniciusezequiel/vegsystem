import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ContentState } from '@/components/layout/ContentState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Trash2,
  Edit2,
  Building2,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
  Search,
  X,
  Layers3,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useClassroomCallRooms,
  useCreateClassroomCallRoom,
  useUpdateClassroomCallRoom,
  useDeleteClassroomCallRoom,
  useClassroomCallRoomIssues,
  useCreateClassroomCallRoomIssue,
  useDeleteClassroomCallRoomIssue,
  useUpdateClassroomCallRoomIssue,
  useClassroomCallResponses,
  useCreateClassroomCallResponse,
  useDeleteClassroomCallResponse,
  useUpdateClassroomCallResponse,
} from '@/hooks/useClassroomCallSettings';
import { ClassroomCallsModuleNav } from '@/components/classroom/ClassroomCallsModuleNav';
import { cn } from '@/lib/utils';

const CAMPUSES = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  helper: string;
  tone: 'violet' | 'blue' | 'emerald';
}) {
  const tones = {
    violet: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  };

  return (
    <Card className="rounded-2xl border-border/45 bg-card/65 shadow-[0_18px_45px_-36px_rgba(124,58,237,.7)] backdrop-blur-xl">
      <CardContent className="flex items-center gap-3.5 p-4">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs font-semibold">{label}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClassroomCallSettings() {
  const [activeTab, setActiveTab] = useState('rooms');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCampus, setNewRoomCampus] = useState('Campus I');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [newIssueDesc, setNewIssueDesc] = useState('');
  const [bulkIssueRoomIds, setBulkIssueRoomIds] = useState<string[]>([]);
  const [roomSearch, setRoomSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState<string>('all');
  const [newResponseMsg, setNewResponseMsg] = useState('');
  const [editDialog, setEditDialog] = useState<{ type: 'room' | 'issue' | 'response'; id: string; value: string; campus?: string } | null>(null);

  const { data: rooms = [] } = useClassroomCallRooms();
  const { data: issues = [] } = useClassroomCallRoomIssues(selectedRoomId || undefined);
  const { data: responses = [] } = useClassroomCallResponses();

  const createRoom = useCreateClassroomCallRoom();
  const updateRoom = useUpdateClassroomCallRoom();
  const deleteRoom = useDeleteClassroomCallRoom();
  const createIssue = useCreateClassroomCallRoomIssue();
  const deleteIssue = useDeleteClassroomCallRoomIssue();
  const updateIssue = useUpdateClassroomCallRoomIssue();
  const createResponse = useCreateClassroomCallResponse();
  const deleteResponse = useDeleteClassroomCallResponse();
  const updateResponse = useUpdateClassroomCallResponse();

  const handleAddRoom = () => {
    if (!newRoomName.trim()) return;
    createRoom.mutate({ name: newRoomName.trim(), campus: newRoomCampus });
    setNewRoomName('');
  };

  const handleAddIssue = async () => {
    if (!newIssueDesc.trim()) return;
    const targetRoomIds = bulkIssueRoomIds.length > 0
      ? [...new Set([selectedRoomId!, ...bulkIssueRoomIds])]
      : (selectedRoomId ? [selectedRoomId] : []);
    if (targetRoomIds.length === 0) return;
    for (const roomId of targetRoomIds) {
      await createIssue.mutateAsync({ room_id: roomId, description: newIssueDesc.trim() });
    }
    setNewIssueDesc('');
    setBulkIssueRoomIds([]);
  };

  const toggleBulkRoom = (roomId: string) => {
    setBulkIssueRoomIds((previous) => previous.includes(roomId) ? previous.filter((id) => id !== roomId) : [...previous, roomId]);
  };

  const handleAddResponse = () => {
    if (!newResponseMsg.trim()) return;
    createResponse.mutate({ message: newResponseMsg.trim() });
    setNewResponseMsg('');
  };

  const handleEditSave = () => {
    if (!editDialog) return;
    if (editDialog.type === 'room') {
      updateRoom.mutate({ id: editDialog.id, name: editDialog.value, campus: editDialog.campus });
    } else if (editDialog.type === 'issue') {
      updateIssue.mutate({ id: editDialog.id, description: editDialog.value });
    } else {
      updateResponse.mutate({ id: editDialog.id, message: editDialog.value });
    }
    setEditDialog(null);
  };

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch = !roomSearch || room.name.toLowerCase().includes(roomSearch.toLowerCase());
      const matchesCampus = campusFilter === 'all' || room.campus === campusFilter;
      return matchesSearch && matchesCampus;
    });
  }, [rooms, roomSearch, campusFilter]);

  const hasRoomFilters = roomSearch || campusFilter !== 'all';
  const activeRooms = rooms.filter((room) => room.is_active).length;
  const activeResponses = responses.filter((response) => response.is_active).length;
  const activeIssues = issues.filter((issue) => issue.is_active).length;

  return (
    <MainLayout>
      <div className="space-y-4 pb-2">
        <ClassroomCallsModuleNav />

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard icon={Building2} label="Salas ativas" value={activeRooms} helper={`${rooms.length} sala(s) cadastrada(s)`} tone="blue" />
          <SummaryCard icon={AlertTriangle} label="Problemas ativos" value={activeIssues} helper={selectedRoom ? `Sala: ${selectedRoom.name}` : 'Selecione uma sala'} tone="violet" />
          <SummaryCard icon={MessageSquare} label="Respostas rápidas" value={activeResponses} helper={`${responses.length} resposta(s) cadastrada(s)`} tone="emerald" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border border-border/45 bg-card/55 p-1 sm:w-fit sm:min-w-[340px]">
            <TabsTrigger value="rooms" className="gap-2 rounded-xl data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <Building2 className="h-4 w-4" />
              Salas e problemas
            </TabsTrigger>
            <TabsTrigger value="responses" className="gap-2 rounded-xl data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <MessageSquare className="h-4 w-4" />
              Respostas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rooms" className="mt-0">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
              <Card className="overflow-hidden rounded-2xl border-border/45 bg-card/65 shadow-[0_22px_55px_-42px_rgba(124,58,237,.75)] backdrop-blur-xl">
                <CardHeader className="border-b border-border/35 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="h-4 w-4 text-primary" />
                        Salas cadastradas
                      </CardTitle>
                      <CardDescription className="mt-1">Salas disponíveis no formulário externo de chamados.</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">{filteredRooms.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="rounded-xl border border-primary/15 bg-gradient-to-r from-primary/[0.07] to-transparent p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/80">Nova sala</p>
                    <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
                      <Input
                        placeholder="Nome da sala..."
                        value={newRoomName}
                        onChange={(event) => setNewRoomName(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && handleAddRoom()}
                      />
                      <Select value={newRoomCampus} onValueChange={setNewRoomCampus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CAMPUSES.map((campus) => <SelectItem key={campus} value={campus}>{campus}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAddRoom} disabled={!newRoomName.trim() || createRoom.isPending} className="gap-2">
                        <Plus className="h-4 w-4" />
                        <span className="sm:hidden">Adicionar</span>
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Buscar sala..." value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} className="pl-9" />
                    </div>
                    <Select value={campusFilter} onValueChange={setCampusFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os campus</SelectItem>
                        {CAMPUSES.map((campus) => <SelectItem key={campus} value={campus}>{campus}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {hasRoomFilters && (
                      <Button variant="ghost" size="icon" onClick={() => { setRoomSearch(''); setCampusFilter('all'); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {filteredRooms.length > 0 ? (
                    <div className="space-y-2">
                      {filteredRooms.map((room) => {
                        const selected = selectedRoomId === room.id;
                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => setSelectedRoomId(room.id)}
                            className={cn(
                              'group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                              selected
                                ? 'border-primary/35 bg-primary/[0.07] shadow-[0_10px_35px_-28px_rgba(124,58,237,.8)]'
                                : 'border-border/40 bg-background/20 hover:border-primary/20 hover:bg-primary/[0.035]'
                            )}
                          >
                            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', selected ? 'border-primary/25 bg-primary/10 text-primary' : 'border-border/45 bg-background/35 text-muted-foreground')}>
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold">{room.name}</p>
                                <Badge variant="outline" className="shrink-0 border-border/50 bg-background/25 text-[9px]">{room.campus}</Badge>
                              </div>
                              <p className="mt-1 text-[10px] text-muted-foreground">{room.is_active ? 'Disponível no formulário externo' : 'Sala desativada'}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                              <Switch checked={room.is_active} onCheckedChange={(checked) => updateRoom.mutate({ id: room.id, is_active: checked })} />
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditDialog({ type: 'room', id: room.id, value: room.name, campus: room.campus })}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir sala?</AlertDialogTitle>
                                    <AlertDialogDescription>Todos os problemas vinculados serão removidos. Esta ação não pode ser desfeita.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => {
                                        if (selectedRoomId === room.id) setSelectedRoomId(null);
                                        deleteRoom.mutate(room.id);
                                      }}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <ChevronRight className={cn('h-4 w-4 transition', selected ? 'text-primary' : 'text-muted-foreground group-hover:text-primary')} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <ContentState
                      icon={Building2}
                      title={rooms.length > 0 ? 'Nenhuma sala encontrada' : 'Nenhuma sala cadastrada'}
                      description={rooms.length > 0 ? 'Ajuste a busca ou o filtro de campus.' : 'Cadastre uma sala para disponibilizá-la no formulário externo.'}
                      className="min-h-[160px]"
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-2xl border-border/45 bg-gradient-to-b from-card/75 to-card/55 shadow-[0_22px_55px_-42px_rgba(124,58,237,.7)] backdrop-blur-xl">
                <CardHeader className="border-b border-border/35 pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Problemas da sala
                  </CardTitle>
                  <CardDescription>
                    {selectedRoom ? `Configurações de “${selectedRoom.name}”.` : 'Selecione uma sala para gerenciar seus problemas.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 sm:p-5">
                  {selectedRoomId ? (
                    <>
                      <div className="rounded-xl border border-primary/15 bg-primary/[0.045] p-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Descreva o problema..."
                            value={newIssueDesc}
                            onChange={(event) => setNewIssueDesc(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && handleAddIssue()}
                            className="flex-1"
                          />
                          <Button onClick={handleAddIssue} disabled={!newIssueDesc.trim() || createIssue.isPending}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        {newIssueDesc.trim() && (
                          <div className="mt-3 space-y-2 rounded-lg border border-border/40 bg-background/25 p-3">
                            <p className="text-xs font-medium text-muted-foreground">Adicionar também em outras salas</p>
                            <div className="grid max-h-40 gap-1.5 overflow-y-auto">
                              {rooms.filter((room) => room.id !== selectedRoomId).map((room) => (
                                <div key={room.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-primary/[0.04]" onClick={() => toggleBulkRoom(room.id)}>
                                  <Checkbox checked={bulkIssueRoomIds.includes(room.id)} onClick={(event) => event.stopPropagation()} onCheckedChange={() => toggleBulkRoom(room.id)} />
                                  <span className="truncate">{room.name}</span>
                                  <Badge variant="outline" className="ml-auto text-[9px]">{room.campus}</Badge>
                                </div>
                              ))}
                            </div>
                            {bulkIssueRoomIds.length > 0 && <p className="text-xs text-primary">Será adicionado em {bulkIssueRoomIds.length + 1} sala(s), incluindo a atual.</p>}
                          </div>
                        )}
                      </div>

                      {issues.length > 0 ? (
                        <div className="space-y-2">
                          {issues.map((issue) => (
                            <div key={issue.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/20 p-3 transition hover:border-primary/20">
                              <div className="flex min-w-0 items-center gap-3">
                                <Switch checked={issue.is_active} onCheckedChange={(checked) => updateIssue.mutate({ id: issue.id, is_active: checked })} />
                                <div className="min-w-0">
                                  <span className={cn('block truncate text-sm font-medium', !issue.is_active && 'text-muted-foreground line-through')}>{issue.description}</span>
                                  <span className="text-[10px] text-muted-foreground">{issue.is_active ? 'Disponível no formulário' : 'Problema desativado'}</span>
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditDialog({ type: 'issue', id: issue.id, value: issue.description })}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteIssue.mutate(issue.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ContentState icon={AlertTriangle} title="Nenhum problema cadastrado" description="Os problemas cadastrados aparecem como opções no formulário externo." className="min-h-[170px]" />
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/40 bg-background/15 px-6 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.06] text-primary">
                        <Layers3 className="h-5 w-5" />
                      </div>
                      <p className="mt-4 text-sm font-semibold">Selecione uma sala</p>
                      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Escolha uma sala à esquerda para configurar os tipos de problema que poderão ser informados pelos professores.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="responses" className="mt-0">
            <Card className="overflow-hidden rounded-2xl border-border/45 bg-card/65 shadow-[0_22px_55px_-42px_rgba(124,58,237,.75)] backdrop-blur-xl">
              <CardHeader className="border-b border-border/35 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Respostas pré-definidas
                    </CardTitle>
                    <CardDescription className="mt-1">Mensagens rápidas disponíveis ao aceitar um chamado.</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">{responses.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="rounded-xl border border-primary/15 bg-gradient-to-r from-primary/[0.07] to-transparent p-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      placeholder="Ex: Estou a caminho, aguarde 5 minutos..."
                      value={newResponseMsg}
                      onChange={(event) => setNewResponseMsg(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && handleAddResponse()}
                      className="flex-1"
                    />
                    <Button onClick={handleAddResponse} disabled={!newResponseMsg.trim() || createResponse.isPending}>
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar resposta
                    </Button>
                  </div>
                </div>

                {responses.length > 0 ? (
                  <div className="grid gap-2 lg:grid-cols-2">
                    {responses.map((response) => (
                      <div key={response.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/20 p-3 transition hover:border-primary/20 hover:bg-primary/[0.03]">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', response.is_active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-border/40 bg-background/30 text-muted-foreground')}>
                            {response.is_active ? <CheckCircle2 className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className={cn('line-clamp-2 text-sm font-medium', !response.is_active && 'text-muted-foreground line-through')}>{response.message}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{response.is_active ? 'Ativa' : 'Desativada'}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Switch checked={response.is_active} onCheckedChange={(checked) => updateResponse.mutate({ id: response.id, is_active: checked })} />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditDialog({ type: 'response', id: response.id, value: response.message })}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteResponse.mutate(response.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ContentState icon={MessageSquare} title="Nenhuma resposta cadastrada" description="Adicione mensagens rápidas como “Estou a caminho” ou “Aguarde 5 minutos”." className="min-h-[180px]" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editDialog?.type === 'room' ? 'Editar Sala' : editDialog?.type === 'issue' ? 'Editar Problema' : 'Editar Resposta'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{editDialog?.type === 'room' ? 'Nome da sala' : editDialog?.type === 'issue' ? 'Descrição do problema' : 'Mensagem'}</Label>
              <Input value={editDialog?.value || ''} onChange={(event) => setEditDialog((previous) => previous ? { ...previous, value: event.target.value } : null)} />
            </div>
            {editDialog?.type === 'room' && (
              <div className="space-y-2">
                <Label>Campus</Label>
                <Select value={editDialog.campus || 'Campus I'} onValueChange={(value) => setEditDialog((previous) => previous ? { ...previous, campus: value } : null)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPUSES.map((campus) => <SelectItem key={campus} value={campus}>{campus}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancelar</Button>
            <Button onClick={handleEditSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
