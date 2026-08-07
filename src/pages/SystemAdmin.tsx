import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Users as UsersIcon, Shield } from 'lucide-react';
import Settings from '@/pages/Settings';
import Users from '@/pages/Users';
import Permissions from '@/pages/Permissions';
import { useAuth } from '@/contexts/AuthContext';

const VALID = ['configuracoes', 'usuarios', 'permissoes'];

export default function SystemAdmin() {
  const [params, setParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const tab = VALID.includes(params.get('tab') || '') ? (params.get('tab') as string) : 'configuracoes';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Administração do Sistema</h1>
          <p className="text-muted-foreground">
            Configurações, usuários e permissões reunidos em um único módulo.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="configuracoes">
              <SettingsIcon className="mr-2 h-4 w-4" /> Configurações
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="usuarios">
                <UsersIcon className="mr-2 h-4 w-4" /> Usuários
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="permissoes">
                <Shield className="mr-2 h-4 w-4" /> Permissões
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="configuracoes" className="pt-4">
            <Settings embedded />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="usuarios" className="pt-4">
              <Users embedded />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="permissoes" className="pt-4">
              <Permissions embedded />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
