import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle, Smartphone, Monitor, Tablet } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Download className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Instalar VEG System</CardTitle>
          <CardDescription>
            Instale o app no seu dispositivo para acesso rápido e notificações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isInstalled ? (
            <div className="text-center space-y-3">
              <CheckCircle className="h-16 w-16 text-primary mx-auto" />
              <p className="text-lg font-semibold text-primary">
                App já instalado!
              </p>
              <p className="text-sm text-muted-foreground">
                O VEG System está na sua tela inicial.
              </p>
            </div>
          ) : deferredPrompt ? (
            <div className="text-center space-y-4">
              <Button size="lg" onClick={handleInstall} className="w-full gap-2">
                <Download className="h-5 w-5" />
                Instalar Agora
              </Button>
              <p className="text-xs text-muted-foreground">
                O app será adicionado à sua tela inicial.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Para instalar, siga as instruções do seu dispositivo:
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Tablet className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">iPad / iPhone (Safari)</p>
                    <p className="text-xs text-muted-foreground">
                      Toque no ícone de compartilhar (↑) → "Adicionar à Tela de Início"
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Smartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Android (Chrome)</p>
                    <p className="text-xs text-muted-foreground">
                      Toque no menu (⋮) → "Instalar aplicativo" ou "Adicionar à tela inicial"
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Monitor className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Desktop (Chrome/Edge)</p>
                    <p className="text-xs text-muted-foreground">
                      Clique no ícone de instalação na barra de endereço
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
