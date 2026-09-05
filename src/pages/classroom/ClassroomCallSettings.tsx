import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentState } from '@/components/layout/ContentState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit2, Building2, AlertTriangle, MessageSquare, ChevronRight, Search, X } from 'lucide-react';
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

const CAMPUSES = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

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
    setBulkIssueRoomIds(prev =>
      prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]
    );
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

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch = !roomSearch || room.name.toLowerCase().includes(roomSearch.toLowerCase());
      const matchesCampus = campusFilter === 'all' || room.campus === campusFilter;
      return matchesSearch && matchesCampus;
    });
  }, [rooms, roomSearch, campusFilter]);

  const hasRoomFilters = roomSearch || campusFilter !== 'all';

  return (
    <MainLayout>
      <div className="space-y-5">
        <ClassroomCallsModuleNav />

        <PageHeader
          title="Configurações de Chamados"
          description="Gerencie salas, problemas e respostas pré-definidas"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-border/60 bg-card/65 p-1 sm:w-fit sm:min-w-[320px]">
            <TabsTrigger value="rooms" className="gap-2">
              <Building2 className="h-4 w-4" />
              Salas
            </TabsTrigger>
            <TabsTrigger value="responses" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Respostas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rooms" className="mt-0 space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="border-border/60 bg-card/65">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Salas Cadastradas</CardTitle>
                  <CardDescription>Salas que aparecem no formulário externo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
                    <Input
                      placeholder="Nome da sala..."
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
                    />
                    <Select value={newRoomCampus} onValueChange={setNewRoomCampus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddRoom} disabled={!newRoomName.trim() || createRoom.isPending}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar sala..."
                        value={roomSearch}
                        onChange={(e) => setRoomSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={campusFilter} onValueChange={setCampusFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os campus</SelectItem>
                        {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {hasRoomFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setRoomSearch(''); setCampusFilter('all'); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {filteredRooms.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-border/60">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sala</TableHead>
                            <TableHead>Campus</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[120px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRooms.map((room) => (
                            <TableRow
                              key={room.id}
                              className={`cursor-pointer ${selectedRoomId === room.id ? 'bg-primary/[0.06]' : ''}`}
                              onClick={() => setSelectedRoomId(room.id)}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {room.name}
                                  {selectedRoomId === room.id && <ChevronRight className="h-3 w-3 text-primary" />}
                                </div>
                              </TableCell>
                              <TableCell><Badge variant="outline">{room.campus}</Badge></TableCell>
                              <TableCell>
                                <Switch
                                  checked={room.is_active}
                                  onCheckedChange={(checked) => updateRoom.mutate({ id: room.id, is_active: checked })}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditDialog({ type: 'room', id: room.id, value: room.name, campus: room.campus });
                                    }}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="icon" variant="ghost" className="text-destructive" onClick={(e) => e.stopPropagation()}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir sala?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Todos os problemas vinculados serão removidos. Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
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
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <ContentState
                      icon={Building2}
                      title={rooms.length > 0 ? 'Nenhuma sala encontrada' : 'Nenhuma sala cadastrada'}
                      description={rooms.length > 0 ? 'Ajuste a busca ou o filtro de campus.' : 'Cadastre uma sala para disponibilizá-la no formulário externo.'}
                      className="min-h-[150px]"
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/65">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" />
                    Problemas da Sala
                  </CardTitle>
                  <CardDescription>
                    {selectedRoom
                      ? `Problemas vinculados a "${selectedRoom.name}"`
                      : 'Selecione uma sala para gerenciar seus problemas'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedRoomId ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Descreva o problema..."
                            value={newIssueDesc}
                            onChange={(e) => setNewIssueDesc(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddIssue()}
                            className="flex-1"
                          />
                          <Button onClick={handleAddIssue} disabled={!newIssueDesc.trim() || createIssue.isPending}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        {newIssueDesc.trim() && (
                          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                            <p className="text-xs font-medium text-muted-foreground">Adicionar também em outras salas:</p>
                            <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto">
                              {rooms.filter(r => r.id !== selectedRoomId).map((room) => (
                                <div
                                  key={room.id}
                                  className="flex cursor-pointer items-center gap-2 rounded p-1 text-sm hover:bg-muted/50"
                                  onClick={() => toggleBulkRoom(room.id)}
                                >
                                  <Checkbox
                                    checked={bulkIssueRoomIds.includes(room.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleBulkRoom(room.id)}
                                  />
                                  <span>{room.name}</span>
                                  <Badge variant="outline" className="ml-auto text-xs">{room.campus}</Badge>
                                </div>
                              ))}
                            </div>
                            {bulkIssueRoomIds.length > 0 && (
                              <p className="text-xs text-primary">Será adicionado em {bulkIssueRoomIds.length + 1} sala(s), incluindo a atual.</p>
                            )}
                          </div>
                        )}
                      </div>

                      {issues.length > 0 ? (
                        <div className="space-y-2">
                          {issues.map((issue) => (
                            <div key={issue.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <Switch
                                  checked={issue.is_active}
                                  onCheckedChange={(checked) => updateIssue.mutate({ id: issue.id, is_active: checked })}
                                />
                                <span className={`truncate ${!issue.is_active ? 'text-muted-foreground line-through' : ''}`}>
                                  {issue.description}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditDialog({ type: 'issue', id: issue.id, value: issue.description })}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteIssue.mutate(issue.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ContentState
                          icon={AlertTriangle}
                          title="Nenhum problema cadastrado"
                          description="Os problemas cadastrados aparecem como opções no formulário externo."
                          className="min-h-[150px]"
                        />
                      )}
                    </>
                  ) : (
                    <ContentState
                      icon={ChevronRight}
                      title="Selecione uma sala"
                      description="Escolha uma sala ao lado para configurar seus tipos de problema."
                      className="min-h-[180px]"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="responses" className="mt-0">
            <Card className="border-border/60 bg-card/65">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Respostas Pré-definidas</CardTitle>
                <CardDescription>
                  Mensagens rápidas que o colaborador pode enviar ao aceitar um chamado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: Estou a caminho, aguarde 5 minutos..."
                    value={newResponseMsg}
                    onChange={(e) => setNewResponseMsg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddResponse()}
                    className="flex-1"
                  />
                  <Button onClick={handleAddResponse} disabled={!newResponseMsg.trim() || createResponse.isPending}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>

                {responses.length > 0 ? (
                  <div className="space-y-2">
                    {responses.map((resp) => (
                      <div key={resp.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Switch
                            checked={resp.is_active}
                            onCheckedChange={(checked) => updateResponse.mutate({ id: resp.id, is_active: checked })}
                          />
                          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className={`truncate ${!resp.is_active ? 'text-muted-foreground line-through' : ''}`}>
                            {resp.message}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditDialog({ type: 'response', id: resp.id, value: resp.message })}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteResponse.mutate(resp.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ContentState
                    icon={MessageSquare}
                    title="Nenhuma resposta cadastrada"
                    description="Adicione mensagens rápidas como “Estou a caminho” ou “Aguarde 5 minutos”."
                    className="min-h-[160px]"
                  />
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
              <Input
                value={editDialog?.value || ''}
                onChange={(e) => setEditDialog(prev => prev ? { ...prev, value: e.target.value } : null)}
              />
            </div>
            {editDialog?.type === 'room' && (
              <div className="space-y-2">
                <Label>Campus</Label>
                <Select
                  value={editDialog.campus || 'Campus I'}
                  onValueChange={(v) => setEditDialog(prev => prev ? { ...prev, campus: v } : null)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
