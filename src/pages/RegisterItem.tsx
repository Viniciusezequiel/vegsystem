import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Image as ImageIcon,
  Info,
  Loader2,
  MapPin,
  PackagePlus,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCreateLostItem, useLostItems } from '@/hooks/useLostItems';
import { useStorageConfig } from '@/hooks/useStorageConfig';
import type { Database } from '@/integrations/supabase/types';
import { optimizeImage, optimizedImageExtension } from '@/lib/optimizeImage';
import { deleteStorageObjectSafely, uploadLostItemImage } from '@/lib/lostItemStorage';
import { persistNewImageSafely } from '@/lib/lostItemStorageCore.mjs';
import { analyzeLostItemImage } from '@/lib/lostItemAi';
import { getLostItemStorageSuggestion, inferLostItemStorageCategoryFromDescription, automaticStorageFields } from '@/lib/lostItemStorageSuggestion';
import { useLostItemStorageOccupancy } from '@/hooks/useLostItemStorageOccupancy';
import { LostFoundModuleNav } from '@/components/lost-found/LostFoundModuleNav';

type CampusEnum = Database['public']['Enums']['campus_enum'];

const campusOptions: CampusEnum[] = [
  'Campus I',
  'Campus II',
  'Campus IV',
  'Campus HUCM Adm',
];

const formatLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value: string) => {
  if (!value) return 'Não informada';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const normalizeComparableText = (value: string | null | undefined) => {
  if (!value) return '';
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
};

const isSemanticContainmentMatch = (candidate: string | null | undefined, container: string | null | undefined) => {
  const normalizedCandidate = normalizeComparableText(candidate);
  const normalizedContainer = normalizeComparableText(container);
  if (!normalizedCandidate || !normalizedContainer) return false;
  return normalizedContainer.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedContainer);
};

const deduplicateNormalizedTerms = (values: Array<string | null | undefined>) => {
  const unique: string[] = [];

  for (const value of values) {
    const cleaned = (value ?? '').trim();
    if (!cleaned) continue;

    const normalized = normalizeComparableText(cleaned);
    if (!normalized) continue;

    const isDuplicate = unique.some(existing => {
      const existingNormalized = normalizeComparableText(existing);
      if (!existingNormalized) return false;
      return existingNormalized === normalized
        || existingNormalized.includes(normalized)
        || normalized.includes(existingNormalized);
    });

    if (isDuplicate) continue;
    unique.push(cleaned);
  }

  return unique;
};

const buildAutoDescription = (suggestion: Awaited<ReturnType<typeof analyzeLostItemImage>> | null) => {
  if (!suggestion) return '';

  const descriptionText = (suggestion.description_suggestion ?? '').trim();
  const parts: string[] = [];

  const addUniquePart = (input: string | null | undefined) => {
    const cleaned = (input ?? '').trim();
    if (!cleaned) return;

    const normalized = normalizeComparableText(cleaned);
    if (!normalized) return;

    if (descriptionText && isSemanticContainmentMatch(cleaned, descriptionText)) return;

    const normalizedParts = parts.map(part => normalizeComparableText(part));
    const duplicate = normalizedParts.some(part =>
      part === normalized || part.includes(normalized) || normalized.includes(part)
    );

    if (duplicate) return;
    parts.push(cleaned);
  };

  if (descriptionText) {
    parts.push(descriptionText);
  }

  addUniquePart(suggestion.product_name);
  addUniquePart(suggestion.model_variant);
  addUniquePart(suggestion.brand);
  addUniquePart(suggestion.primary_color);
  if (suggestion.visible_specs?.length) {
    suggestion.visible_specs.forEach(spec => addUniquePart(spec));
  }
  if (suggestion.distinguishing_features?.length) {
    suggestion.distinguishing_features.forEach(feature => addUniquePart(feature));
  }

  return parts.join(' ').trim();
};

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
  const [foundDate, setFoundDate] = useState(() => formatLocalDate());
  const [receivedDate, setReceivedDate] = useState(() => formatLocalDate());
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
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<Awaited<ReturnType<typeof analyzeLostItemImage>> | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [acceptedAiDescription, setAcceptedAiDescription] = useState(false);
  const [searchMetadata, setSearchMetadata] = useState('');
  const [selectedSuggestionFields, setSelectedSuggestionFields] = useState<Record<string, boolean>>({});
  const [storageManualOverride, setStorageManualOverride] = useState(false);
  const isSubmittingRef = useRef(false);
  const { data: storageOccupancy = [] } = useLostItemStorageOccupancy();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOptimizingImage(true);
    try {
      const optimized = await optimizeImage(file);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(optimized);
      setImagePreview(URL.createObjectURL(optimized));
      setAiSuggestion(null);
      setSuggestionError(null);
      setAcceptedAiDescription(false);
      setSearchMetadata('');
      setSelectedSuggestionFields({});
    } catch (error) {
      setImageFile(null);
      const { toast } = await import('sonner');
      toast.error(error instanceof Error ? error.message : 'Não foi possível otimizar a imagem.');
    } finally {
      setIsOptimizingImage(false);
      e.target.value = '';
    }
  };

  const handleAnalyzeImage = async () => {
    if (!imageFile) return;
    setIsAnalyzingImage(true);
    setSuggestionError(null);
    try {
      const result = await analyzeLostItemImage(imageFile);
      const defaultSelected = {
        item_type: !!result.item_type,
        product_name: !!result.product_name,
        model_variant: !!result.model_variant,
        primary_color: !!result.primary_color,
        brand: !!result.brand,
        visible_specs: !!result.visible_specs?.length,
        visible_text_safe: !!result.visible_text_safe?.length,
      };
      setSelectedSuggestionFields(defaultSelected);
      setAiSuggestion(result);
      setSuggestionError(null);
      if (!description.trim()) {
        const autoDescription = buildAutoDescription(result);
        if (autoDescription) {
          setDescription(autoDescription);
          setAcceptedAiDescription(true);
        }
      }
    } catch (error) {
      setAiSuggestion(null);
      const message = error instanceof Error ? error.message : 'Identificação inteligente indisponível no momento. Você pode continuar o cadastro normalmente.';
      setSuggestionError(message);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleUseAiDescription = () => {
    if (!aiSuggestion?.description_suggestion || acceptedAiDescription) return;
    if (description.trim()) {
      toast.message('Descrição existente preservada', { description: 'A descrição atual foi mantida. Você pode editá-la manualmente.' });
      return;
    }
    setDescription(aiSuggestion.description_suggestion);
    setAcceptedAiDescription(true);
  };

  const descriptionCategory = inferLostItemStorageCategoryFromDescription(description);
  const effectiveStorageCategory = descriptionCategory || aiSuggestion?.storage_category || (description.trim() ? 'variados' : null);

  const aiStorageSuggestion = getLostItemStorageSuggestion({
    storageConfig: storageConfig ?? null,
    campus: campus || '',
    storageCategory: effectiveStorageCategory,
    occupancy: storageOccupancy,
  });

  useEffect(() => {
    const fields = automaticStorageFields(storageManualOverride, aiStorageSuggestion);
    if (!fields) return;
    setShelfCode(fields.shelfCode);
    setShelf(fields.shelf);
    setBoxNumber(fields.boxNumber);
    setBox(fields.box);
  }, [storageManualOverride, aiStorageSuggestion?.shelfCode, aiStorageSuggestion?.boxNumber, aiStorageSuggestion?.box]);

  const buildSearchMetadataFromSuggestions = () => {
    if (!aiSuggestion) return (searchMetadata || '').trim();

    const acceptedValues = deduplicateNormalizedTerms(
      Object.entries(selectedSuggestionFields)
        .filter(([, selected]) => selected)
        .map(([key]) => {
          const suggestionValue: unknown = key === 'features'
            ? aiSuggestion.features?.join(', ')
            : key === 'visible_text_safe'
              ? aiSuggestion.visible_text_safe?.join(', ')
              : key === 'storage_category'
                ? aiSuggestion.storage_category
                : key === 'visible_specs'
                  ? aiSuggestion.visible_specs?.join(', ')
                  : key === 'distinguishing_features'
                    ? aiSuggestion.distinguishing_features?.join(', ')
                    : (aiSuggestion as Record<string, unknown>)[key];

          if (Array.isArray(suggestionValue)) return suggestionValue.join(', ');
          if (typeof suggestionValue === 'string' || suggestionValue === null || suggestionValue === undefined) return suggestionValue ?? '';
          return '';
        })
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    );

    const manualTerms = (searchMetadata || '').trim();
    const merged = deduplicateNormalizedTerms([
      ...acceptedValues,
      ...(manualTerms ? [manualTerms] : []),
    ]).join(' | ');
    return merged.trim();
  };

  const handleSuggestionToggle = (key: string) => {
    setSelectedSuggestionFields(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleUseStorageSuggestion = () => {
    if (!aiStorageSuggestion) return;
    setStorageManualOverride(true);
    setShelfCode(aiStorageSuggestion.shelfCode);
    setShelf(aiStorageSuggestion.shelfCode);
    if (aiStorageSuggestion.boxNumber) {
      setBoxNumber(aiStorageSuggestion.boxNumber);
      setBox(aiStorageSuggestion.boxNumber);
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
            search_metadata: buildSearchMetadataFromSuggestions() || undefined,
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
      setFoundDate(formatLocalDate());
      setReceivedDate(formatLocalDate());
      setShelf('');
      setShelfCode('');
      setBox('');
      setBoxNumber('');
      setStorageManualOverride(false);
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

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageFile(null);
    setAiSuggestion(null);
    setSuggestionError(null);
    setAcceptedAiDescription(false);
    setSearchMetadata('');
    setSelectedSuggestionFields({});
  };

  const coreInfoReady = Boolean(description.trim() && campus && location.trim() && foundDate && receivedDate);
  const deliveryReady = Boolean(deliveredBy.trim());
  const storageLabel = shelfCode
    ? `${shelfCode}${boxNumber ? ` · Caixa ${boxNumber}` : ''}`
    : 'Ainda não definido';

  return (
    <MainLayout>
      <div className="relative isolate -m-2 overflow-hidden rounded-[28px] bg-gradient-to-br from-primary/[0.065] via-background/10 to-cyan-500/[0.045] p-2 sm:-m-3 sm:p-3">
        <div className="pointer-events-none absolute -left-40 top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-cyan-500/[0.07] blur-3xl" />

        <div className="relative space-y-5">
          <LostFoundModuleNav />

          <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/20 to-cyan-500/10 text-primary shadow-[0_0_30px_-10px_hsl(var(--primary)/0.8)]">
                <PackagePlus className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">Registro de achado</p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Registrar Novo Item</h1>
                <p className="mt-1 text-sm text-muted-foreground">Cadastre o item, defina o armazenamento e registre quem realizou a entrega.</p>
              </div>
            </div>

            <Button type="button" variant="outline" onClick={() => navigate('/lost-found/items')} className="h-10 gap-2 self-start rounded-xl lg:self-auto">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </section>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
              <div className="space-y-4">
                <Card className="overflow-hidden border-border/45 bg-card/70 shadow-[0_24px_70px_-52px_hsl(var(--primary)/0.85)] backdrop-blur-xl">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                        <Camera className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold">Foto do Item</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">A foto é obrigatória e ajuda na identificação e na busca futura.</p>
                      </div>
                    </div>

                    {imagePreview ? (
                      <div className="relative overflow-hidden rounded-2xl border border-border/45 bg-background/25">
                        <img src={imagePreview} alt="Preview do item encontrado" className="max-h-[420px] w-full object-contain" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={removeImage}
                          className="absolute right-3 top-3 h-9 w-9 rounded-xl shadow-lg"
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Remover foto</span>
                        </Button>
                        <div className="absolute bottom-3 left-3 rounded-lg border border-white/10 bg-black/55 px-2.5 py-1 text-[11px] text-white backdrop-blur-md">
                          Foto pronta para o cadastro
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-[270px] flex-col items-center justify-center rounded-2xl border border-dashed border-primary/25 bg-background/18 px-5 text-center transition hover:border-primary/45 hover:bg-primary/[0.025]">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.07] text-primary">
                          <Camera className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-semibold">Adicione uma foto do item encontrado</p>
                        <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">Use a câmera do dispositivo ou selecione uma imagem da galeria.</p>
                        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                          <label className="cursor-pointer">
                            <Button type="button" variant="outline" asChild className="h-10 rounded-xl border-primary/25 bg-primary/[0.035]">
                              <span>
                                <Camera className="mr-2 h-4 w-4" />
                                Abrir Câmera
                                <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
                              </span>
                            </Button>
                          </label>
                          <label className="cursor-pointer">
                            <Button type="button" variant="outline" asChild className="h-10 rounded-xl">
                              <span>
                                <ImageIcon className="mr-2 h-4 w-4" />
                                Galeria
                                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                              </span>
                            </Button>
                          </label>
                        </div>
                        <p className="mt-4 text-[11px] font-medium text-destructive">Foto obrigatória</p>
                      </div>
                    )}

                    {imageFile && (
                      <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/[0.035] p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                              <Sparkles className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Identificação inteligente</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">A imagem pode sugerir descrição, características e armazenamento.</p>
                            </div>
                          </div>
                          <Button type="button" variant="outline" size="sm" disabled={isAnalyzingImage} onClick={handleAnalyzeImage} className="rounded-xl border-primary/25">
                            {isAnalyzingImage ? (
                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analisando...</>
                            ) : (
                              <><Sparkles className="mr-2 h-4 w-4" />Analisar foto</>
                            )}
                          </Button>
                        </div>

                        {suggestionError && (
                          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-3 text-xs text-amber-200">{suggestionError}</div>
                        )}

                        {aiSuggestion && (
                          <div className="mt-4 space-y-3 border-t border-border/35 pt-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Dados reconhecidos</p>
                              <p className="mt-1 text-xs text-muted-foreground">Marque as informações que devem ajudar na busca do item após o cadastro.</p>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              {Object.entries({
                                item_type: aiSuggestion.item_type,
                                product_name: aiSuggestion.product_name,
                                model_variant: aiSuggestion.model_variant,
                                primary_color: aiSuggestion.primary_color,
                                secondary_color: aiSuggestion.secondary_color,
                                brand: aiSuggestion.brand,
                                material: aiSuggestion.material,
                                condition: aiSuggestion.condition,
                                storage_category: aiSuggestion.storage_category,
                              }).filter(([, value]) => !!value).map(([key, value]) => (
                                <label key={key} className="flex cursor-pointer items-start gap-2 rounded-xl border border-border/35 bg-background/20 p-2.5 text-xs transition hover:border-primary/25">
                                  <input type="checkbox" checked={!!selectedSuggestionFields[key]} onChange={() => handleSuggestionToggle(key)} className="mt-0.5 accent-primary" />
                                  <span className="leading-5">
                                    <span className="text-muted-foreground">
                                      {key === 'storage_category' ? 'Categoria: ' : key === 'primary_color' ? 'Cor: ' : key === 'secondary_color' ? 'Cor secundária: ' : key === 'brand' ? 'Marca: ' : key === 'material' ? 'Material: ' : key === 'condition' ? 'Condição: ' : key === 'product_name' ? 'Produto: ' : key === 'model_variant' ? 'Modelo/variante: ' : 'Tipo: '}
                                    </span>
                                    {String(value)}
                                  </span>
                                </label>
                              ))}
                            </div>

                            {aiSuggestion.features?.length > 0 && (
                              <SuggestionCheck label={`Características: ${aiSuggestion.features.join(', ')}`} checked={!!selectedSuggestionFields.features} onChange={() => handleSuggestionToggle('features')} />
                            )}
                            {aiSuggestion.visible_specs?.length > 0 && (
                              <SuggestionCheck label={`Especificações visíveis: ${aiSuggestion.visible_specs.join(', ')}`} checked={!!selectedSuggestionFields.visible_specs} onChange={() => handleSuggestionToggle('visible_specs')} />
                            )}
                            {aiSuggestion.distinguishing_features?.length > 0 && (
                              <SuggestionCheck label={`Detalhes distintivos: ${aiSuggestion.distinguishing_features.join(', ')}`} checked={!!selectedSuggestionFields.distinguishing_features} onChange={() => handleSuggestionToggle('distinguishing_features')} />
                            )}
                            {aiSuggestion.visible_text_safe?.length > 0 && (
                              <SuggestionCheck label={`Texto visível: ${aiSuggestion.visible_text_safe.join(', ')}`} checked={!!selectedSuggestionFields.visible_text_safe} onChange={() => handleSuggestionToggle('visible_text_safe')} />
                            )}

                            {aiSuggestion.description_suggestion && (
                              <div className="rounded-xl border border-border/35 bg-background/20 p-3">
                                <p className="text-xs font-semibold">Descrição sugerida</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{aiSuggestion.description_suggestion}</p>
                                <Button type="button" variant="secondary" size="sm" className="mt-3 rounded-lg" onClick={handleUseAiDescription} disabled={!!description.trim() || acceptedAiDescription}>
                                  Usar descrição
                                </Button>
                              </div>
                            )}

                            {aiStorageSuggestion && (
                              <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.045] p-3">
                                <div className="flex items-start gap-2">
                                  <Archive className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold">Sugestão de armazenamento</p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                      {aiStorageSuggestion.boxNumber
                                        ? `Prateleira ${aiStorageSuggestion.shelfCode} — ${aiStorageSuggestion.shelfLabel} · Caixa ${aiStorageSuggestion.boxNumber}`
                                        : `Prateleira ${aiStorageSuggestion.shelfCode} — ${aiStorageSuggestion.shelfLabel}`}
                                    </p>
                                    <Button type="button" variant="secondary" size="sm" className="mt-2 rounded-lg" onClick={handleUseStorageSuggestion} disabled={!!shelfCode && !!boxNumber}>
                                      Usar sugestão
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="rounded-xl border border-border/35 bg-background/20 p-3">
                              <Label htmlFor="searchMetadata" className="text-xs">Termos adicionais para busca</Label>
                              <Textarea
                                id="searchMetadata"
                                value={searchMetadata}
                                onChange={(event) => setSearchMetadata(event.target.value)}
                                rows={2}
                                className="mt-1.5 resize-none rounded-xl bg-background/25 text-xs"
                                placeholder="Ex: chaveiro vermelho, marca visível, detalhe na capa..."
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/45 bg-card/70 shadow-[0_24px_70px_-52px_hsl(var(--primary)/0.75)] backdrop-blur-xl">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-5 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Info className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold">Informações do Item</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">Descreva onde e quando o objeto foi encontrado.</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <Label htmlFor="description">Descrição do Item *</Label>
                        <Textarea
                          id="description"
                          placeholder="Ex: Carteira de couro marrom com documentos"
                          className="mt-1.5 resize-none rounded-xl bg-background/25"
                          rows={3}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          required
                        />
                      </div>

                      <div className="grid gap-5 md:grid-cols-2">
                        <div>
                          <Label htmlFor="campus">Campus *</Label>
                          <Select value={campus} onValueChange={(value) => setCampus(value as CampusEnum)} required>
                            <SelectTrigger id="campus" className="mt-1.5 h-10 rounded-xl bg-background/25">
                              <SelectValue placeholder="Selecione o campus" />
                            </SelectTrigger>
                            <SelectContent>
                              {campusOptions.map((campusOption) => (
                                <SelectItem key={campusOption} value={campusOption}>{campusOption}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="location">Local onde foi encontrado *</Label>
                          <Input
                            id="location"
                            placeholder="Ex: Refeitório - Mesa 12"
                            className="mt-1.5 h-10 rounded-xl bg-background/25"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <Label htmlFor="foundDate">Data encontrado *</Label>
                          <Input
                            id="foundDate"
                            type="date"
                            className="mt-1.5 h-10 rounded-xl bg-background/25"
                            value={foundDate}
                            onChange={(e) => setFoundDate(e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <Label htmlFor="receivedDate">Data recebido *</Label>
                          <Input
                            id="receivedDate"
                            type="date"
                            className="mt-1.5 h-10 rounded-xl bg-muted/30"
                            value={receivedDate}
                            readOnly
                            aria-readonly="true"
                            title="Preenchida automaticamente"
                            onChange={(e) => setReceivedDate(e.target.value)}
                            required
                          />
                          <p className="mt-1 text-[10px] text-muted-foreground">Preenchida automaticamente</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/45 bg-card/70 shadow-[0_24px_70px_-52px_hsl(var(--primary)/0.75)] backdrop-blur-xl">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-5 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                        <Archive className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold">Armazenamento</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">Defina onde o item ficará guardado até a retirada.</p>
                      </div>
                    </div>

                    {!storageManualOverride && aiStorageSuggestion && (
                      <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] px-3 py-2 text-xs text-emerald-200">
                        <Sparkles className="h-4 w-4 shrink-0" />
                        Armazenamento preenchido automaticamente com base no item e na ocupação atual.
                      </div>
                    )}

                    {(() => {
                      const campusConfig = storageConfig?.campuses.find(c => c.campus === campus);
                      const shelves = campusConfig?.shelves || [];
                      const selectedShelf = shelves.find(s => s.code === shelfCode);
                      const estante = shelfCode ? shelfCode.split('.')[0] : '';

                      return (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <Label>Estante</Label>
                            <Input value={estante} readOnly placeholder={campus ? 'Auto' : 'Selecione campus'} className="mt-1.5 h-10 rounded-xl bg-muted/30" />
                          </div>

                          <div>
                            <Label>Prateleira</Label>
                            <Select
                              value={shelfCode}
                              onValueChange={(value) => {
                                setShelfCode(value);
                                setShelf(value);
                                setBoxNumber('');
                                setBox('');
                                setStorageManualOverride(true);
                              }}
                              disabled={!campus || shelves.length === 0}
                            >
                              <SelectTrigger className="mt-1.5 h-10 rounded-xl bg-background/25">
                                <SelectValue placeholder={!campus ? 'Selecione campus' : shelves.length === 0 ? 'Nenhuma configurada' : 'Selecione'} />
                              </SelectTrigger>
                              <SelectContent>
                                {shelves.map(shelfItem => (
                                  <SelectItem key={shelfItem.id} value={shelfItem.code}>{shelfItem.code} ({shelfItem.label})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Nº da Caixa</Label>
                            <Select
                              value={boxNumber}
                              onValueChange={(value) => {
                                setBoxNumber(value);
                                setBox(value);
                                setStorageManualOverride(true);
                              }}
                              disabled={!selectedShelf || selectedShelf.boxes.length === 0}
                            >
                              <SelectTrigger className="mt-1.5 h-10 rounded-xl bg-background/25">
                                <SelectValue placeholder={!selectedShelf ? 'Selecione prat.' : selectedShelf.boxes.length === 0 ? 'Sem caixas' : 'Selecione'} />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedShelf?.boxes.map(boxItem => (
                                  <SelectItem key={boxItem.id} value={boxItem.label}>Caixa {boxItem.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="sealNumber">Nº do Lacre</Label>
                            <Input id="sealNumber" placeholder="Ex: LC-001234" className="mt-1.5 h-10 rounded-xl bg-background/25" value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} />
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card className="border-border/45 bg-card/70 shadow-[0_24px_70px_-52px_hsl(var(--primary)/0.75)] backdrop-blur-xl">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-5 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold">Quem está entregando o item</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">Registre quem encontrou ou trouxe o objeto ao setor.</p>
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <Label htmlFor="deliveredBy">Nome completo *</Label>
                        <Input id="deliveredBy" placeholder="Nome de quem encontrou/está entregando" className="mt-1.5 h-10 rounded-xl bg-background/25" value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="contact">Contato (telefone ou e-mail)</Label>
                        <Input id="contact" placeholder="(31) 99999-9999 ou e-mail" className="mt-1.5 h-10 rounded-xl bg-background/25" value={contact} onChange={(e) => setContact(e.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-col-reverse gap-2 rounded-2xl border border-border/45 bg-card/65 p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="ghost" onClick={() => navigate('/lost-found/items')} className="h-10 rounded-xl sm:min-w-28">Cancelar</Button>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="hidden text-xs text-muted-foreground lg:inline">Confira a foto e os dados antes de registrar.</span>
                    <Button type="submit" disabled={createLostItem.isPending || isOptimizingImage} className="h-10 min-w-44 rounded-xl bg-gradient-to-r from-primary to-violet-600 shadow-[0_12px_34px_-16px_hsl(var(--primary)/0.95)] hover:opacity-95">
                      {createLostItem.isPending || isOptimizingImage ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</>
                      ) : (
                        <><CheckCircle2 className="mr-2 h-4 w-4" />Registrar Item</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
                <Card className="border-border/45 bg-card/75 shadow-[0_24px_70px_-48px_hsl(var(--primary)/0.8)] backdrop-blur-xl">
                  <CardContent className="p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <h2 className="text-sm font-semibold">Resumo do Cadastro</h2>
                    </div>

                    {imagePreview ? (
                      <div className="mb-3 overflow-hidden rounded-xl border border-border/40 bg-background/20">
                        <img src={imagePreview} alt="Miniatura do item" className="h-32 w-full object-cover" />
                      </div>
                    ) : (
                      <div className="mb-3 flex h-24 items-center justify-center rounded-xl border border-dashed border-border/45 bg-background/15 text-muted-foreground">
                        <Camera className="h-5 w-5" />
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <SummaryItem icon={Camera} label="Foto" value={imageFile ? 'Adicionada' : 'Pendente'} caption={imageFile ? 'Imagem pronta para envio' : 'Obrigatória para registrar'} ready={Boolean(imageFile)} />
                      <SummaryItem icon={Info} label="Informações do item" value={coreInfoReady ? 'Preenchidas' : 'Em preenchimento'} caption={campus || 'Campus ainda não selecionado'} ready={coreInfoReady} />
                      <SummaryItem icon={CalendarDays} label="Data encontrada" value={formatDateLabel(foundDate)} caption={`Recebido em ${formatDateLabel(receivedDate)}`} ready={Boolean(foundDate && receivedDate)} />
                      <SummaryItem icon={Archive} label="Armazenamento" value={storageLabel} caption={sealNumber ? `Lacre ${sealNumber}` : 'Lacre não informado'} ready={Boolean(shelfCode)} />
                      <SummaryItem icon={UserRound} label="Entregue por" value={deliveredBy || 'Não informado'} caption={contact || 'Contato opcional'} ready={deliveryReady} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/25 bg-primary/[0.05] backdrop-blur-xl">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Cadastro inteligente</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Depois de adicionar a foto, use a análise inteligente para acelerar a descrição e receber uma sugestão de armazenamento.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {campus && location.trim() && (
                  <Card className="border-cyan-400/20 bg-cyan-500/[0.04] backdrop-blur-xl">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground">Encontrado em</p>
                          <p className="mt-0.5 text-sm font-semibold">{campus}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{location}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </aside>
            </div>
          </form>
        </div>
      </div>

      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="border-border/50 bg-card/95 text-center backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-300">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <DialogTitle className="text-center text-xl">Item registrado com sucesso</DialogTitle>
            <DialogDescription className="text-center">Use o código abaixo para localizar rapidamente este item no sistema.</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.07] px-6 py-4 shadow-[0_14px_36px_-22px_hsl(var(--primary)/0.9)]">
              <span className="font-mono text-3xl font-bold tracking-[0.12em] text-primary">{createdCode}</span>
              <Button type="button" variant="ghost" size="icon" onClick={handleCopyCode} className="h-9 w-9 rounded-xl">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Guarde este código para localizar o item.</p>
          </div>

          <Button onClick={handleCloseSuccessDialog} className="h-10 w-full rounded-xl bg-gradient-to-r from-primary to-violet-600">Ver Lista de Itens</Button>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function SuggestionCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border/35 bg-background/20 p-2.5 text-xs transition hover:border-primary/25">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 accent-primary" />
      <span className="leading-5">{label}</span>
    </label>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
  caption,
  ready,
}: {
  icon: typeof Camera;
  label: string;
  value: string;
  caption: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/20 p-3">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${ready ? 'border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-300' : 'border-border/45 bg-muted/20 text-muted-foreground'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{caption}</p>
        </div>
        {ready && <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />}
      </div>
    </div>
  );
}
