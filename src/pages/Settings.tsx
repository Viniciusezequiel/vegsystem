import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { currentUser } from '@/data/mockData';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Bell, Shield, Database } from 'lucide-react';

export default function Settings() {
  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Gerencie suas preferências e dados do sistema</p>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* Profile */}
        <div className="form-section animate-fade-in">
          <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Perfil
          </h3>
          
          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                <AvatarFallback className="text-lg">
                  {currentUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h4 className="font-medium text-foreground">{currentUser.name}</h4>
              <p className="text-sm text-muted-foreground capitalize">
                {currentUser.role === 'admin' ? 'Administrador' : 
                 currentUser.role === 'collaborator' ? 'Colaborador' : 'Visualizador'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" defaultValue={currentUser.name} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={currentUser.email} className="mt-1.5" />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="form-section animate-fade-in" style={{ animationDelay: '100ms' }}>
          <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notificações
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Novos itens cadastrados</p>
                <p className="text-sm text-muted-foreground">Receba notificação quando um novo item for registrado</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Itens entregues</p>
                <p className="text-sm text-muted-foreground">Receba notificação quando um item for entregue</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Relatório semanal</p>
                <p className="text-sm text-muted-foreground">Receba um resumo semanal por email</p>
              </div>
              <Switch />
            </div>
          </div>
        </div>

        {/* System */}
        <div className="form-section animate-fade-in" style={{ animationDelay: '200ms' }}>
          <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Sistema
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="prefix">Prefixo do código dos itens</Label>
              <Input id="prefix" defaultValue="AP" className="mt-1.5 max-w-[200px]" />
              <p className="text-xs text-muted-foreground mt-1">Ex: AP-2024-001</p>
            </div>
            <div>
              <Label htmlFor="retention">Tempo de retenção de itens (dias)</Label>
              <Input id="retention" type="number" defaultValue="90" className="mt-1.5 max-w-[200px]" />
              <p className="text-xs text-muted-foreground mt-1">Itens não reclamados após este período serão arquivados</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline">Cancelar</Button>
          <Button>Salvar Alterações</Button>
        </div>
      </div>
    </MainLayout>
  );
}
