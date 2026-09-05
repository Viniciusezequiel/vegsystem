import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Home, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 to-transparent" />

      <Card className="relative w-full max-w-md border-border/60 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
        <CardContent className="p-7 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
            <SearchX className="h-5 w-5" />
          </div>
          <p className="mt-5 font-mono text-xs font-semibold tracking-[0.2em] text-primary">ERRO 404</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Página não encontrada</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            O endereço <span className="font-mono text-xs text-foreground">{location.pathname}</span> não corresponde a uma página disponível no VEG System.
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button asChild>
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Ir ao início
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default NotFound;
