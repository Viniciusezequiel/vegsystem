import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { UserPlus, Shield, Eye, Edit2, Loader2, Trash2, BarChart3, KeyRound, Settings2, History, Search } from 'lucide-react';
import { UserActivityDialog } from '@/components/users/UserActivityDialog';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useUsersList, useUpdateUserProfile, useToggleUserActive, useDeleteUser, UserProfile, AppRole } from '@/hooks/useUsers';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const roleLabels: Record<AppRole, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: 'Administrador', icon: Shield, color: 'text-destructive' },
  supervisor: { label: 'Supervisor', icon: Shield, color: 'text-warning' },
  analista: { label: 'Analista', icon: BarChart3, color: 'text-primary' },
  assistente: { label: 'Assistente', icon: Eye, color: 'text-muted-foreground' },
  visualizador: { label: 'Visualizador', icon: Eye, color: 'text-muted-foreground' },
};

export default function Users() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [activityUser, setActivityUser] = useState<UserProfile | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserProfile | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [forcePasswordChange, setForcePasswordChange] = useState(true);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states for new user
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('assistente');

  // Form states for edit user
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<AppRole>('assistente');

  const { data: users, isLoading } = useUsersList();
  const updateProfile = useUpdateUserProfile();
  const toggleActive = useToggleUserActive();
  const deleteUser = useDeleteUser();
  const { user: currentUser } = useAuth();

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    
    try {
      // Validate the session with the server (getUser makes a server call, unlike getSession which uses cache)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        // Session is invalid on server, try to refresh
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          // Clear the invalid local session
          await supabase.auth.signOut();
          toast.error('Sua sessão expirou. Por favor, faça login novamente.');
          window.location.href = '/auth';
          return;
        }
      }

      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: newEmail,
          password: newPassword,
          full_name: newName,
          position: newPosition,
          department: newDepartment,
          role: newRole,
        },
      });

      // Check if there's an error in response.error OR in response.data.error
      const hasError = response.error || response.data?.error;
      
      if (hasError) {
        const errorMessage = response.error?.message || response.data?.error || 'Erro desconhecido';
        // Check for authentication errors
        if (errorMessage.includes('Invalid token') || errorMessage.includes('401')) {
          toast.error('Sua sessão expirou. Por favor, faça login novamente.');
          window.location.href = '/auth';
          return;
        }
        throw new Error(errorMessage);
      }
      
      toast.success('Usuário criado com sucesso!');
      setIsDialogOpen(false);
      resetNewUserForm();
      // Refresh the users list
      window.location.reload();
    } catch (error: any) {
      const errorMessage = error?.message || error?.error || 'Erro ao criar usuário';
      if (errorMessage.includes('Invalid token') || errorMessage.includes('session')) {
        toast.error('Sua sessão expirou. Por favor, faça login novamente.');
        window.location.href = '/auth';
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const resetNewUserForm = () => {
    setNewEmail('');
    setNewPassword('');
    setNewName('');
    setNewPosition('');
    setNewDepartment('');
    setNewRole('assistente');
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.full_name);
    setEditPosition(user.position);
    setEditDepartment(user.department);
    setEditRole(user.role || 'assistente');
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    await updateProfile.mutateAsync({
      id: editingUser.id,
      full_name: editName,
      position: editPosition,
      department: editDepartment,
      role: editRole,
    });
    setIsEditDialogOpen(false);
    setEditingUser(null);
  };

  const handleToggleActive = (user: UserProfile) => {
    toggleActive.mutate({ id: user.id, is_active: !user.is_active });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPasswordValue) return;

    setIsResettingPassword(true);
    try {
      const response = await supabase.functions.invoke('reset-password', {
        body: {
          user_id: resetPasswordUser.user_id,
          new_password: newPasswordValue,
          force_password_change: forcePasswordChange,
        },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.error?.message || response.data?.error);
      }

      toast.success(forcePasswordChange 
        ? 'Senha redefinida! O usuário precisará trocar a senha no próximo login.' 
        : 'Senha redefinida com sucesso!');
      setIsResetPasswordDialogOpen(false);
      setResetPasswordUser(null);
      setNewPasswordValue('');
      setForcePasswordChange(true);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao redefinir senha');
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="page-header flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Gerenciar Usuários</h1>
          <p className="page-subtitle">Adicione e gerencie os usuários do sistema</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <PdfExportButton
            title="Relatório de Usuários"
            filename="usuarios"
            columns={[
              { header: 'Nome', accessor: 'full_name' },
              { header: 'Cargo', accessor: (row) => row.position || '-' },
              { header: 'Setor', accessor: (row) => row.department || '-' },
              { header: 'Permissão', accessor: (row) => roleLabels[row.role as AppRole]?.label || 'Assistente' },
              { header: 'Status', accessor: (row) => row.is_active ? 'Ativo' : 'Inativo' },
            ]}
            data={users || []}
            filters={[
              {
                label: 'Permissão',
                key: 'role',
                options: [
                  { label: 'Administrador', value: 'admin' },
                  { label: 'Supervisor', value: 'supervisor' },
                  { label: 'Analista', value: 'analista' },
                  { label: 'Assistente', value: 'assistente' },
                ],
              },
              {
                label: 'Status',
                key: 'is_active',
                options: [
                  { label: 'Ativo', value: 'true' },
                  { label: 'Inativo', value: 'false' },
                ],
              },
            ]}
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-initial">
                <UserPlus className="w-4 h-4 mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha as informações para criar um novo usuário.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <Input 
                  id="name" 
                  placeholder="Nome do usuário" 
                  className="mt-1.5" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="email@empresa.com" 
                  className="mt-1.5"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Senha *</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Senha do usuário" 
                  className="mt-1.5"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="position">Cargo</Label>
                  <Input 
                    id="position" 
                    placeholder="Ex: Analista" 
                    className="mt-1.5"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="department">Setor</Label>
                  <Input 
                    id="department" 
                    placeholder="Ex: TI" 
                    className="mt-1.5"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="role">Nível de Permissão *</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador - Acesso total</SelectItem>
                    <SelectItem value="supervisor">Supervisor - Gerenciar e aprovar</SelectItem>
                    <SelectItem value="analista">Analista - Editar, criar e apagar</SelectItem>
                    <SelectItem value="assistente">Assistente - Criar e visualizar</SelectItem>
                    <SelectItem value="visualizador">Visualizador - Somente leitura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {isCreating ? 'Criando...' : 'Criar Usuário'}
                </Button>
              </div>
            </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Permission Levels Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold">Níveis de Permissão</h2>
        <Link to="/permissions">
          <Button variant="outline" className="gap-2">
            <Settings2 className="w-4 h-4" />
            Gerenciar Permissões
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {Object.entries(roleLabels).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <div key={key} className="p-4 rounded-xl bg-card border border-border animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Icon className={cn('w-5 h-5', config.color)} />
                <h3 className="font-medium">{config.label}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {key === 'admin' && 'Acesso total ao sistema, incluindo gerenciar usuários, permissões e configurações'}
                {key === 'supervisor' && 'Supervisiona equipes e processos - pode aprovar e gerenciar conforme permissões'}
                {key === 'analista' && 'Acesso configurável por módulo - pode criar, editar e aprovar, sem acesso a exclusão'}
                {key === 'assistente' && 'Acesso limitado configurável - principalmente visualização e criação básica'}
                {key === 'visualizador' && 'Somente leitura - pode visualizar informações de módulos específicos'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Users List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou setor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 sm:px-6 py-4 text-sm font-medium text-muted-foreground">Usuário</th>
                <th className="text-left px-4 sm:px-6 py-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">Email</th>
                <th className="text-left px-4 sm:px-6 py-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Cargo</th>
                <th className="text-left px-4 sm:px-6 py-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Setor</th>
                <th className="text-left px-4 sm:px-6 py-4 text-sm font-medium text-muted-foreground">Permissão</th>
                <th className="text-left px-4 sm:px-6 py-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">Ativo</th>
                <th className="text-right px-4 sm:px-6 py-4 text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.filter(user => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  user.full_name.toLowerCase().includes(q) ||
                  (user.email?.toLowerCase().includes(q)) ||
                  (user.department?.toLowerCase().includes(q)) ||
                  (user.position?.toLowerCase().includes(q))
                );
              }).map((user, index) => {
                const roleConfig = roleLabels[user.role || 'assistente'];
                const RoleIcon = roleConfig.icon;
                
                return (
                  <tr 
                    key={user.id} 
                    className={cn(
                      "hover:bg-muted/30 transition-colors animate-fade-in",
                      !user.is_active && "opacity-60"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                          <AvatarImage src={user.avatar_url || ''} alt={user.full_name} />
                          <AvatarFallback className="text-xs">
                            {user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <span className="font-medium block truncate">{user.full_name}</span>
                          <span className="text-xs text-muted-foreground block md:hidden">{user.email || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-muted-foreground hidden lg:table-cell">
                      <span className="truncate block max-w-[200px]">{user.email || '-'}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-muted-foreground hidden md:table-cell">
                      {user.position || '-'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-muted-foreground hidden md:table-cell">
                      {user.department || '-'}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-2">
                        <RoleIcon className={cn('w-4 h-4', roleConfig.color)} />
                        <span className="hidden sm:inline">{roleConfig.label}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                      <Switch
                        checked={user.is_active}
                        onCheckedChange={() => handleToggleActive(user)}
                      />
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setActivityUser(user);
                            setIsActivityDialogOpen(true);
                          }}
                          title="Ver Atividades"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setResetPasswordUser(user);
                            setIsResetPasswordDialogOpen(true);
                          }}
                          title="Redefinir Senha"
                        >
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        {user.user_id !== currentUser?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação irá excluir permanentemente o usuário <strong>{user.full_name}</strong> e todos os seus dados. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser.mutate(user.user_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as informações do usuário.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-name">Nome completo *</Label>
              <Input 
                id="edit-name" 
                placeholder="Nome do usuário" 
                className="mt-1.5" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-position">Cargo</Label>
                <Input 
                  id="edit-position" 
                  placeholder="Ex: Analista" 
                  className="mt-1.5"
                  value={editPosition}
                  onChange={(e) => setEditPosition(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-department">Setor</Label>
                <Input 
                  id="edit-department" 
                  placeholder="Ex: TI" 
                  className="mt-1.5"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-role">Nível de Permissão *</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione o nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador - Acesso total</SelectItem>
                  <SelectItem value="supervisor">Supervisor - Gerenciar e aprovar</SelectItem>
                  <SelectItem value="analista">Analista - Editar, criar e apagar</SelectItem>
                  <SelectItem value="assistente">Assistente - Criar e visualizar</SelectItem>
                  <SelectItem value="visualizador">Visualizador - Somente leitura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {updateProfile.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para <strong>{resetPasswordUser?.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="new-password">Nova Senha *</Label>
              <Input 
                id="new-password" 
                type="password"
                placeholder="Mínimo 8 caracteres" 
                className="mt-1.5" 
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="force-password-change"
                checked={forcePasswordChange}
                onCheckedChange={setForcePasswordChange}
              />
              <Label htmlFor="force-password-change" className="text-sm cursor-pointer">
                Solicitar troca de senha no próximo login
              </Label>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => {
                setIsResetPasswordDialogOpen(false);
                setResetPasswordUser(null);
                setNewPasswordValue('');
                setForcePasswordChange(true);
              }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isResettingPassword}>
                {isResettingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isResettingPassword ? 'Redefinindo...' : 'Redefinir Senha'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Activity Dialog */}
      {activityUser && (
        <UserActivityDialog
          open={isActivityDialogOpen}
          onOpenChange={(open) => {
            setIsActivityDialogOpen(open);
            if (!open) setActivityUser(null);
          }}
          userId={activityUser.user_id}
          userName={activityUser.full_name}
        />
      )}
    </MainLayout>
  );
}
