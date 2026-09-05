import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { UberRequestForm } from '@/components/uber/UberRequestForm';

export default function UberNewRequest() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Nova solicitação de Uber"
          description="Registre os dados da viagem e gere o comprovante da solicitação."
          actions={
            <Button variant="outline" size="sm" asChild className="print:hidden">
              <Link to="/admin-module/uber">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
          }
        />
        <UberRequestForm />
      </div>
    </MainLayout>
  );
}
