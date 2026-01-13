import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, AlertTriangle, Loader2, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generatePdf } from '@/lib/pdfService';

interface ArchiveDeliveredItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProgressState {
  current: number;
  total: number;
  processed: number;
}

export function ArchiveDeliveredItemsDialog({ open, onOpenChange }: ArchiveDeliveredItemsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [itemsToArchive, setItemsToArchive] = useState<any[]>([]);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const abortRef = useRef(false);

  const countAndFetchItems = useMutation({
    mutationFn: async () => {
      let query = supabase
        .from('lost_items')
        .select('*')
        .eq('status', 'delivered')
        .order('received_date', { ascending: false });

      if (dateFrom) {
        query = query.gte('received_date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('received_date', dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    onSuccess: (items) => {
      setItemsToArchive(items);
      setConfirmStep(true);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleGeneratePdf = async () => {
    if (itemsToArchive.length === 0) return;

    try {
      const dateRangeText = dateFrom && dateTo 
        ? `Período (recebimento): ${format(new Date(dateFrom), 'dd/MM/yyyy')} até ${format(new Date(dateTo), 'dd/MM/yyyy')}`
        : dateFrom 
        ? `A partir de (recebimento): ${format(new Date(dateFrom), 'dd/MM/yyyy')}`
        : dateTo 
        ? `Até (recebimento): ${format(new Date(dateTo), 'dd/MM/yyyy')}`
        : 'Todos os itens entregues';

      await generatePdf({
        title: 'Relatório de Itens Arquivados - Achados e Perdidos',
        subtitle: `${dateRangeText} | Total de itens: ${itemsToArchive.length}`,
        columns: [
          { header: 'Código', accessor: (row) => row.code || '-' },
          { header: 'Descrição', accessor: (row) => (row.description?.substring(0, 35) + (row.description?.length > 35 ? '...' : '')) || '-' },
          { header: 'Campus', accessor: (row) => row.campus || '-' },
          { header: 'Local Achado', accessor: (row) => row.found_location || '-' },
          { header: 'Estante', accessor: (row) => row.shelf || '-' },
          { header: 'Caixa', accessor: (row) => row.box || '-' },
          { header: 'Recebimento', accessor: (row) => row.received_date ? format(new Date(row.received_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '-' },
          { header: 'Dono', accessor: (row) => row.owner_name || '-' },
          { header: 'Contato', accessor: (row) => row.owner_phone || row.owner_email || '-' },
          { header: 'Entrega', accessor: (row) => row.delivered_at ? format(new Date(row.delivered_at), 'dd/MM/yyyy', { locale: ptBR }) : '-' },
        ],
        data: itemsToArchive,
        orientation: 'landscape',
        filename: 'itens-arquivados',
      });

      toast({
        title: 'PDF gerado',
        description: 'Arquivo baixado com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar PDF',
        description: error.message || 'Falha ao exportar o relatório.',
        variant: 'destructive',
      });
    }
  };

  const archiveItems = useMutation({
    mutationFn: async () => {
      abortRef.current = false;
      
      if (itemsToArchive.length === 0) {
        throw new Error('Nenhum item para arquivar');
      }

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validItems = itemsToArchive.filter(
        (item) => typeof item.id === 'string' && UUID_RE.test(item.id)
      );

      if (validItems.length === 0) {
        throw new Error('Nenhum item válido para arquivar');
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) {
        throw new Error('Usuário não autenticado');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const userName = profile?.full_name || user.email || 'Sistema';
      const CHUNK_SIZE = 100; // Larger chunks for speed
      const totalChunks = Math.ceil(validItems.length / CHUNK_SIZE);
      let archivedCount = 0;
      const errors: string[] = [];

      setProgress({ current: 0, total: totalChunks, processed: 0 });

      // Process chunks with concurrency limit of 3
      const CONCURRENCY = 3;
      const chunks: any[][] = [];
      for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
        chunks.push(validItems.slice(i, i + CHUNK_SIZE));
      }

      const processChunk = async (chunk: any[], chunkIndex: number): Promise<number> => {
        if (abortRef.current) return 0;

        const archiveRecords = chunk.map((item) => ({
          original_id: item.id,
          code: item.code,
          description: item.description,
          image_url: item.image_url,
          campus: item.campus,
          found_location: item.found_location,
          found_date: item.found_date,
          received_date: item.received_date,
          delivered_by_name: item.delivered_by_name,
          delivered_by_contact: item.delivered_by_contact,
          delivered_by_team_member: item.delivered_by_team_member,
          owner_name: item.owner_name,
          owner_phone: item.owner_phone,
          owner_email: item.owner_email,
          owner_signature: item.owner_signature,
          status: item.status,
          delivered_at: item.delivered_at,
          registered_by: item.registered_by,
          shelf: item.shelf,
          box: item.box,
          seal_number: item.seal_number,
          created_at: item.created_at,
          updated_at: item.updated_at,
          archived_by: user.id,
          archived_by_name: userName,
        }));

        // Insert into archive
        const { error: archiveError } = await supabase
          .from('lost_items_archive')
          .insert(archiveRecords);

        if (archiveError) {
          throw new Error(`Inserção: ${archiveError.message}`);
        }

        // Delete from main table
        const chunkIds = chunk.map((item) => item.id);
        const { error: deleteError } = await supabase
          .from('lost_items')
          .delete()
          .in('id', chunkIds);

        if (deleteError) {
          throw new Error(`Exclusão: ${deleteError.message}`);
        }

        return chunk.length;
      };

      // Process in batches with concurrency
      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        if (abortRef.current) break;

        const batch = chunks.slice(i, i + CONCURRENCY);
        const batchPromises = batch.map((chunk, idx) => 
          processChunk(chunk, i + idx)
            .then(count => {
              archivedCount += count;
              setProgress(prev => prev ? {
                ...prev,
                current: Math.min(prev.current + 1, prev.total),
                processed: archivedCount,
              } : null);
              return count;
            })
            .catch(err => {
              errors.push(`Lote ${i + idx + 1}: ${err.message}`);
              setProgress(prev => prev ? {
                ...prev,
                current: Math.min(prev.current + 1, prev.total),
              } : null);
              return 0;
            })
        );

        await Promise.all(batchPromises);
      }

      if (archivedCount === 0 && errors.length > 0) {
        throw new Error(`Falha ao arquivar: ${errors[0]}`);
      }

      const dateRangeText = dateFrom && dateTo 
        ? `de ${format(new Date(dateFrom), 'dd/MM/yyyy')} até ${format(new Date(dateTo), 'dd/MM/yyyy')}`
        : dateFrom 
        ? `a partir de ${format(new Date(dateFrom), 'dd/MM/yyyy')}`
        : dateTo 
        ? `até ${format(new Date(dateTo), 'dd/MM/yyyy')}`
        : 'todos';

      // Log activity (non-blocking)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        user_name: userName,
        module: 'lost-items',
        action: 'archive',
        entity_id: null,
        entity_description: 'Arquivamento em lote',
        details: `Arquivou ${archivedCount} itens entregues (${dateRangeText})${errors.length > 0 ? ` - ${errors.length} lote(s) com erro` : ''}`,
      });

      return { archivedCount, errors };
    },
    onSuccess: ({ archivedCount, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      queryClient.invalidateQueries({ queryKey: ['lost-items-archive'] });
      
      if (errors.length > 0) {
        toast({
          title: 'Arquivamento parcial',
          description: `${archivedCount} item(ns) arquivado(s). ${errors.length} lote(s) falharam.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Itens arquivados',
          description: `${archivedCount} item(ns) entregue(s) foram arquivados com sucesso.`,
        });
      }
      handleClose();
    },
    onError: (error: Error) => {
      setProgress(null);
      toast({
        title: 'Erro',
        description: error.message || 'Erro de conexão. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    abortRef.current = true;
    setDateFrom('');
    setDateTo('');
    setConfirmStep(false);
    setItemsToArchive([]);
    setProgress(null);
    onOpenChange(false);
  };

  const handleContinue = () => {
    countAndFetchItems.mutate();
  };

  const handleConfirmArchive = () => {
    archiveItems.mutate();
  };

  const progressPercent = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Archive className="w-5 h-5" />
            Arquivar Itens Entregues
          </DialogTitle>
          <DialogDescription>
            {progress 
              ? 'Arquivando itens...'
              : confirmStep 
              ? 'Os itens serão movidos para o arquivo. Você poderá consultá-los depois.'
              : 'Selecione o período para arquivar os itens já entregues.'}
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Período (data de recebimento)</Label>
              <div className="flex gap-2 items-center">
                <DatePickerInput
                  value={dateFrom}
                  onChange={setDateFrom}
                  placeholder="De"
                  className="flex-1"
                />
                <span className="text-muted-foreground">-</span>
                <DatePickerInput
                  value={dateTo}
                  onChange={setDateTo}
                  placeholder="Até"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe em branco para arquivar todos os itens entregues.
              </p>
            </div>
          </div>
        ) : progress ? (
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Lote {progress.current} de {progress.total}</span>
                <span>{progress.processed} itens processados</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <AlertTriangle className="w-10 h-10 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-primary">
                  {itemsToArchive.length} item(ns) será(ão) arquivado(s)
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Os itens serão movidos para o arquivo histórico e removidos da lista principal.
                </p>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={handleGeneratePdf}
              disabled={itemsToArchive.length === 0}
            >
              <FileDown className="w-4 h-4" />
              Exportar PDF ({itemsToArchive.length} itens)
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={archiveItems.isPending}>
            {archiveItems.isPending ? 'Cancelar' : 'Fechar'}
          </Button>
          {!confirmStep ? (
            <Button 
              onClick={handleContinue}
              disabled={countAndFetchItems.isPending}
            >
              {countAndFetchItems.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Carregando...
                </>
              ) : (
                'Continuar'
              )}
            </Button>
          ) : !progress && (
            <Button 
              onClick={handleConfirmArchive}
              disabled={archiveItems.isPending || itemsToArchive.length === 0}
            >
              {itemsToArchive.length === 0 ? (
                'Nenhum item encontrado'
              ) : (
                `Confirmar Arquivamento`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
