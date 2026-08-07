import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, ShieldCheck, ArrowRight, GraduationCap, Tag, BarChart3 } from 'lucide-react';

const modules = [
  {
    name: 'Uber Corporativo',
    description: 'Solicitações, comprovantes, histórico e indicadores em uma única tela.',
    href: '/admin-module/uber',
    icon: Car,
  },
  {
    name: 'Processo Seletivo',
    description: 'Eventos, colaboradores, avaliações, presenças e banco de fiscais.',
    href: '/admin-module/processo-seletivo',
    icon: GraduationCap,
  },
  {
    name: 'Etiquetas',
    description: 'Modelos de etiquetas, editor visual e geração em PDF via planilha.',
    href: '/labels',
    icon: Tag,
  },
  {
    name: 'Relatórios',
    description: 'Indicadores e exportações consolidadas dos módulos do sistema.',
    href: '/reports',
    icon: BarChart3,
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
