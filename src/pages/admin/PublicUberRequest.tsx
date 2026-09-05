import { Car } from 'lucide-react';

import { UberRequestForm } from '@/components/uber/UberRequestForm';

export default function PublicUberRequest() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-7 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />

      <div className="relative mx-auto max-w-3xl space-y-5">
        <header className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Car className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Solicitação de viagem Uber</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Informe os dados da viagem para registrar sua solicitação de transporte corporativo.
            </p>
          </div>
        </header>

        <UberRequestForm />

        <p className="pb-3 text-center text-[11px] text-muted-foreground">
          Confira os dados antes de finalizar. Um comprovante será gerado ao concluir o envio.
        </p>
      </div>
    </div>
  );
}
