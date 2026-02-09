import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, ImageIcon, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface BulkImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UploadResult {
  filename: string;
  code: string;
  status: 'success' | 'error' | 'not_found';
  message: string;
}

export function BulkImageUploadDialog({ open, onOpenChange }: BulkImageUploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));
    setFiles(imageFiles);
    setResults([]);
  };

  const extractCodeFromFilename = (filename: string): string => {
    // Remove extension and get the code
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    // Clean up the code - remove any non-alphanumeric characters except hyphens
    return nameWithoutExt.trim();
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);
    const uploadResults: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const code = extractCodeFromFilename(file.name);
      
      try {
        // Check if item with this code exists
        const { data: item, error: findError } = await supabase
          .from('lost_items')
          .select('id, code')
          .eq('code', code)
          .maybeSingle();

        if (findError) throw findError;

        if (!item) {
          uploadResults.push({
            filename: file.name,
            code,
            status: 'not_found',
            message: 'Item não encontrado com este código',
          });
          continue;
        }

        // Upload image to storage
        const fileExt = file.name.split('.').pop();
        const filePath = `${item.id}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('lost-items')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('lost-items')
          .getPublicUrl(filePath);

        // Update item with image URL
        const { error: updateError } = await supabase
          .from('lost_items')
          .update({ image_url: urlData.publicUrl })
          .eq('id', item.id);

        if (updateError) throw updateError;

        uploadResults.push({
          filename: file.name,
          code,
          status: 'success',
          message: 'Imagem vinculada com sucesso',
        });
      } catch (error) {
        uploadResults.push({
          filename: file.name,
          code,
          status: 'error',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }

      setProgress(((i + 1) / files.length) * 100);
    }

    setResults(uploadResults);
    setUploading(false);

    const successCount = uploadResults.filter(r => r.status === 'success').length;
    const notFoundCount = uploadResults.filter(r => r.status === 'not_found').length;
    const errorCount = uploadResults.filter(r => r.status === 'error').length;

    queryClient.invalidateQueries({ queryKey: ['lost-items'] });

    toast({
      title: 'Upload concluído',
      description: `${successCount} vinculada(s), ${notFoundCount} não encontrada(s), ${errorCount} erro(s)`,
    });
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      setResults([]);
      setProgress(0);
      onOpenChange(false);
    }
  };

  const getStatusIcon = (status: UploadResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'not_found':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Upload de Imagens em Lote
          </DialogTitle>
          <DialogDescription>
            Selecione imagens cujo nome do arquivo seja o código do item (ex: 123456.jpg)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* File Selection */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Selecionar Imagens
            </Button>
            {files.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {files.length} imagem(ns) selecionada(s)
              </p>
            )}
          </div>

          {/* Progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                Processando... {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="flex-1 overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Arquivo</th>
                    <th className="text-left p-2">Código</th>
                    <th className="text-left p-2">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">{getStatusIcon(result.status)}</td>
                      <td className="p-2 truncate max-w-[150px]" title={result.filename}>
                        {result.filename}
                      </td>
                      <td className="p-2 font-mono">{result.code}</td>
                      <td className="p-2 text-muted-foreground">{result.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              {results.length > 0 ? 'Fechar' : 'Cancelar'}
            </Button>
            {files.length > 0 && results.length === 0 && (
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Enviando...' : `Enviar ${files.length} imagem(ns)`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
