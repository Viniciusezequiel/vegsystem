import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, ShieldCheck, ShieldX } from 'lucide-react';
import { 
  useRolePermissions, 
  useUpdatePermission,
  MODULE_LABELS,
  ACTION_LABELS,
  ROLE_LABELS,
  type Module,
  type Action,
  type AppRole
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
];

const ACTIONS: Action[] = ['view', 'create', 'edit', 'delete', 'approve'];
const ROLES: AppRole[] = ['admin', 'analista', 'assistente'];

export default function Permissions() {
  const { data: permissions, isLoading } = useRolePermissions();
  const updatePermission = useUpdatePermission();
  const [selectedRole, setSelectedRole] = useState<AppRole>('analista');

  const permissionsByRole = useMemo(() => {
    if (!permissions) return {};
    
    const grouped: Record<AppRole, Record<string, Record<string, { id: string; allowed: boolean }>>> = {
      admin: {},
      analista: {},
      assistente: {},
    };

    permissions.forEach(p => {
      if (!grouped[p.role as AppRole][p.module]) {
        grouped[p.role as AppRole][p.module] = {};
      }
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
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Matriz de Permissões</h1>
          <p className="text-muted-foreground mt-2">
            Configure permissões específicas para cada perfil de usuário
          </p>
        </div>

        {/* Role Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {ROLES.map(role => {
            const stats = getPermissionStats(role);
            const percentage = stats.total > 0 ? Math.round((stats.allowed / stats.total) * 100) : 0;
            
            return (
              <Card 
                key={role} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedRole === role ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedRole(role)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {role === 'admin' && <ShieldCheck className="h-5 w-5 text-green-500" />}
                      {role === 'analista' && <Shield className="h-5 w-5 text-blue-500" />}
                      {role === 'assistente' && <ShieldX className="h-5 w-5 text-orange-500" />}
                      {ROLE_LABELS[role]}
                    </CardTitle>
                    <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
                      {percentage}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {stats.allowed} de {stats.total} permissões ativas
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        role === 'admin' ? 'bg-green-500' : 
                        role === 'analista' ? 'bg-blue-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Permissions Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Permissões - {ROLE_LABELS[selectedRole]}</CardTitle>
            <CardDescription>
              {selectedRole === 'admin' 
                ? 'Administradores têm acesso total ao sistema'
                : `Configure as permissões específicas para ${ROLE_LABELS[selectedRole].toLowerCase()}s`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="matrix" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="matrix">Matriz</TabsTrigger>
                <TabsTrigger value="modules">Por Módulo</TabsTrigger>
              </TabsList>

              <TabsContent value="matrix" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left p-3 border-b bg-muted/50 font-medium">
                          Módulo
                        </th>
                        {ACTIONS.map(action => (
                          <th key={action} className="text-center p-3 border-b bg-muted/50 font-medium">
                            {ACTION_LABELS[action]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map(module => (
                        <tr key={module} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 border-b font-medium">
                            {MODULE_LABELS[module]}
                          </td>
                          {ACTIONS.map(action => {
                            const perm = permissionsByRole[selectedRole]?.[module]?.[action];
                            if (!perm) return <td key={action} className="p-3 border-b text-center">-</td>;
                            
                            return (
                              <td key={action} className="p-3 border-b text-center">
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
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    As permissões de administradores não podem ser alteradas
                  </p>
                )}
              </TabsContent>

              <TabsContent value="modules" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {MODULES.map(module => (
                    <Card key={module}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{MODULE_LABELS[module]}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {ACTIONS.map(action => {
                          const perm = permissionsByRole[selectedRole]?.[module]?.[action];
                          if (!perm) return null;
                          
                          return (
                            <div key={action} className="flex items-center justify-between">
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
    </MainLayout>
  );
}
