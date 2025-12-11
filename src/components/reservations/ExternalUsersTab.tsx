import { useState } from 'react';
import { useExternalUsers, useDeleteExternalUser, useUpdateExternalUser, ExternalUser } from '@/hooks/useExternalUsers';
import { useReservations } from '@/hooks/useReservations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Users, Mail, Phone, CreditCard, Calendar, Edit, Trash2, Eye, Loader2, Briefcase, Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// CPF mask function
const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export function ExternalUsersTab() {
  const { data: externalUsers, isLoading } = useExternalUsers();
  const deleteUser = useDeleteExternalUser();
  const updateUser = useUpdateExternalUser();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ExternalUser | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [editData, setEditData] = useState({ full_name: '', phone: '', cpf: '', user_type: 'professor' as 'professor' | 'colaborador', sector: '' });

  // Filter users
  const filteredUsers = externalUsers?.filter(user => {
    const search = searchQuery.toLowerCase();
    return (
      user.full_name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search) ||
      user.cpf.includes(searchQuery.replace(/\D/g, ''))
    );
  }) || [];

  const handleEdit = (user: ExternalUser) => {
    setSelectedUser(user);
    setEditData({
      full_name: user.full_name,
      phone: user.phone || '',
      cpf: formatCPF(user.cpf),
      user_type: user.user_type || 'professor',
      sector: user.sector || '',
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedUser) return;
    updateUser.mutate({
      id: selectedUser.id,
      full_name: editData.full_name,
      phone: editData.phone || undefined,
      cpf: editData.cpf.replace(/\D/g, ''),
      user_type: editData.user_type,
      sector: editData.user_type === 'colaborador' ? editData.sector : undefined,
    }, {
      onSuccess: () => setIsEditOpen(false),
    });
  };

  const handleDelete = (user: ExternalUser) => {
    if (confirm(`Deseja remover ${user.full_name}?`)) {
      deleteUser.mutate(user.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Usuários Externos</h2>
          <p className="text-sm text-muted-foreground">Gerencie os cadastros de solicitantes externos</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Users className="w-3 h-3" />
          {externalUsers?.length || 0} usuários
        </Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou CPF..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-secondary/50"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum usuário encontrado</h3>
          <p className="text-muted-foreground">Os usuários externos aparecem aqui após se cadastrarem no portal.</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>
                    <Badge variant={user.user_type === 'professor' ? 'secondary' : 'outline'} className="gap-1">
                      {user.user_type === 'professor' ? (
                        <><Briefcase className="w-3 h-3" />Professor</>
                      ) : (
                        <><Building2 className="w-3 h-3" />{user.sector || 'Colaborador'}</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="font-mono text-sm">{formatCPF(user.cpf)}</TableCell>
                  <TableCell>{user.phone || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsViewOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Atualize os dados do usuário externo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome Completo</Label>
              <Input
                value={editData.full_name}
                onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>CPF</Label>
              <Input
                value={editData.cpf}
                onChange={(e) => setEditData({ ...editData, cpf: formatCPF(e.target.value) })}
                maxLength={14}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={editData.phone}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Tipo de Usuário</Label>
              <Select
                value={editData.user_type}
                onValueChange={(value: 'professor' | 'colaborador') => setEditData({ ...editData, user_type: value, sector: value === 'professor' ? '' : editData.sector })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professor">Professor</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editData.user_type === 'colaborador' && (
              <div>
                <Label>Setor</Label>
                <Input
                  value={editData.sector}
                  onChange={(e) => setEditData({ ...editData, sector: e.target.value })}
                  placeholder="Nome do setor"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateUser.isPending}>
              {updateUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <ExternalUserDetailsDialog
        user={selectedUser}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
      />
    </div>
  );
}

function ExternalUserDetailsDialog({ 
  user, 
  open, 
  onOpenChange 
}: { 
  user: ExternalUser | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { data: allReservations } = useReservations();
  
  // Filter reservations for this user by email or external_user_id
  const userReservations = allReservations?.filter(
    r => user && (r.requester_email.toLowerCase() === user.email.toLowerCase())
  ) || [];

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Usuário</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* User Info */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{user.full_name}</h3>
                <p className="text-sm text-muted-foreground">Cadastrado em {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono">{formatCPF(user.cpf)}</span>
              </div>
              {user.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{user.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reservations History */}
          <div>
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Histórico de Reservas ({userReservations.length})
            </h4>
            
            {userReservations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma reserva encontrada para este usuário.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userReservations.map((reservation) => (
                  <div key={reservation.id} className="glass-card rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-foreground">{reservation.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {reservation.reservation_rooms?.name} • {format(new Date(reservation.start_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant={
                        reservation.status === 'confirmed' ? 'default' :
                        reservation.status === 'pending' ? 'secondary' :
                        reservation.status === 'cancelled' ? 'destructive' : 'outline'
                      }>
                        {reservation.status === 'confirmed' ? 'Confirmada' :
                         reservation.status === 'pending' ? 'Pendente' :
                         reservation.status === 'cancelled' ? 'Cancelada' : 'Concluída'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
