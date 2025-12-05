import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { mockUsers } from '@/data/mockData';
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
import { UserPlus, Shield, Eye, Edit2, Trash2 } from 'lucide-react';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils';

const roleLabels: Record<UserRole, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: 'Administrador', icon: Shield, color: 'text-destructive' },
  collaborator: { label: 'Colaborador', icon: Edit2, color: 'text-primary' },
  viewer: { label: 'Visualizador', icon: Eye, color: 'text-muted-foreground' },
};

export default function Users() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <MainLayout>
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Gerenciar Usuários</h1>
          <p className="page-subtitle">Adicione e gerencie os usuários do sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha as informações para criar um novo usuário.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <Input id="name" placeholder="Nome do usuário" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" placeholder="email@empresa.com" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="role">Nível de Permissão *</Label>
                <Select>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador - Acesso total</SelectItem>
                    <SelectItem value="collaborator">Colaborador - Cadastrar e dar baixa</SelectItem>
                    <SelectItem value="viewer">Visualizador - Apenas consultar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Criar Usuário</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Permission Levels Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {Object.entries(roleLabels).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <div key={key} className="p-4 rounded-xl bg-card border border-border animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Icon className={cn('w-5 h-5', config.color)} />
                <h3 className="font-medium">{config.label}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {key === 'admin' && 'Acesso total ao sistema, incluindo gerenciar usuários'}
                {key === 'collaborator' && 'Pode registrar itens e dar baixa nas entregas'}
                {key === 'viewer' && 'Apenas visualiza e busca itens cadastrados'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Users List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Usuário</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Email</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Permissão</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mockUsers.map((user, index) => {
              const roleConfig = roleLabels[user.role];
              const RoleIcon = roleConfig.icon;
              
              return (
                <tr 
                  key={user.id} 
                  className="hover:bg-muted/30 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <RoleIcon className={cn('w-4 h-4', roleConfig.color)} />
                      <span>{roleConfig.label}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MainLayout>
  );
}
