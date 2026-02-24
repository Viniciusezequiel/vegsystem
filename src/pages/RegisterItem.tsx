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
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];

const campusOptions: CampusEnum[] = [
  'Campus I',
  'Campus II',
  'Campus IV',
  'Campus HUCM Adm',
];

const generateUniqueCode = (existingCodes: string[]): string => {
  let code: string;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (existingCodes.includes(code));
  return code;
};

export default function RegisterItem() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createLostItem = useCreateLostItem();
  const { data: existingItems } = useLostItems();
  const { data: storageConfig } = useStorageConfig();

  const safeExistingItems = Array.isArray(existingItems) ? existingItems : [];

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [campus, setCampus] = useState<CampusEnum | ''>('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [foundDate, setFoundDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [shelfCode, setShelfCode] = useState('');
  const [boxNumber, setBoxNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [contact, setContact] = useState('');
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const isSubmittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImageToStorage = async (file: File, itemCode: string): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${itemCode}-${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('lost-items')
        .upload(filePath, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from('lost-items')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campus) return;
    if (isSubmittingRef.current || createLostItem.isPending) return;

    isSubmittingRef.current = true;

    const existingCodes = safeExistingItems.map(item => item.code);
    const newCode = generateUniqueCode(existingCodes);

    let imageUrl: string | undefined;

    if (imageFile) {
      const url = await uploadImageToStorage(imageFile, newCode);
      imageUrl = url || undefined;
    }

    // Build shelf label from config
    const selectedShelf = shelves.find(s => s.code === shelfCode);
    const shelfLabel = selectedShelf ? `${selectedShelf.code} - ${selectedShelf.label}` : shelfCode || undefined;

    createLostItem.mutate(
      {
        code: newCode,
        description,
        campus: campus as CampusEnum,
        found_location: location,
        found_date: foundDate,
        received_date: receivedDate,
        shelf: shelfLabel,
        box_number: boxNumber || undefined,
        seal_number: sealNumber || undefined,
        delivered_by_name: deliveredBy,
        delivered_by_contact: contact || undefined,
        image_url: imageUrl,
        registered_by: user?.id || undefined,
      },
      {
        onSuccess: () => {
          setCreatedCode(newCode);
          setSuccessDialogOpen(true);
          isSubmittingRef.current = false;
        },
        onError: () => {
          isSubmittingRef.current = false;
        },
      }
    );
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setDescription('');
    setLocation('');
    setFoundDate('');
    setReceivedDate('');
    setShelfCode('');
    setBoxNumber('');
    setSealNumber('');
    setDeliveredBy('');
    setContact('');
    setImageFile(null);
    setImagePreview(null);
    setSuccessDialogOpen(false);
  };

  const safeCampuses = Array.isArray(storageConfig?.campuses) ? storageConfig.campuses : [];
  const campusConfig = safeCampuses.find(c => c.campus === campus);
  const shelves = Array.isArray(campusConfig?.shelves) ? campusConfig.shelves : [];
  const selectedShelf = shelves.find(s => s.code === shelfCode);
  const boxes = Array.isArray(selectedShelf?.boxes) ? selectedShelf.boxes : [];

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Registrar Item</h1>
        <p className="page-subtitle">Cadastre um novo item de achados e perdidos</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Foto do Item */}
        <div className="form-section">
          <h2 className="text-lg font-semibold mb-4">Foto do Item</h2>
          <div className="flex items-center gap-4">
            <div
              className="w-32 h-32 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50 overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <Camera className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-xs text-muted-foreground mt-1">Adicionar foto</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            {imagePreview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
              >
                Remover
              </Button>
            )}
          </div>
        </div>

        {/* Informações do Item */}
        <div className="form-section">
          <h2 className="text-lg font-semibold mb-4">Informações do Item</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">Descrição do Item *</Label>
              <Textarea
                id="description"
                placeholder="Descreva o item encontrado..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5"
                required
              />
            </div>

            <div>
              <Label htmlFor="campus">Campus *</Label>
              <Select value={campus} onValueChange={(val) => { setCampus(val as CampusEnum); setShelfCode(''); setBoxNumber(''); }}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione o campus" />
                </SelectTrigger>
                <SelectContent>
                  {campusOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="location">Local Encontrado *</Label>
              <Input
                id="location"
                placeholder="Ex: Corredor do Bloco A"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1.5"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="foundDate">Data Encontrado *</Label>
                <Input
                  id="foundDate"
                  type="date"
                  value={foundDate}
                  onChange={(e) => setFoundDate(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="receivedDate">Data Recebido *</Label>
                <Input
                  id="receivedDate"
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Armazenamento */}
        <div className="form-section">
          <h2 className="text-lg font-semibold mb-4">Armazenamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Prateleira</Label>
              <Select value={shelfCode} onValueChange={(val) => { setShelfCode(val); setBoxNumber(''); }} disabled={!campus || shelves.length === 0}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {shelves.map((s) => (
                    <SelectItem key={s.id} value={s.code}>
                      {s.code} - {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Caixa</Label>
              <Select value={boxNumber} onValueChange={setBoxNumber} disabled={!selectedShelf || boxes.length === 0}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {boxes.map((b) => (
                    <SelectItem key={b.id} value={b.label}>
                      Caixa {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sealNumber">Nº Lacre</Label>
              <Input
                id="sealNumber"
                placeholder="Número do lacre"
                value={sealNumber}
                onChange={(e) => setSealNumber(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        {/* Quem entregou */}
        <div className="form-section">
          <h2 className="text-lg font-semibold mb-4">Quem Entregou o Item</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deliveredBy">Nome *</Label>
              <Input
                id="deliveredBy"
                placeholder="Nome de quem entregou"
                value={deliveredBy}
                onChange={(e) => setDeliveredBy(e.target.value)}
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="contact">Contato</Label>
              <Input
                id="contact"
                placeholder="Telefone ou e-mail"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        {/* Botão submit */}
        <Button type="submit" className="w-full" size="lg" disabled={createLostItem.isPending}>
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
      </form>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Item Registrado com Sucesso!
            </DialogTitle>
            <DialogDescription>
              O item foi cadastrado no sistema. Anote o código para referência.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-muted rounded-lg p-6 text-center w-full">
              <p className="text-sm text-muted-foreground mb-1">Código do Item</p>
              <p className="text-3xl font-mono font-bold tracking-wider">{createdCode}</p>
            </div>
            <Button onClick={handleCopyCode} variant="outline" className="w-full">
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Código
                </>
              )}
            </Button>
            <div className="flex gap-2 w-full">
              <Button onClick={resetForm} variant="outline" className="flex-1">
                Registrar Outro
              </Button>
              <Button onClick={() => navigate('/lost-found/items')} className="flex-1">
                Ver Itens
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
