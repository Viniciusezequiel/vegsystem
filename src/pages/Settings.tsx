import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemSettings, useUpdateSystemSettings, SystemSettings, ModuleSettings } from '@/hooks/useSystemSettings';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Database, 
  Package, 
  Box, 
  Calendar, 
  MapPin,
  ClipboardCheck,
  FileText,
  Users,
  Eye,
  Loader2
} from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';

const moduleLabels: Record<string, { name: string; icon: React.ReactNode; description: string }> = {
  lostItems: { name: 'Achados e Perdidos', icon: <Package className="w-5 h-5" />, description: 'Gerenciamento de itens perdidos e encontrados' },
  equipment: { name: 'Patrimônios', icon: <Box className="w-5 h-5" />, description: 'Controle de equipamentos e empréstimos' },
  lockers: { name: 'Escaninhos', icon: <Box className="w-5 h-5" />, description: 'Gestão de escaninhos e empréstimos' },
  rooms: { name: 'Salas', icon: <MapPin className="w-5 h-5" />, description: 'Cadastro de salas para checklist' },
  checklists: { name: 'Checklists', icon: <ClipboardCheck className="w-5 h-5" />, description: 'Controle de checklists das salas' },
};

function ModuleSettingsCard({ 
  moduleKey, 
  settings, 
  onSettingsChange 
}: { 
  moduleKey: string; 
  settings: ModuleSettings; 
  onSettingsChange: (key: string, value: ModuleSettings) => void;
}) {
  const module = moduleLabels[moduleKey];
  
  return (
    <Card className={!settings.enabled ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {module.icon}
            </div>
            <div>
              <CardTitle className="text-base">{module.name}</CardTitle>
              <CardDescription className="text-xs">{module.description}</CardDescription>
            </div>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => onSettingsChange(moduleKey, { ...settings, enabled })}
          />
        </div>
      </CardHeader>
      {settings.enabled && (
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Colaboradores podem criar</span>
            <Switch
              checked={settings.allowCollaboratorCreate}
              onCheckedChange={(v) => onSettingsChange(moduleKey, { ...settings, allowCollaboratorCreate: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Colaboradores podem editar</span>
            <Switch
              checked={settings.allowCollaboratorEdit}
              onCheckedChange={(v) => onSettingsChange(moduleKey, { ...settings, allowCollaboratorEdit: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Colaboradores podem excluir</span>
            <Switch
              checked={settings.allowCollaboratorDelete}
              onCheckedChange={(v) => onSettingsChange(moduleKey, { ...settings, allowCollaboratorDelete: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Colaboradores podem exportar</span>
            <Switch
              checked={settings.allowCollaboratorExport}
              onCheckedChange={(v) => onSettingsChange(moduleKey, { ...settings, allowCollaboratorExport: v })}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function Settings() {
  const { isAdmin } = useAuth();
  const { data: savedSettings, isLoading } = useSystemSettings();
  const updateSettings = useUpdateSystemSettings();
  
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  
  useEffect(() => {
    if (savedSettings) {
      setSettings(savedSettings);
    }
  }, [savedSettings]);
  
  const handleModuleChange = (moduleKey: string, value: ModuleSettings) => {
    if (!settings) return;
    setSettings({
      ...settings,
      modules: {
        ...settings.modules,
        [moduleKey]: value,
      },
    });
  };
  
  const handleGeneralChange = <K extends keyof SystemSettings['general']>(
    key: K, 
    value: SystemSettings['general'][K]
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      general: {
        ...settings.general,
        [key]: value,
      },
    });
  };
  
  const handleNotificationChange = <K extends keyof SystemSettings['notifications']>(
    key: K, 
    value: SystemSettings['notifications'][K]
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: value,
      },
    });
  };
  
  const handleReportsChange = <K extends keyof SystemSettings['reports']>(
    key: K, 
    value: SystemSettings['reports'][K]
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      reports: {
        ...settings.reports,
        [key]: value,
      },
    });
  };
  
  const handleSave = () => {
    if (settings) {
      updateSettings.mutate(settings);
    }
  };
  
  if (isLoading || !settings) {
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
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <h1 className="page-title">Configurações</h1>
        </div>
        <p className="page-subtitle">Gerencie as configurações do sistema</p>
      </div>

      <Tabs defaultValue="modules" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
          <TabsTrigger value="modules" className="gap-2 py-3">
            <Database className="w-4 h-4" />
            Módulos
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2 py-3">
            <Shield className="w-4 h-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 py-3">
            <Bell className="w-4 h-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2 py-3">
            <FileText className="w-4 h-4" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        {/* Módulos */}
        <TabsContent value="modules" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-muted-foreground" />
            <p className="text-muted-foreground">Configure quais módulos estão ativos e as permissões dos colaboradores</p>
          </div>
          
          {!isAdmin ? (
            <Card className="p-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Eye className="w-5 h-5" />
                <span>Apenas administradores podem alterar as configurações de módulos.</span>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(settings.modules).map(([key, value]) => (
                <ModuleSettingsCard
                  key={key}
                  moduleKey={key}
                  settings={value}
                  onSettingsChange={handleModuleChange}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Configurações Gerais */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Achados e Perdidos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prefix">Prefixo do código dos itens</Label>
                  <Input 
                    id="prefix" 
                    value={settings.general.itemCodePrefix}
                    onChange={(e) => handleGeneralChange('itemCodePrefix', e.target.value)}
                    className="mt-1.5" 
                    disabled={!isAdmin}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Ex: AP-2024-001</p>
                </div>
                <div>
                  <Label htmlFor="retention">Tempo de retenção (dias)</Label>
                  <Input 
                    id="retention" 
                    type="number" 
                    value={settings.general.itemRetentionDays}
                    onChange={(e) => handleGeneralChange('itemRetentionDays', parseInt(e.target.value) || 90)}
                    className="mt-1.5" 
                    disabled={!isAdmin}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Itens não reclamados serão arquivados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Padrões do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Mostrar usuários online</p>
                  <p className="text-sm text-muted-foreground">Exibir indicador de colaboradores conectados</p>
                </div>
                <Switch 
                  checked={settings.general.showOnlineUsers}
                  onCheckedChange={(v) => handleGeneralChange('showOnlineUsers', v)}
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <Label>Campus padrão</Label>
                <Select 
                  value={settings.general.defaultCampus} 
                  onValueChange={(v) => handleGeneralChange('defaultCampus', v)}
                  disabled={!isAdmin}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.campus_enum.map((campus) => (
                      <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Notificações por Email
              </CardTitle>
              <CardDescription>Configure quando enviar notificações por email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Novo item cadastrado</p>
                  <p className="text-sm text-muted-foreground">Notificar quando um novo item for registrado</p>
                </div>
                <Switch 
                  checked={settings.notifications.emailOnNewItem}
                  onCheckedChange={(v) => handleNotificationChange('emailOnNewItem', v)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Item entregue</p>
                  <p className="text-sm text-muted-foreground">Notificar quando um item for entregue ao dono</p>
                </div>
                <Switch 
                  checked={settings.notifications.emailOnItemDelivered}
                  onCheckedChange={(v) => handleNotificationChange('emailOnItemDelivered', v)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Relatório semanal</p>
                  <p className="text-sm text-muted-foreground">Receber um resumo semanal por email</p>
                </div>
                <Switch 
                  checked={settings.notifications.weeklyReport}
                  onCheckedChange={(v) => handleNotificationChange('weeklyReport', v)}
                  disabled={!isAdmin}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Configurações de Relatórios
              </CardTitle>
              <CardDescription>Configure as opções padrão para exportação de relatórios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Colaboradores podem exportar</p>
                  <p className="text-sm text-muted-foreground">Permitir que colaboradores exportem relatórios PDF</p>
                </div>
                <Switch 
                  checked={settings.reports.allowCollaboratorExport}
                  onCheckedChange={(v) => handleReportsChange('allowCollaboratorExport', v)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Incluir registros excluídos</p>
                  <p className="text-sm text-muted-foreground">Mostrar registros arquivados nos relatórios</p>
                </div>
                <Switch 
                  checked={settings.reports.includeDeletedRecords}
                  onCheckedChange={(v) => handleReportsChange('includeDeletedRecords', v)}
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <Label>Período padrão dos relatórios</Label>
                <Select 
                  value={settings.reports.defaultDateRange} 
                  onValueChange={(v) => handleReportsChange('defaultDateRange', v as 'week' | 'month' | 'quarter' | 'year')}
                  disabled={!isAdmin}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Última semana</SelectItem>
                    <SelectItem value="month">Último mês</SelectItem>
                    <SelectItem value="quarter">Último trimestre</SelectItem>
                    <SelectItem value="year">Último ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isAdmin && (
        <div className="flex justify-end gap-4 mt-6 pt-6 border-t">
          <Button variant="outline" onClick={() => setSettings(savedSettings || null)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </div>
      )}
    </MainLayout>
  );
}
