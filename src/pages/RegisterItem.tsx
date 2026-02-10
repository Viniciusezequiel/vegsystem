import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
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

// Compress image to reduce file size
const compressImage = (file: File, maxWidth: number, quality: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('No blob')); return; }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

export default function RegisterItem() {
  const navigate = useNavigate();
  const createLostItem = useCreateLostItem();
  const { data: existingItems } = useLostItems();
  const { data: storageConfig } = useStorageConfig();
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Compress if > 2MB
      if (file.size > 2 * 1024 * 1024) {
        compressImage(file, 1200, 0.7).then((compressed) => {
          setImageFile(compressed);
        }).catch(() => {
          setImageFile(file);
        });
      } else {
        setImageFile(file);
      }
      // Create a preview URL (lightweight, no base64 in memory)
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
    }
  };

  const uploadImageToStorage = async (file: File, itemCode: string): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${itemCode}-${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('lost-items')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('lost-items')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error('Error uploading image:', err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!campus) return;
    if (isSubmittingRef.current || createLostItem.isPending) return;
    isSubmittingRef.current = true;

    // Generate unique 6-digit code
    const existingCodes = existingItems?.items?.map(item => item.code) || [];
    const newCode = generateUniqueCode(existingCodes);

    // Upload image to Storage if exists (instead of sending base64)
    let imageUrl: string | undefined;
    if (imageFile) {
      const url = await uploadImageToStorage(imageFile, newCode);
      imageUrl = url || undefined;
    }
    
    createLostItem.mutate({
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
    }, {
      onSuccess: () => {
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
        isSubmittingRef.current = false;
      },
      onError: () => {
        isSubmittingRef.current = false;
      }
    });
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
      <div className="page-header">
        <h1 className="page-title">Registrar Novo Item</h1>
        <p className="page-subtitle">Cadastre um item encontrado no sistema</p>
      </div>

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
                  <span className="text-xs text-muted-foreground/60">JPG, PNG até 5MB</span>
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
          <Button type="submit" disabled={createLostItem.isPending}>
            {createLostItem.isPending ? (
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
