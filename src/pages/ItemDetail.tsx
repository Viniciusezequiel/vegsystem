import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Archive,
  ArrowLeft,
  Building2,
  Calendar,
  CalendarCheck,
  Camera,
  Clock,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  PenLine,
  Phone,
  Tag,
  Trash2,
  User,
} from 'lucide-react';

import { ContentState } from '@/components/layout/ContentState';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProviderAwareSignatureImage } from '@/components/ui/ProviderAwareSignatureImage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';
import { useDeleteLostItem, useDeliverLostItem, useLostItem, useUpdateLostItem } from '@/hooks/useLostItems';
import { supabase } from '@/integrations/supabase/client';
import { Constants } from '@/integrations/supabase/types';
import {
  deleteLostItemImageIfUnreferenced,
  deleteStorageObjectSafely,
  uploadLostItemImage,
} from '@/lib/lostItemStorage';
import { replaceImageSafely } from '@/lib/lostItemStorageCore.mjs';
import { optimizeImage, optimizedImageExtension } from '@/lib/optimizeImage';

const campusOptions = Constants.public.Enums.campus_enum;

function DetailField({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border/50 bg-muted/15 p-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/55 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <div className="mt-0.5 break-words text-sm font-medium text-foreground">{children}</div>
      </div>
    </div>
  );
}

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, profile } = useAuth();
  const { data: item, isLoading, error } = useLostItem(id);
  const updateItem = useUpdateLostItem();
  const deliverItem = useDeliverLostItem();
  const deleteItem = useDeleteLostItem();
  const { url: resolvedImageUrl } = useSignedImageUrl(item?.image_url);

  const { data: registeredByName } = useQuery({
    queryKey: ['profile-name', item?.registered_by],
    queryFn: async () => {
      if (!item?.registered_by) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', item.registered_by)
        .maybeSingle();
      return data?.full_name || null;
    },
    enabled: !!item?.registered_by,
  });

  const { data: deliveredByName } = useQuery({
    queryKey: ['profile-name', item?.delivered_by_team_member],
    queryFn: async () => {
      if (!item?.delivered_by_team_member) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', item.delivered_by_team_member)
        .maybeSingle();
      return data?.full_name || null;
    },
    enabled: !!item?.delivered_by_team_member,
  });

  const [isDeliverDialogOpen, setIsDeliverDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [deliveryData, setDeliveryData] = useState({
    owner_name: '',
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
    box_number: '',
    seal_number: '',
    delivered_by_name: '',
    delivered_by_contact: '',
  });

  const canDeliver = role === 'admin' || role === 'analista' || role === 'assistente';
  const canEdit = role === 'admin' || role === 'analista' || role === 'supervisor' || role === 'assistente';

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !item) return;

    setIsUploadingPhoto(true);
    try {
      const uploadFile = await optimizeImage(file);
      const extension = optimizedImageExtension(uploadFile.type);
      const supabasePath = `${item.code}-${Date.now()}.${extension}`;

      const result = await replaceImageSafely({
        oldLocator: item.image_url,
        upload: () => uploadLostItemImage(uploadFile, supabasePath),
        update: (imageUrl: string) => updateItem.mutateAsync({ id: item.id, image_url: imageUrl }),
        cleanupNew: deleteStorageObjectSafely,
        cleanupOld: deleteLostItemImageIfUnreferenced,
      });

      toast({
        title: 'Foto atualizada',
        description: result.oldCleanup?.preserved
          ? 'A foto foi atualizada. A imagem anterior foi preservada por segurança.'
          : 'A foto do item foi atualizada com sucesso.',
      });
    } catch (err: any) {
      if (err?.possibleOrphanLocator) {
        console.error('Lost-items replacement cleanup failed.', {
          locator: err.possibleOrphanLocator,
          cleanupCode: err.cleanupError?.code,
        });
      }
      toast({
        title: 'Erro ao atualizar foto',
        description: err?.possibleOrphanLocator
          ? 'A atualização falhou e a nova imagem pode ter ficado órfã; o objeto foi identificado para revisão.'
          : err.message || 'Não foi possível fazer upload da foto.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = '';
    }
  };

  const handleOpenEditDialog = () => {
    if (!item) return;
    setEditData({
      description: item.description,
      campus: item.campus,
      found_location: item.found_location,
      found_date: item.found_date,
      received_date: item.received_date,
      shelf: item.shelf || '',
      box: item.box || '',
      box_number: item.box_number || '',
      seal_number: item.seal_number || '',
      delivered_by_name: item.delivered_by_name,
      delivered_by_contact: item.delivered_by_contact || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!item) return;

    updateItem.mutate(
      {
        id: item.id,
        ...editData,
        shelf: editData.shelf || null,
        box: editData.box || null,
        box_number: editData.box_number || null,
        seal_number: editData.seal_number || null,
        delivered_by_contact: editData.delivered_by_contact || null,
      },
      { onSuccess: () => setIsEditDialogOpen(false) }
    );
  };

  const handleDeliverySubmit = (event: React.FormEvent) => {
    event.preventDefault();
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
        owner_name: deliveryData.owner_name,
        owner_email: '',
        owner_phone: deliveryData.owner_phone,
        owner_signature: deliveryData.owner_signature || undefined,
      },
      {
        onSuccess: () => {
          setIsDeliverDialogOpen(false);
          setDeliveryData({ owner_name: '', owner_phone: '', owner_signature: null });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <ContentState loading title="Carregando item" description="Buscando os dados e o histórico do registro." />
      </MainLayout>
    );
  }

  if (error || !item) {
    return (
      <MainLayout>
        <ContentState
          icon={Package}
          title="Item não encontrado"
          description="O registro pode ter sido removido ou você pode não ter acesso a ele."
          action={<Button variant="outline" onClick={() => navigate('/lost-found/items')}>Voltar para a lista</Button>}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title={item.description}
        description={`Registro ${item.code} · detalhes, armazenamento e movimentação do item.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/lost-found/items')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={handleOpenEditDialog}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            )}
            {role === 'admin' && (
              <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-border/60 bg-card/65 shadow-sm">
            <div className="group relative aspect-square bg-muted/30">
              {resolvedImageUrl ? (
                <img src={resolvedImageUrl} alt={item.description} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Package className="h-14 w-14 opacity-35" />
                  <p className="text-xs">Sem foto cadastrada</p>
                </div>
              )}

              {canEdit && (
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 pt-12 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  {isUploadingPhoto ? (
                    <div className="flex items-center gap-2 rounded-md bg-background/90 px-3 py-2 text-xs text-foreground shadow">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Atualizando foto...
                    </div>
                  ) : (
                    <>
                      <label className="cursor-pointer">
                        <Button type="button" variant="secondary" size="sm" asChild>
                          <span>
                            <Camera className="mr-2 h-4 w-4" />
                            Câmera
                            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
                          </span>
                        </Button>
                      </label>
                      <label className="cursor-pointer">
                        <Button type="button" variant="secondary" size="sm" asChild>
                          <span>
                            <ImageIcon className="mr-2 h-4 w-4" />
                            Galeria
                            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                          </span>
                        </Button>
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>

            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">Código do item</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold">{item.code}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            </CardContent>
          </Card>

          {item.status === 'available' && canDeliver && (
            <Dialog
              open={isDeliverDialogOpen}
              onOpenChange={open => {
                if (!open && deliverItem.isPending) return;
                setIsDeliverDialogOpen(open);
              }}
            >
              <DialogTrigger asChild>
                <Button className="w-full" size="lg">
                  <PackageCheck className="mr-2 h-5 w-5" />
                  Dar baixa / Entregar
                </Button>
              </DialogTrigger>
              <DialogContent
                className="sm:max-w-lg"
                onPointerDownOutside={event => event.preventDefault()}
                onInteractOutside={event => event.preventDefault()}
              >
                <DialogHeader>
                  <DialogTitle>Registrar entrega</DialogTitle>
                  <DialogDescription>
                    Identifique o proprietário e colete a assinatura de recebimento.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleDeliverySubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="ownerName" className="text-xs text-muted-foreground">Nome completo do proprietário *</Label>
                      <Input
                        id="ownerName"
                        value={deliveryData.owner_name}
                        onChange={event => setDeliveryData(previous => ({ ...previous, owner_name: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ownerPhone" className="text-xs text-muted-foreground">Telefone *</Label>
                      <Input
                        id="ownerPhone"
                        value={deliveryData.owner_phone}
                        onChange={event => setDeliveryData(previous => ({ ...previous, owner_phone: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="teamMember" className="text-xs text-muted-foreground">Responsável pela entrega</Label>
                      <Input id="teamMember" value={profile?.full_name || ''} readOnly className="bg-muted/35" />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/15 p-3">
                    <Label className="flex items-center gap-2 text-sm">
                      <PenLine className="h-4 w-4" />
                      Assinatura do proprietário *
                    </Label>
                    <p className="text-xs text-muted-foreground">Assine abaixo para confirmar o recebimento do item.</p>
                    <SignaturePad onSignatureChange={signature => setDeliveryData(previous => ({ ...previous, owner_signature: signature }))} />
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => setIsDeliverDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={deliverItem.isPending || !deliveryData.owner_signature}>
                      {deliverItem.isPending ? 'Registrando...' : 'Confirmar entrega'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="space-y-4">
          <Card className="border-border/60 bg-card/65 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações do item</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <DetailField icon={Building2} label="Campus">{item.campus}</DetailField>
              <DetailField icon={MapPin} label="Local encontrado">{item.found_location}</DetailField>
              <DetailField icon={Calendar} label="Data encontrado">
                {format(new Date(`${item.found_date}T00:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </DetailField>
              <DetailField icon={CalendarCheck} label="Data recebido">
                {format(new Date(`${item.received_date}T00:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </DetailField>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/65 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Armazenamento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailField icon={Archive} label="Prateleira">{item.shelf || '—'}</DetailField>
              <DetailField icon={Package} label="Caixa">{item.box || '—'}</DetailField>
              <DetailField icon={Package} label="Nº da caixa">{item.box_number || '—'}</DetailField>
              <DetailField icon={Tag} label="Nº do lacre">{item.seal_number || '—'}</DetailField>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60 bg-card/65 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Origem do item</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DetailField icon={User} label="Quem entregou">{item.delivered_by_name}</DetailField>
                <DetailField icon={Phone} label="Contato">{item.delivered_by_contact || '—'}</DetailField>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/65 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Registro no sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DetailField icon={Clock} label="Data/Hora do registro">
                  {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </DetailField>
                <DetailField icon={User} label="Cadastrado por">{registeredByName || 'Não identificado'}</DetailField>
              </CardContent>
            </Card>
          </div>

          {item.status === 'delivered' && item.owner_name && (
            <Card className="border-primary/20 bg-primary/[0.025] shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageCheck className="h-4 w-4 text-primary" />
                  Informações da entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailField icon={User} label="Proprietário">{item.owner_name}</DetailField>
                  <DetailField icon={Phone} label="Telefone">{item.owner_phone || '—'}</DetailField>
                  {item.delivered_at && (
                    <DetailField icon={CalendarCheck} label="Data da entrega">
                      {format(new Date(item.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </DetailField>
                  )}
                  {item.delivered_by_team_member && (
                    <DetailField icon={PackageCheck} label="Responsável pela entrega">
                      {deliveredByName || 'Usuário não identificado'}
                    </DetailField>
                  )}
                </div>

                {item.owner_signature && (
                  <div className="mt-4 border-t border-border/50 pt-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <PenLine className="h-3.5 w-3.5" />
                      Assinatura do proprietário
                    </div>
                    <div className="inline-flex max-w-full rounded-lg border border-border/60 bg-white p-2">
                      <ProviderAwareSignatureImage
                        value={item.owner_signature}
                        expectedModule="lost-items"
                        alt="Assinatura do proprietário"
                        className="max-h-[150px] max-w-full object-contain sm:max-w-[320px]"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar item</DialogTitle>
            <DialogDescription>Atualize as informações operacionais do registro.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="editDescription" className="text-xs text-muted-foreground">Descrição *</Label>
              <Textarea
                id="editDescription"
                value={editData.description}
                onChange={event => setEditData({ ...editData, description: event.target.value })}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Campus *</Label>
                <Select value={editData.campus} onValueChange={value => setEditData({ ...editData, campus: value as typeof campusOptions[number] })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o campus" /></SelectTrigger>
                  <SelectContent>
                    {campusOptions.map(campus => <SelectItem key={campus} value={campus}>{campus}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editFoundLocation" className="text-xs text-muted-foreground">Local encontrado *</Label>
                <Input id="editFoundLocation" value={editData.found_location} onChange={event => setEditData({ ...editData, found_location: event.target.value })} required />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="editFoundDate" className="text-xs text-muted-foreground">Data encontrado *</Label>
                <Input id="editFoundDate" type="date" value={editData.found_date} onChange={event => setEditData({ ...editData, found_date: event.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editReceivedDate" className="text-xs text-muted-foreground">Data recebido *</Label>
                <Input id="editReceivedDate" type="date" value={editData.received_date} onChange={event => setEditData({ ...editData, received_date: event.target.value })} required />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Armazenamento</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="editShelf" className="text-xs text-muted-foreground">Prateleira</Label><Input id="editShelf" value={editData.shelf} onChange={event => setEditData({ ...editData, shelf: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="editBox" className="text-xs text-muted-foreground">Caixa</Label><Input id="editBox" value={editData.box} onChange={event => setEditData({ ...editData, box: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="editBoxNumber" className="text-xs text-muted-foreground">Nº da caixa</Label><Input id="editBoxNumber" value={editData.box_number} onChange={event => setEditData({ ...editData, box_number: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="editSealNumber" className="text-xs text-muted-foreground">Nº do lacre</Label><Input id="editSealNumber" value={editData.seal_number} onChange={event => setEditData({ ...editData, seal_number: event.target.value })} /></div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="editDeliveredByName" className="text-xs text-muted-foreground">Quem entregou (Nome) *</Label>
                <Input id="editDeliveredByName" value={editData.delivered_by_name} onChange={event => setEditData({ ...editData, delivered_by_name: event.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editDeliveredByContact" className="text-xs text-muted-foreground">Contato de quem entregou</Label>
                <Input id="editDeliveredByContact" value={editData.delivered_by_contact} onChange={event => setEditData({ ...editData, delivered_by_contact: event.target.value })} />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateItem.isPending}>{updateItem.isPending ? 'Salvando...' : 'Salvar alterações'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir item</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o item <strong>{item.code}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteItem.isPending}
              onClick={() => {
                deleteItem.mutate(item.id, {
                  onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    navigate('/lost-found/items');
                  },
                });
              }}
            >
              {deleteItem.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
