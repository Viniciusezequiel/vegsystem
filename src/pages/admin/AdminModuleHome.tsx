import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, ShieldCheck, ArrowRight } from 'lucide-react';

const modules = [
  {
    name: 'Uber Corporativo',
    description: 'Controle de viagens: solicitações, comprovantes, histórico e relatórios.',
    href: '/admin-module/uber',
    icon: Car,
  },
];

export default function AdminModuleHome() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Módulo Administrativo</h1>
            <p className="text-muted-foreground">Área restrita a administradores.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((m) => (
            <Link key={m.href} to={m.href}>
              <Card className="h-full rounded-2xl transition-all hover:-translate-y-1 hover:shadow-lg">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <m.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="flex items-center justify-between">
                    {m.name} <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription>{m.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
