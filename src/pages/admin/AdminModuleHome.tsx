import { Link } from 'react-router-dom';
import { ArrowRight, KeyRound, ShieldCheck, Users } from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

const modules = [
  {
    name: 'Usuários e perfis',
    description: 'Cadastre usuários, mantenha perfis, roles e status de acesso.',
    href: '/settings?tab=usuarios',
    icon: Users,
  },
  {
    name: 'Roles e permissões',
    description: 'Gerencie a matriz de acesso dos perfis internos por módulo e ação.',
    href: '/settings?tab=permissoes',
    icon: KeyRound,
  },
];

export default function AdminModuleHome() {
  return (
    <MainLayout>
      <PageHeader
        title="Administração"
        description="Ferramentas centrais para usuários, perfis e regras de acesso do VegSystem."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map(module => {
          const Icon = module.icon;
          return (
            <Link key={module.href} to={module.href} className="group block">
              <Card className="h-full border-border/60 bg-card/65 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/85 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/55 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>

                  <h2 className="mt-4 text-sm font-semibold">{module.name}</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{module.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-dashed border-border/60 bg-card/35 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Área restrita</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              As opções deste módulo alteram acessos e permissões do sistema. Use-as somente quando necessário.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
