import { useState, useEffect } from 'react';
import { useExternalBookingSettings, useUpdateExternalBookingSettings, ExternalBookingSettings as Settings } from '@/hooks/useAppSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings as SettingsIcon, Copy, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ExternalBookingSettings() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: settings, isLoading } = useExternalBookingSettings();
  const updateSettings = useUpdateExternalBookingSettings();
  const { toast } = useToast();

  const [formData, setFormData] = useState<Settings>({
    blocked: false,
    blocked_until: null,
    message: '',
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const bookingUrl = `${window.location.origin}/booking`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast({
        title: 'Link copiado!',
        description: 'O link foi copiado para a área de transferência.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o link.',
        variant: 'destructive',
      });
    }
  };

  const handleSave = () => {
    updateSettings.mutate(formData, {
      onSuccess: () => setOpen(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <SettingsIcon className="w-4 h-4" />
          Configurações
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações de Reservas Externas</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Copy Link */}
            <div className="space-y-2">
              <Label>Link para Clientes Externos</Label>
              <div className="flex gap-2">
                <Input
                  value={bookingUrl}
                  readOnly
                  className="bg-secondary/50 text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Compartilhe este link para que clientes externos possam fazer reservas.
              </p>
            </div>

            {/* Block Booking */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Bloquear Reservas Externas</Label>
                  <p className="text-xs text-muted-foreground">
                    Impede novos agendamentos por clientes externos
                  </p>
                </div>
                <Switch
                  checked={formData.blocked}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, blocked: checked })
                  }
                />
              </div>

              {formData.blocked && (
                <>
                  <div>
                    <Label htmlFor="blocked_until">Bloquear até (opcional)</Label>
                    <Input
                      id="blocked_until"
                      type="date"
                      value={formData.blocked_until || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, blocked_until: e.target.value || null })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Deixe vazio para bloquear indefinidamente
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="message">Mensagem para clientes</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      placeholder="Ex: Estamos em recesso. Retornaremos em Janeiro."
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={updateSettings.isPending}
              className="w-full btn-gradient"
            >
              {updateSettings.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Configurações'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
