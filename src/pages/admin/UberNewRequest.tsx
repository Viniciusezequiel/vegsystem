import { MainLayout } from '@/components/layout/MainLayout';
import { UberRequestForm } from '@/components/uber/UberRequestForm';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function UberNewRequest() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" asChild className="print:hidden">
          <Link to="/admin-module/uber">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <UberRequestForm />
      </div>
    </MainLayout>
  );
}
