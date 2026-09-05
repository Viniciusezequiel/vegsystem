import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentState } from '@/components/layout/ContentState';

const EmbeddedShell = ({ children }: { children?: import('react').ReactNode }) => <>{children}</>;

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Eye, Shield, ShieldCheck, ShieldX } from 'lucide-react';
import {
  useRolePermissions,
  useUpdatePermission,
  MODULE_LABELS,
  ACTION_LABELS,
  ROLE_LABELS,
  type Module,
  type Action,
  type AppRole,
} from '@/hooks/usePermissions';

const MODULES: Module[] = [
  'lostAndFound',
  'equipment',
  'reservations',
  'lockers',
  'rooms',
  'materials',
  'users',
  'settings',
  'classroomCalls',
  'tasks',
  'activityHistory',
];

const ACTIONS: Action[] = ['view', 'create', 'edit', 'delete', 'approve'];
const ROLES: AppRole[] = ['admin', 'supervisor', 'analista', 'assistente', 'visualizador'];

export default function Permissions({ embedded }: { embedded?: boolean } = {}) {
  const Shell = embedded ? EmbeddedShell : MainLayout;
  const { data: permissions, isLoading } = useRolePermissions();
  const updatePermission = useUpdatePermission();
  const [selectedRole, setSelectedRole] = useState<AppRole>('analista');

  const permissionsByRole = useMemo(() => {
    if (!permissions) return {};

    const grouped: Record<AppRole, Record<string, Record<string, { id: string; allowed: boolean }>>> = {
      admin: {},
      supervisor: {},
      analista: {},
      assistente: {},
      visualizador: {},
      atendente: {},
    };

    permissions.forEach(p => {
      if (!grouped[p.role as AppRole][p.module]) grouped[p.role as AppRole][p.module] = {};
      grouped[p.role as AppRole][p.module][p.action] = {
        id: p.id,
        allowed: p.allowed,
      };
    });

    return grouped;
  }, [permissions]);

  const handleToggle = (id: string, currentValue: boolean) => {
    updatePermission.mutate({ id, allowed: !currentValue });
  };

  const getPermissionStats = (role: AppRole) => {
    if (!permissions) return { allowed: 0, total: 0 };
    const rolePerms = permissions.filter(p => p.role === role);
    return {
      allowed: rolePerms.filter(p => p.allowed).length,
      total: rolePerms.length,
    };
  };

  if (isLoading) {
    return (
      <Shell>
        <ContentState
          loading
          title="Carregando permissões"
          description="Preparando a matriz de acesso por perfil."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-5">
        {!embedded && (
          <PageHeader
            title="Matriz de Permissões"
            description="Configure permissões específicas para cada perfil de usuário"
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {ROLES.map(role => {
            const stats = getPermissionStats(role);
            const percentage = stats.total > 0 ? Math.round((stats.allowed / stats.total) * 100) : 0;
            const Icon = role === 'admin'
              ? ShieldCheck
              : role === 'visualizador'
                ? Eye
                : role === 'assistente'
                  ? ShieldX
                  : Shield;

            return (
              <Card
                key={role}
                className={`cursor-pointer border-border/60 bg-card/65 transition-all hover:border-primary/25 hover:bg-card/80 ${
                  selectedRole === role ? 'ring-1 ring-primary/60' : ''
                }`}
                onClick={() => setSelectedRole(role)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selectedRole === role ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{ROLE_LABELS[role]}</p>
                        <p className="text-xs text-muted-foreground">{stats.allowed}/{stats.total} ativas</p>
                      </div>
                    </div>
                    <Badge variant={role === 'admin' ? 'default' : 'secondary'}>{percentage}%</Badge>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Permissões — {ROLE_LABELS[selectedRole]}</CardTitle>
            <CardDescription>
              {selectedRole === 'admin'
                ? 'Administradores têm acesso total ao sistema'
                : `Configure as permissões específicas para ${ROLE_LABELS[selectedRole].toLowerCase()}s`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="matrix" className="w-full space-y-4">
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-border/60 bg-muted/30 p-1 sm:w-[320px]">
                <TabsTrigger value="matrix">Matriz</TabsTrigger>
                <TabsTrigger value="modules">Por Módulo</TabsTrigger>
              </TabsList>

              <TabsContent value="matrix" className="mt-0">
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border-b border-border/60 bg-muted/40 p-3 text-left font-medium">Módulo</th>
                        {ACTIONS.map(action => (
                          <th key={action} className="border-b border-border/60 bg-muted/40 p-3 text-center font-medium">
                            {ACTION_LABELS[action]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map(module => (
                        <tr key={module} className="transition-colors hover:bg-muted/20">
                          <td className="border-b border-border/50 p-3 font-medium">{MODULE_LABELS[module]}</td>
                          {ACTIONS.map(action => {
                            const perm = permissionsByRole[selectedRole]?.[module]?.[action];
                            if (!perm) return <td key={action} className="border-b border-border/50 p-3 text-center text-muted-foreground">—</td>;

                            return (
                              <td key={action} className="border-b border-border/50 p-3 text-center">
                                <Switch
                                  checked={perm.allowed}
                                  onCheckedChange={() => handleToggle(perm.id, perm.allowed)}
                                  disabled={selectedRole === 'admin' || updatePermission.isPending}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedRole === 'admin' && (
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    As permissões de administradores não podem ser alteradas.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="modules" className="mt-0">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {MODULES.map(module => (
                    <Card key={module} className="border-border/60 bg-card/70">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{MODULE_LABELS[module]}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {ACTIONS.map(action => {
                          const perm = permissionsByRole[selectedRole]?.[module]?.[action];
                          if (!perm) return null;

                          return (
                            <div key={action} className="flex items-center justify-between gap-3">
                              <span className="text-sm">{ACTION_LABELS[action]}</span>
                              <Switch
                                checked={perm.allowed}
                                onCheckedChange={() => handleToggle(perm.id, perm.allowed)}
                                disabled={selectedRole === 'admin' || updatePermission.isPending}
                              />
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
