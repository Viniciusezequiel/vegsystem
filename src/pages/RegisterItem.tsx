import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Camera, CheckCircle, Loader2, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { useCreateLostItem, useLostItems } from '@/hooks/useLostItems';
import { useStorageConfig } from '@/hooks/useStorageConfig';
import type { Database } from '@/integrations/supabase/types';
import { optimizeImage, optimizedImageExtension } from '@/lib/optimizeImage';
import { deleteStorageObjectSafely, uploadLostItemImage } from '@/lib/lostItemStorage';
import { persistNewImageSafely } from '@/lib/lostItemStorageCore.mjs';
import { LostFoundModuleNav } from '@/components/lost-found/LostFoundModuleNav';

type CampusEnum = Database['public']['Enums']['campus_enum'];

const campusOptions: CampusEnum[] = [
  'Campus I',
  'Campus II',
  'Campus IV',
  'Campus HUCM Adm',
];

// Generate a unique 6-digit code
const generateUniqueCode = (existingCodes: string[]): string => {
  let code: string;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (existingCodes.includes(code));
  return code;
};

export default function RegisterItem() {
  const navigate = useNavigate();
  const createLostItem = useCreateLostItem();
  const { data: existingItems } = useLostItems();
  const { data: storageConfig } = useStorageConfig();
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [campus, setCampus] = useState<CampusEnum | ''>('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [foundDate, setFoundDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [shelf, setShelf] = useState('');
  const [shelfCode, setShelfCode] = useState('');
  const [box, setBox] = useState('');
  const [boxNumber, setBoxNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [contact, setContact] = useState('');
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOptimizingImage(true);
    try {
      const optimized = await optimizeImage(file);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(optimized);
      setImagePreview(URL.createObjectURL(optimized));
    } catch (error) {
      setImageFile(null);
      const { toast } = await import('sonner');
      toast.error(error instanceof Error ? error.message : 'Não foi possível otimizar a imagem.');
    } finally {
      setIsOptimizingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!campus) return;
    if (!imageFile) {
      const { toast } = await import('sonner');
      toast.error('É obrigatório adicionar uma foto do item');
      return;
    }
    if (isSubmittingRef.current || createLostItem.isPending || isOptimizingImage) return;
    isSubmittingRef.current = true;

    // Generate unique 6-digit code
    const existingCodes = existingItems?.items?.map(item => item.code) || [];
    const newCode = generateUniqueCode(existingCodes);

    const ext = optimizedImageExtension(imageFile.type);
    const supabasePath = `${newCode}-${Date.now()}.${ext}`;
    let databaseInsertStarted = false;

    try {
      await persistNewImageSafely({
        upload: () => uploadLostItemImage(imageFile, supabasePath),
        persist: (imageUrl: string) => {
          databaseInsertStarted = true;
          return createLostItem.mutateAsync({
            code: newCode,
            description,
            campus: campus as CampusEnum,
            found_location: location,
            found_date: foundDate,
            received_date: receivedDate,
            shelf: shelf || undefined,
            box: box || undefined,
            box_number: boxNumber || undefined,
            seal_number: sealNumber || undefined,
            delivered_by_name: deliveredBy,
            delivered_by_contact: contact || undefined,
            image_url: imageUrl,
          });
        },
        cleanupNew: deleteStorageObjectSafely,
      });

        setCreatedCode(newCode);
        setSuccessDialogOpen(true);
        
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        setImageFile(null);
        setCampus('');
        setDescription('');
        setLocation('');
        setFoundDate('');
        setReceivedDate('');
        setShelf('');
        setShelfCode('');
        setBox('');
        setBoxNumber('');
        setSealNumber('');
        setDeliveredBy('');
        setContact('');
    } catch (error: any) {
      const { toast } = await import('sonner');
      if (error?.possibleOrphanLocator) {
        console.error('Lost-items image cleanup failed after insert error.', {
          locator: error.possibleOrphanLocator,
          cleanupCode: error.cleanupError?.code,
        });
        toast.error('O cadastro falhou e a limpeza da imagem também falhou. Há um possível objeto órfão identificado para revisão.');
      } else if (!databaseInsertStarted) {
        toast.error(error?.message || 'Não foi possível enviar a imagem. O item não foi cadastrado; tente novamente.');
      }
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseSuccessDialog = () => {
    setSuccessDialogOpen(false);
    navigate('/lost-found');
  };

  return (
    <MainLayout>
      <div className="mb-6"><LostFoundModuleNav /></div>

      <PageHeader
        title="Registrar Novo Item"
        description="Cadastre um item encontrado no sistema"
      />

      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Upload */}
          <div className="form-section animate-fade-in">
            <h3 className="font-medium text-foreground mb-4">Foto do Item</h3>
            <div className="relative">
              {imagePreview ? (
                <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => { if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(null); setImageFile(null); }}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 hover:bg-destructive/90"
                  >
                    <span className="sr-only">Remover</span>
                    ×
                  </button>
                </div>
              ) : (
                <div className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/30 flex flex-col items-center justify-center gap-4">
                  <Camera className="w-12 h-12 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground text-center px-4">Escolha uma opção para adicionar foto</span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>
                          <Camera className="w-4 h-4 mr-2" />
                          Abrir Câmera
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </span>
                      </Button>
                    </label>
                    <label className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Galeria
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </span>
                      </Button>
                    </label>
                  </div>
                  <span className="text-xs text-destructive font-medium">* Foto obrigatória</span>
                </div>
              )}
            </div>
          </div>

          {/* Item Info */}
          <div className="space-y-6">
            <div className="form-section animate-fade-in" style={{ animationDelay: '100ms' }}>
              <h3 className="font-medium text-foreground mb-4">Informações do Item</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="description">Descrição do Item *</Label>
                  <Textarea
                    id="description"
                    placeholder="Ex: Carteira de couro marrom com documentos"
                    className="mt-1.5 resize-none"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="campus">Campus *</Label>
                  <Select value={campus} onValueChange={(v) => { setCampus(v as CampusEnum); setShelfCode(''); setShelf(''); setBoxNumber(''); }} required>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione o campus" />
                    </SelectTrigger>
                    <SelectContent>
                      {campusOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">Local onde foi encontrado *</Label>
                  <Input
                    id="location"
                    placeholder="Ex: Refeitório - Mesa 12"
                    className="mt-1.5"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="foundDate">Data encontrado *</Label>
                    <Input
                      id="foundDate"
                      type="date"
                      className="mt-1.5"
                      value={foundDate}
                      onChange={(e) => {
                        // Ensure we store the date as-is without timezone conversion
                        const dateValue = e.target.value;
                        setFoundDate(dateValue);
                      }}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="receivedDate">Data recebido *</Label>
                    <Input
                      id="receivedDate"
                      type="date"
                      className="mt-1.5"
                      value={receivedDate}
                      onChange={(e) => {
                        // Ensure we store the date as-is without timezone conversion
                        const dateValue = e.target.value;
                        setReceivedDate(dateValue);
                      }}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section animate-fade-in" style={{ animationDelay: '150ms' }}>
              <h3 className="font-medium text-foreground mb-4">Armazenamento</h3>
              {(() => {
                const campusConfig = storageConfig?.campuses.find(c => c.campus === campus);
                const shelves = campusConfig?.shelves || [];
                const selectedShelf = shelves.find(s => s.code === shelfCode);
                const estante = shelfCode ? shelfCode.split('.')[0] : '';

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <Label>Estante</Label>
                      <Input
                        value={estante}
                        readOnly
                        placeholder={campus ? 'Auto' : 'Selecione campus'}
                        className="mt-1.5 bg-muted/50"
                      />
                    </div>
                    <div>
                      <Label>Prateleira</Label>
                      <Select
                        value={shelfCode}
                        onValueChange={(v) => {
                          setShelfCode(v);
                          setShelf(v);
                          setBoxNumber('');
                          // Auto-set estante
                        }}
                        disabled={!campus || shelves.length === 0}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder={!campus ? 'Selecione campus' : shelves.length === 0 ? 'Nenhuma configurada' : 'Selecione'} />
                        </SelectTrigger>
                        <SelectContent>
                          {shelves.map(s => (
                            <SelectItem key={s.id} value={s.code}>
                              {s.code} ({s.label})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Nº da Caixa</Label>
                      <Select
                        value={boxNumber}
                        onValueChange={setBoxNumber}
                        disabled={!selectedShelf || selectedShelf.boxes.length === 0}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder={!selectedShelf ? 'Selecione prat.' : selectedShelf.boxes.length === 0 ? 'Sem caixas' : 'Selecione'} />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedShelf?.boxes.map(b => (
                            <SelectItem key={b.id} value={b.label}>
                              Caixa {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="sealNumber">Nº do Lacre</Label>
                      <Input
                        id="sealNumber"
                        placeholder="Ex: LC-001234"
                        className="mt-1.5"
                        value={sealNumber}
                        onChange={(e) => setSealNumber(e.target.value)}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="form-section animate-fade-in" style={{ animationDelay: '200ms' }}>
              <h3 className="font-medium text-foreground mb-4">Quem está entregando o item</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="deliveredBy">Nome completo *</Label>
                  <Input
                    id="deliveredBy"
                    placeholder="Nome de quem encontrou/está entregando"
                    className="mt-1.5"
                    value={deliveredBy}
                    onChange={(e) => setDeliveredBy(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact">Contato (telefone ou email)</Label>
                  <Input
                    id="contact"
                    placeholder="(11) 99999-9999"
                    className="mt-1.5"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/lost-found')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createLostItem.isPending || isOptimizingImage}>
            {createLostItem.isPending || isOptimizingImage ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Registrar Item
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Success Dialog with Code */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-success">
              <CheckCircle className="w-6 h-6" />
              Item Registrado com Sucesso!
            </DialogTitle>
            <DialogDescription>
              O item foi cadastrado no sistema com o seguinte código:
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="inline-flex items-center gap-3 bg-primary/10 rounded-lg px-6 py-4">
              <span className="text-3xl font-mono font-bold text-primary">{createdCode}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCopyCode}
                className="h-8 w-8"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Guarde este código para localizar o item
            </p>
          </div>
          <Button onClick={handleCloseSuccessDialog} className="w-full">
            Ver Lista de Itens
          </Button>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
