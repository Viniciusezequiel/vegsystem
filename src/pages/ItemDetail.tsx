import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  CalendarCheck,
  Pencil,
  Loader2,
  PenLine
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useLostItem, useUpdateLostItem, useDeliverLostItem } from '@/hooks/useLostItems';
import { useAuth } from '@/contexts/AuthContext';
import { Constants } from '@/integrations/supabase/types';
import { SignaturePad } from '@/components/ui/SignaturePad';

const campusOptions = Constants.public.Enums.campus_enum;

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, profile } = useAuth();
  const { data: item, isLoading, error } = useLostItem(id);
  const updateItem = useUpdateLostItem();
  const deliverItem = useDeliverLostItem();

  const [isDeliverDialogOpen, setIsDeliverDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deliveryData, setDeliveryData] = useState({
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    owner_signature: null as string | null,
  });
  const [editData, setEditData] = useState({
    description: '',
    campus: '' as typeof campusOptions[number],
    found_location: '',
    found_date: '',
    received_date: '',
    shelf: '',
    box: '',
    seal_number: '',
    delivered_by_name: '',
    delivered_by_contact: '',
  });

  const canEdit = role === 'admin' || role === 'collaborator';

  const handleOpenEditDialog = () => {
    if (item) {
      setEditData({
        description: item.description,
        campus: item.campus,
        found_location: item.found_location,
        found_date: item.found_date,
        received_date: item.received_date,
        shelf: item.shelf || '',
        box: item.box || '',
        seal_number: item.seal_number || '',
        delivered_by_name: item.delivered_by_name,
        delivered_by_contact: item.delivered_by_contact || '',
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    updateItem.mutate(
      {
        id: item.id,
        ...editData,
        shelf: editData.shelf || null,
        box: editData.box || null,
        seal_number: editData.seal_number || null,
        delivered_by_contact: editData.delivered_by_contact || null,
      },
      {
        onSuccess: () => {
          setIsEditDialogOpen(false);
        },
      }
    );
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    
    if (!deliveryData.owner_signature) {
      toast({
        title: 'Assinatura obrigatória',
        description: 'É necessário coletar a assinatura do proprietário.',
        variant: 'destructive',
      });
      return;
    }

    deliverItem.mutate(
      {
        id: item.id,
        ...deliveryData,
      },
      {
        onSuccess: () => {
          setIsDeliverDialogOpen(false);
          setDeliveryData({ owner_name: '', owner_email: '', owner_phone: '', owner_signature: null });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (error || !item) {
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
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.description}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Package className="w-16 h-16 text-muted-foreground/50" />
                </div>
              )}
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
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {item.description}
              </h2>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={handleOpenEditDialog}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
            
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
                  <p className="font-medium">{item.found_location}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Data encontrado</p>
                  <p className="font-medium">
                    {format(new Date(item.found_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarCheck className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Data recebido</p>
                  <p className="font-medium">
                    {format(new Date(item.received_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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
                    <p className="font-medium">{item.shelf || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Caixa</p>
                    <p className="font-medium">{item.box || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Tag className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Nº Lacre</p>
                    <p className="font-medium">{item.seal_number || '-'}</p>
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
                    <p className="font-medium">{item.delivered_by_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Contato</p>
                    <p className="font-medium">{item.delivered_by_contact || '-'}</p>
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
                      {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Info (if delivered) */}
          {item.status === 'delivered' && item.owner_name && (
            <div className="form-section animate-fade-in bg-muted/50" style={{ animationDelay: '200ms' }}>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-success" />
                Informações da Entrega
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome do proprietário</p>
                  <p className="font-medium">{item.owner_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{item.owner_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{item.owner_phone}</p>
                </div>
                {item.delivered_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Data da entrega</p>
                    <p className="font-medium">
                      {format(new Date(item.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Owner Signature */}
              {item.owner_signature && (
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <PenLine className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Assinatura do Proprietário</p>
                  </div>
                  <div className="bg-white rounded-lg border border-border p-2 inline-block">
                    <img 
                      src={item.owner_signature} 
                      alt="Assinatura do proprietário" 
                      className="max-w-[300px] max-h-[150px] object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {item.status === 'available' && canEdit && (
            <div className="flex gap-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
              <Dialog open={isDeliverDialogOpen} onOpenChange={setIsDeliverDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg">
                    <PackageCheck className="w-5 h-5 mr-2" />
                    Dar Baixa / Entregar
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Registrar Entrega</DialogTitle>
                    <DialogDescription>
                      Preencha as informações do proprietário para dar baixa no item.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleDeliverySubmit} className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="ownerName">Nome completo do proprietário *</Label>
                      <Input
                        id="ownerName"
                        placeholder="Nome completo"
                        className="mt-1.5"
                        value={deliveryData.owner_name}
                        onChange={(e) => setDeliveryData({ ...deliveryData, owner_name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="ownerEmail">Email *</Label>
                      <Input
                        id="ownerEmail"
                        type="email"
                        placeholder="email@exemplo.com"
                        className="mt-1.5"
                        value={deliveryData.owner_email}
                        onChange={(e) => setDeliveryData({ ...deliveryData, owner_email: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="ownerPhone">Telefone *</Label>
                      <Input
                        id="ownerPhone"
                        placeholder="(11) 99999-9999"
                        className="mt-1.5"
                        value={deliveryData.owner_phone}
                        onChange={(e) => setDeliveryData({ ...deliveryData, owner_phone: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="teamMember">Membro da equipe entregando</Label>
                      <Input
                        id="teamMember"
                        value={profile?.full_name || ''}
                        readOnly
                        className="mt-1.5 bg-muted"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">
                        <PenLine className="w-4 h-4" />
                        Assinatura do Proprietário *
                      </Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        O proprietário deve assinar abaixo para confirmar o recebimento do item.
                      </p>
                      <SignaturePad 
                        onSignatureChange={(signature) => setDeliveryData({ ...deliveryData, owner_signature: signature })}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDeliverDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={deliverItem.isPending}>
                        {deliverItem.isPending ? 'Registrando...' : 'Confirmar Entrega'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Item</DialogTitle>
            <DialogDescription>
              Atualize as informações do item cadastrado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="editDescription">Descrição *</Label>
              <Textarea
                id="editDescription"
                placeholder="Descrição do item"
                className="mt-1.5"
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editCampus">Campus *</Label>
                <Select
                  value={editData.campus}
                  onValueChange={(value) => setEditData({ ...editData, campus: value as typeof campusOptions[number] })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o campus" />
                  </SelectTrigger>
                  <SelectContent>
                    {campusOptions.map((campus) => (
                      <SelectItem key={campus} value={campus}>
                        {campus}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="editFoundLocation">Local encontrado *</Label>
                <Input
                  id="editFoundLocation"
                  placeholder="Ex: Biblioteca, Sala 301..."
                  className="mt-1.5"
                  value={editData.found_location}
                  onChange={(e) => setEditData({ ...editData, found_location: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editFoundDate">Data encontrado *</Label>
                <Input
                  id="editFoundDate"
                  type="date"
                  className="mt-1.5"
                  value={editData.found_date}
                  onChange={(e) => setEditData({ ...editData, found_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="editReceivedDate">Data recebido *</Label>
                <Input
                  id="editReceivedDate"
                  type="date"
                  className="mt-1.5"
                  value={editData.received_date}
                  onChange={(e) => setEditData({ ...editData, received_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="editShelf">Prateleira</Label>
                <Input
                  id="editShelf"
                  placeholder="Ex: A1, B2..."
                  className="mt-1.5"
                  value={editData.shelf}
                  onChange={(e) => setEditData({ ...editData, shelf: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editBox">Caixa</Label>
                <Input
                  id="editBox"
                  placeholder="Ex: 01, 02..."
                  className="mt-1.5"
                  value={editData.box}
                  onChange={(e) => setEditData({ ...editData, box: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editSealNumber">Nº Lacre</Label>
                <Input
                  id="editSealNumber"
                  placeholder="Ex: 123456"
                  className="mt-1.5"
                  value={editData.seal_number}
                  onChange={(e) => setEditData({ ...editData, seal_number: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editDeliveredByName">Quem entregou (Nome) *</Label>
                <Input
                  id="editDeliveredByName"
                  placeholder="Nome de quem encontrou/entregou"
                  className="mt-1.5"
                  value={editData.delivered_by_name}
                  onChange={(e) => setEditData({ ...editData, delivered_by_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="editDeliveredByContact">Contato de quem entregou</Label>
                <Input
                  id="editDeliveredByContact"
                  placeholder="Telefone ou email"
                  className="mt-1.5"
                  value={editData.delivered_by_contact}
                  onChange={(e) => setEditData({ ...editData, delivered_by_contact: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateItem.isPending}>
                {updateItem.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
