import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, Shield, Users as UsersIcon } from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import Permissions from '@/pages/Permissions';
import Settings from '@/pages/Settings';
import Users from '@/pages/Users';

const VALID = ['configuracoes', 'usuarios', 'permissoes'];

export default function SystemAdmin() {
  const [params, setParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const tab = VALID.includes(params.get('tab') || '') ? (params.get('tab') as string) : 'configuracoes';

  return (
    <MainLayout>
      <PageHeader
        title="Administração do Sistema"
        description="Configurações, usuários e permissões reunidos em uma única área administrativa."
      />

      <Tabs value={tab} onValueChange={value => setParams({ tab: value })} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-xl border border-border/60 bg-muted/25 p-1 sm:w-fit sm:grid-cols-3">
          <TabsTrigger value="configuracoes" className="min-w-[150px]">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Configurações
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="usuarios" className="min-w-[130px]">
              <UsersIcon className="mr-2 h-4 w-4" />
              Usuários
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="permissoes" className="min-w-[145px]">
              <Shield className="mr-2 h-4 w-4" />
              Permissões
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="configuracoes" className="mt-0">
          <Settings embedded />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="usuarios" className="mt-0">
            <Users embedded />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="permissoes" className="mt-0">
            <Permissions embedded />
          </TabsContent>
        )}
      </Tabs>
    </MainLayout>
  );
}
