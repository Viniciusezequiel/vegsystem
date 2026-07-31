import { Car } from 'lucide-react';
import { UberRequestForm } from '@/components/uber/UberRequestForm';

export default function PublicUberRequest() {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Car className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Solicitação de Viagem Uber</h1>
            <p className="text-sm text-muted-foreground">
              Preencha o formulário para registrar sua solicitação de transporte.
            </p>
          </div>
        </header>
        <UberRequestForm />
      </div>
    </div>
  );
}
