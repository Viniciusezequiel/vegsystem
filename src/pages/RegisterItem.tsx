import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Upload, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RegisterItem() {
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
    
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Item registrado com sucesso!",
      description: "O código do item é AP-2024-006",
    });
    
    setIsSubmitting(false);
    setImagePreview(null);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Registrar Novo Item</h1>
        <p className="page-subtitle">Cadastre um item encontrado no sistema</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl">
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
                <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center bg-muted/30">
                  <Camera className="w-12 h-12 text-muted-foreground mb-3" />
                  <span className="text-sm text-muted-foreground">Clique para adicionar foto</span>
                  <span className="text-xs text-muted-foreground/60 mt-1">JPG, PNG até 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
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
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="location">Local onde foi encontrado *</Label>
                  <Input
                    id="location"
                    placeholder="Ex: Refeitório - Mesa 12"
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="foundDate">Data que foi encontrado *</Label>
                  <Input
                    id="foundDate"
                    type="date"
                    className="mt-1.5"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-section animate-fade-in" style={{ animationDelay: '200ms' }}>
              <h3 className="font-medium text-foreground mb-4">Quem está entregando</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="deliveredBy">Nome completo *</Label>
                  <Input
                    id="deliveredBy"
                    placeholder="Nome de quem encontrou/está entregando"
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact">Contato (telefone ou email) *</Label>
                  <Input
                    id="contact"
                    placeholder="(11) 99999-9999"
                    className="mt-1.5"
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <Button type="button" variant="outline">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
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
    </MainLayout>
  );
}
