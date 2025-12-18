import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
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

export default function RegisterItem() {
  const navigate = useNavigate();
  const createLostItem = useCreateLostItem();
  const { data: existingItems } = useLostItems();
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [campus, setCampus] = useState<CampusEnum | ''>('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [foundDate, setFoundDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [shelf, setShelf] = useState('');
  const [box, setBox] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [contact, setContact] = useState('');
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

    // Generate unique 6-digit code
    const existingCodes = existingItems?.items?.map(item => item.code) || [];
    const newCode = generateUniqueCode(existingCodes);
    
    createLostItem.mutate({
      code: newCode,
      description,
      campus: campus as CampusEnum,
      found_location: location,
      found_date: foundDate,
      received_date: receivedDate,
      shelf: shelf || undefined,
      box: box || undefined,
      seal_number: sealNumber || undefined,
      delivered_by_name: deliveredBy,
      delivered_by_contact: contact || undefined,
      image_url: imagePreview || undefined,
    }, {
      onSuccess: () => {
        // Show success dialog with code
        setCreatedCode(newCode);
        setSuccessDialogOpen(true);
        
        // Reset form
        setImagePreview(null);
        setCampus('');
        setDescription('');
        setLocation('');
        setFoundDate('');
        setReceivedDate('');
        setShelf('');
        setBox('');
        setSealNumber('');
        setDeliveredBy('');
        setContact('');
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
                    onClick={() => setImagePreview(null)}
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
                  <Select value={campus} onValueChange={(v) => setCampus(v as CampusEnum)} required>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="shelf">Estante</Label>
                  <Input
                    id="shelf"
                    placeholder="Ex: A"
                    className="mt-1.5"
                    value={shelf}
                    onChange={(e) => setShelf(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="box">Prateleira</Label>
                  <Input
                    id="box"
                    placeholder="Ex: 01"
                    className="mt-1.5"
                    value={box}
                    onChange={(e) => setBox(e.target.value)}
                  />
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
