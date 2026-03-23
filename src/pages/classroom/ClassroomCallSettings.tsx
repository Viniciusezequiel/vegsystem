import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
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
import { Plus, Trash2, Edit2, Building2, AlertTriangle, MessageSquare, ChevronRight, ArrowLeft, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router-dom';
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

const CAMPUSES = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

export default function ClassroomCallSettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('rooms');

  // Rooms state
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCampus, setNewRoomCampus] = useState('Campus I');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Issues state
  const [newIssueDesc, setNewIssueDesc] = useState('');
  const [bulkIssueRoomIds, setBulkIssueRoomIds] = useState<string[]>([]);

  // Responses state
  const [newResponseMsg, setNewResponseMsg] = useState('');

  // Edit dialog
  const [editDialog, setEditDialog] = useState<{ type: 'room' | 'issue' | 'response'; id: string; value: string; campus?: string } | null>(null);

  // Data hooks
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/classroom-calls')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações de Chamados</h1>
            <p className="text-muted-foreground">Gerencie salas, problemas e respostas pré-definidas</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="rooms" className="gap-2">
              <Building2 className="h-4 w-4" />
              Salas
            </TabsTrigger>
            <TabsTrigger value="responses" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Respostas
            </TabsTrigger>
          </TabsList>

          {/* ROOMS TAB */}
          <TabsContent value="rooms" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Rooms List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Salas Cadastradas</CardTitle>
                  <CardDescription>Salas que aparecem no formulário externo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Room Form */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome da sala..."
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
                      className="flex-1"
                    />
                    <Select value={newRoomCampus} onValueChange={setNewRoomCampus}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CAMPUSES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddRoom} disabled={!newRoomName.trim() || createRoom.isPending}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Rooms Table */}
                  {rooms.length > 0 ? (
                    <div className="border rounded-lg">
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
                          {rooms.map((room) => (
                            <TableRow
                              key={room.id}
                              className={`cursor-pointer ${selectedRoomId === room.id ? 'bg-primary/5' : ''}`}
                              onClick={() => setSelectedRoomId(room.id)}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {room.name}
                                  {selectedRoomId === room.id && <ChevronRight className="h-3 w-3 text-primary" />}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{room.campus}</Badge>
                              </TableCell>
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
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma sala cadastrada</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Room Issues */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
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
                      {/* Add Issue Form with multi-room option */}
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

                        {/* Multi-room selector */}
                        {newIssueDesc.trim() && (
                          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                            <p className="text-xs font-medium text-muted-foreground">
                              Adicionar também em outras salas:
                            </p>
                            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                              {rooms.filter(r => r.id !== selectedRoomId).map((room) => (
                                <div
                                  key={room.id}
                                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded p-1"
                                  onClick={() => toggleBulkRoom(room.id)}
                                >
                                  <Checkbox
                                    checked={bulkIssueRoomIds.includes(room.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleBulkRoom(room.id)}
                                  />
                                  <span>{room.name}</span>
                                  <Badge variant="outline" className="text-xs ml-auto">{room.campus}</Badge>
                                </div>
                              ))}
                            </div>
                            {bulkIssueRoomIds.length > 0 && (
                              <p className="text-xs text-primary">
                                Será adicionado em {bulkIssueRoomIds.length + 1} sala(s) (incluindo a atual)
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Issues List */}
                      {issues.length > 0 ? (
                        <div className="space-y-2">
                          {issues.map((issue) => (
                            <div key={issue.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={issue.is_active}
                                  onCheckedChange={(checked) => updateIssue.mutate({ id: issue.id, is_active: checked })}
                                />
                                <span className={!issue.is_active ? 'text-muted-foreground line-through' : ''}>
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
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => deleteIssue.mutate(issue.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhum problema cadastrado para esta sala</p>
                          <p className="text-xs mt-1">Os problemas aparecem como opções no formulário externo</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <ChevronRight className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Selecione uma sala ao lado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* RESPONSES TAB */}
          <TabsContent value="responses">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Respostas Pré-definidas</CardTitle>
                <CardDescription>
                  Mensagens que o colaborador pode enviar ao aceitar um chamado. O solicitante verá essa mensagem na tela de aguardando.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Response Form */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: Estou a caminho, aguarde 5 minutos..."
                    value={newResponseMsg}
                    onChange={(e) => setNewResponseMsg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddResponse()}
                    className="flex-1"
                  />
                  <Button onClick={handleAddResponse} disabled={!newResponseMsg.trim() || createResponse.isPending}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {/* Responses List */}
                {responses.length > 0 ? (
                  <div className="space-y-2">
                    {responses.map((resp) => (
                      <div key={resp.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={resp.is_active}
                            onCheckedChange={(checked) => updateResponse.mutate({ id: resp.id, is_active: checked })}
                          />
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className={!resp.is_active ? 'text-muted-foreground line-through' : ''}>
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
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteResponse.mutate(resp.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma resposta cadastrada</p>
                    <p className="text-xs mt-1">Adicione mensagens como "Estou a caminho" ou "Aguarde 5 minutos"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPUSES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
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
