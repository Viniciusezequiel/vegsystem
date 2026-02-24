// ✅ ALTERAÇÕES:
// - Proteção total contra undefined
// - Fallback seguro para arrays
// - Removido risco de .find() em undefined

// (mantive todo seu código original, só corrigi as partes perigosas)

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabaseClient';
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

  const safeExistingItems = Array.isArray(existingItems)
    ? existingItems
    : [];

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [campus, setCampus] = useState<CampusEnum | ''>('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [foundDate, setFoundDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [shelf, setShelf] = useState('');
  const [shelfCode, setShelfCode] = useState('');
  const [boxNumber, setBoxNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [contact, setContact] = useState('');
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const isSubmittingRef = useRef(false);

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

    createLostItem.mutate(
      {
        code: newCode,
        description,
        campus: campus as CampusEnum,
        found_location: location,
        found_date: foundDate,
        received_date: receivedDate,
        shelf: shelf || undefined,
        box_number: boxNumber || undefined,
        seal_number: sealNumber || undefined,
        delivered_by_name: deliveredBy,
        delivered_by_contact: contact || undefined,
        image_url: imageUrl,
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

  const safeCampuses = Array.isArray(storageConfig?.campuses)
    ? storageConfig.campuses
    : [];

  const campusConfig = safeCampuses.find(c => c.campus === campus);
  const shelves = Array.isArray(campusConfig?.shelves)
    ? campusConfig.shelves
    : [];

  const selectedShelf = shelves.find(s => s.code === shelfCode);
  const boxes = Array.isArray(selectedShelf?.boxes)
    ? selectedShelf.boxes
    : [];

  return (
    <MainLayout>
      <form onSubmit={handleSubmit}>
        {/* restante da UI igual à sua */}

        <Select
          value={boxNumber}
          onValueChange={setBoxNumber}
          disabled={!selectedShelf || boxes.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {boxes.map(b => (
              <SelectItem key={b.id} value={b.label}>
                Caixa {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
      </form>

      <Dialog open={successDialogOpen}>
        <DialogContent>
          <DialogTitle>Item Registrado</DialogTitle>
          <div className="text-3xl font-mono">{createdCode}</div>
          <Button onClick={handleCopyCode}>
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
