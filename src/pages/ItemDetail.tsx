import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { mockItems, currentUser } from '@/data/mockData';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  User, 
  Phone, 
  Clock,
  PackageCheck,
  Mail,
  Building2,
  Archive,
  Package,
  Tag,
  CalendarCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const handleSignatureChange = useCallback((sig: string | null) => {
    setSignature(sig);
  }, []);

  const item = mockItems.find(i => i.id === id);

  if (!item) {
    return (
      <MainLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">Item não encontrado</h2>
          <Button onClick={() => navigate('/items')} className="mt-4">
            Voltar para lista
          </Button>
        </div>
      </MainLayout>
    );
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signature) {
      toast({
        title: "Assinatura obrigatória",
        description: "Por favor, solicite a assinatura do proprietário.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Baixa registrada com sucesso!",
      description: `Item ${item.code} marcado como entregue.`,
    });
    
    setIsSubmitting(false);
    setIsDialogOpen(false);
    setSignature(null);
    navigate('/items');
  };

  return (
    <MainLayout>
      <button
        onClick={() => navigate('/items')}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para lista
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Image and Status */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-in">
            <div className="aspect-square">
              <img
                src={item.imageUrl}
                alt={item.description}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-muted-foreground">{item.code}</span>
                <StatusBadge status={item.status} />
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="form-section animate-fade-in" style={{ animationDelay: '100ms' }}>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {item.description}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Campus</p>
                  <p className="font-medium">{item.campus}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Local encontrado</p>
                  <p className="font-medium">{item.foundLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Data encontrado</p>
                  <p className="font-medium">
                    {format(new Date(item.foundDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarCheck className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Data recebido</p>
                  <p className="font-medium">
                    {format(new Date(item.receivedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>

            {/* Storage Info */}
            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Armazenamento</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <Archive className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Prateleira</p>
                    <p className="font-medium">{item.shelf}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Caixa</p>
                    <p className="font-medium">{item.box}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Tag className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Nº Lacre</p>
                    <p className="font-medium">{item.sealNumber}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Person Info */}
            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Quem entregou o item</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{item.deliveredByName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Contato</p>
                    <p className="font-medium">{item.deliveredByContact}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Registration Info */}
            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Registro no Sistema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Data/Hora do registro</p>
                    <p className="font-medium">
                      {format(new Date(item.registeredAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Responsável pelo recebimento</p>
                    <p className="font-medium">{item.registeredBy}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Info (if delivered) */}
          {item.status === 'delivered' && item.ownerName && (
            <div className="form-section animate-fade-in bg-muted/50" style={{ animationDelay: '200ms' }}>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-success" />
                Informações da Entrega
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome do proprietário</p>
                  <p className="font-medium">{item.ownerName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{item.ownerEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{item.ownerPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data da entrega</p>
                  <p className="font-medium">
                    {format(new Date(item.deliveredAt!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entregue por (equipe)</p>
                  <p className="font-medium">{item.deliveredByTeamMember}</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {item.status === 'available' && (
            <div className="flex gap-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg">
                    <PackageCheck className="w-5 h-5 mr-2" />
                    Dar Baixa / Entregar
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Registrar Entrega</DialogTitle>
                    <DialogDescription>
                      Preencha as informações do proprietário para dar baixa no item.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCheckout} className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="ownerName">Nome completo do proprietário *</Label>
                      <Input id="ownerName" placeholder="Nome completo" className="mt-1.5" required />
                    </div>
                    <div>
                      <Label htmlFor="ownerEmail">Email *</Label>
                      <Input id="ownerEmail" type="email" placeholder="email@exemplo.com" className="mt-1.5" required />
                    </div>
                    <div>
                      <Label htmlFor="ownerPhone">Telefone *</Label>
                      <Input id="ownerPhone" placeholder="(11) 99999-9999" className="mt-1.5" required />
                    </div>
                    <div>
                      <Label htmlFor="teamMember">Membro da equipe entregando</Label>
                      <Input id="teamMember" value={currentUser.name} readOnly className="mt-1.5 bg-muted" />
                    </div>
                    <div>
                      <Label>Assinatura do proprietário *</Label>
                      <div className="mt-1.5">
                        <SignaturePad onSignatureChange={handleSignatureChange} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Registrando...' : 'Confirmar Entrega'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
