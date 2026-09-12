import { ClipboardCopy, ExternalLink, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PsV2PublicLinks({ eventId }: { eventId?: string }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.vegsystem.site';
  const links = [
    { label: 'Presença pública', path: `/ps/presenca/${eventId}`, detail: 'Fluxo público de presença já existente para este evento.' },
    { label: 'Avaliação', path: `/ps/avaliacao/${eventId}`, detail: 'Página pública de avaliação vinculada ao evento.' },
    { label: 'Autoavaliação', path: `/ps/autoavaliacao/${eventId}`, detail: 'Página pública de autoavaliação vinculada ao evento.' },
  ].map((item) => ({ ...item, url: `${origin}${item.path}` }));

  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copiado.'); }
    catch { toast.error('Não foi possível copiar o link.'); }
  };

  return <Card className="rounded-2xl border-border/60 bg-card/70">
    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4 text-primary" />Links públicos</CardTitle><CardDescription>Atalhos existentes do evento. Copiar ou abrir não altera dados.</CardDescription></CardHeader>
    <CardContent className="space-y-3">{links.map((item) => <div key={item.label} className="rounded-xl border border-border/60 p-3"><p className="text-sm font-semibold">{item.label}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.detail}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => void copy(item.url)}><ClipboardCopy className="mr-2 h-3.5 w-3.5" />Copiar</Button><Button asChild size="sm" variant="ghost"><a href={item.url} target="_blank" rel="noreferrer">Abrir <ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button></div></div>)}<p className="text-[11px] leading-relaxed text-muted-foreground">O link de confirmação é individual e contém token próprio; ele continua sendo gerenciado pelo fluxo oficial de comunicação.</p></CardContent>
  </Card>;
}
