import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Monitor, Smartphone, Tablet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  const devices = [
    {
      icon: Tablet,
      title: 'iPad / iPhone',
      subtitle: 'Safari',
      instruction: 'Toque em Compartilhar (↑) e escolha “Adicionar à Tela de Início”.',
    },
    {
      icon: Smartphone,
      title: 'Android',
      subtitle: 'Chrome',
      instruction: 'Abra o menu (⋮) e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.',
    },
    {
      icon: Monitor,
      title: 'Computador',
      subtitle: 'Chrome / Edge',
      instruction: 'Clique no ícone de instalação exibido na barra de endereço do navegador.',
    },
  ];

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[340px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />

      <Card className="relative w-full max-w-xl border-border/60 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {isInstalled ? <CheckCircle2 className="h-7 w-7" /> : <Download className="h-7 w-7" />}
          </div>
          <CardTitle className="pt-2 text-2xl">{isInstalled ? 'VEG System instalado' : 'Instalar VEG System'}</CardTitle>
          <CardDescription className="mx-auto max-w-md leading-relaxed">
            {isInstalled
              ? 'O aplicativo já está disponível no seu dispositivo para acesso rápido.'
              : 'Adicione o VEG System ao dispositivo para abrir como aplicativo e aproveitar a experiência PWA.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {isInstalled ? (
            <div className="rounded-xl border border-success/25 bg-success/5 px-5 py-5 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
              <p className="mt-3 text-sm font-semibold">Instalação concluída</p>
              <p className="mt-1 text-xs text-muted-foreground">Abra o VEG System pelo ícone adicionado à tela inicial ou menu de aplicativos.</p>
            </div>
          ) : deferredPrompt ? (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-5 text-center">
              <p className="text-sm font-medium">Seu navegador permite a instalação automática.</p>
              <p className="text-xs text-muted-foreground">Clique abaixo e confirme a instalação quando o navegador solicitar.</p>
              <Button size="lg" onClick={handleInstall} className="mt-2 w-full sm:w-auto">
                <Download className="mr-2 h-5 w-5" />
                Instalar aplicativo
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Como instalar neste dispositivo</p>
                <p className="mt-1 text-xs text-muted-foreground">Escolha a orientação correspondente ao seu navegador.</p>
              </div>

              <div className="grid gap-2.5">
                {devices.map(({ icon: Icon, title, subtitle, instruction }) => (
                  <div key={title} className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/15 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{title} <span className="font-normal text-muted-foreground">· {subtitle}</span></p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{instruction}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
