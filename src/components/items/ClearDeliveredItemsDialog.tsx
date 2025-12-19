import { useState } from 'react';
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
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Trash2, AlertTriangle, Loader2, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ClearDeliveredItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClearDeliveredItemsDialog({ open, onOpenChange }: ClearDeliveredItemsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState<any[]>([]);

  const countAndFetchItems = useMutation({
    mutationFn: async () => {
      // First get all delivered items
      const { data: allItems, error } = await supabase
        .from('lost_items')
        .select('*')
        .eq('status', 'delivered')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter by date range using delivered_at or created_at as fallback
      let filtered = allItems || [];
      
      if (dateFrom) {
        const fromDate = new Date(`${dateFrom}T00:00:00`);
        filtered = filtered.filter(item => {
          const itemDate = new Date(item.delivered_at || item.created_at);
          return itemDate >= fromDate;
        });
      }
      
      if (dateTo) {
        const toDate = new Date(`${dateTo}T23:59:59`);
        filtered = filtered.filter(item => {
          const itemDate = new Date(item.delivered_at || item.created_at);
          return itemDate <= toDate;
        });
      }

      return filtered;
    },
    onSuccess: (items) => {
      setItemsToDelete(items);
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

  const generatePdf = () => {
    if (itemsToDelete.length === 0) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Relatório de Itens Entregues', 14, 22);
    
    // Date range info
    doc.setFontSize(10);
    const dateRangeText = dateFrom && dateTo 
      ? `Período: ${format(new Date(dateFrom), 'dd/MM/yyyy')} até ${format(new Date(dateTo), 'dd/MM/yyyy')}`
      : dateFrom 
      ? `A partir de: ${format(new Date(dateFrom), 'dd/MM/yyyy')}`
      : dateTo 
      ? `Até: ${format(new Date(dateTo), 'dd/MM/yyyy')}`
      : 'Todos os itens entregues';
    doc.text(dateRangeText, 14, 30);
    doc.text(`Total de itens: ${itemsToDelete.length}`, 14, 36);
    doc.text(`Data de geração: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 42);

    // Table
    const tableData = itemsToDelete.map(item => [
      item.code || '-',
      item.description?.substring(0, 40) + (item.description?.length > 40 ? '...' : '') || '-',
      item.found_location || '-',
      item.owner_name || '-',
      item.owner_phone || item.owner_email || '-',
      item.delivered_at ? format(new Date(item.delivered_at), 'dd/MM/yyyy', { locale: ptBR }) : '-',
    ]);

    autoTable(doc, {
      head: [['Código', 'Descrição', 'Local Achado', 'Dono', 'Contato', 'Entrega']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Save
    const fileName = `itens-entregues-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
    doc.save(fileName);

    toast({
      title: 'PDF gerado',
      description: `Arquivo ${fileName} baixado com sucesso.`,
    });
  };

  const deleteItems = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      let query = supabase
        .from('lost_items')
        .delete()
        .eq('status', 'delivered');

      // Delete items by their IDs (since we already filtered them)
      const idsToDelete = itemsToDelete.map(item => item.id);
      
      const { error } = await supabase
        .from('lost_items')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      const dateRangeText = dateFrom && dateTo 
        ? `de ${format(new Date(dateFrom), 'dd/MM/yyyy')} até ${format(new Date(dateTo), 'dd/MM/yyyy')}`
        : dateFrom 
        ? `a partir de ${format(new Date(dateFrom), 'dd/MM/yyyy')}`
        : dateTo 
        ? `até ${format(new Date(dateTo), 'dd/MM/yyyy')}`
        : 'todos';

      await supabase.from('activity_logs').insert({
        user_id: user?.id || null,
        user_name: profile?.full_name || user?.email || 'Sistema',
        module: 'lost-items',
        action: 'delete',
        entity_id: null,
        entity_description: 'Limpeza em lote',
        details: `Excluiu ${itemsToDelete.length} itens entregues (${dateRangeText})`,
      });

      return itemsToDelete.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast({
        title: 'Itens excluídos',
        description: `${count} item(ns) entregue(s) foram excluídos com sucesso.`,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    setDateFrom('');
    setDateTo('');
    setConfirmStep(false);
    setItemsToDelete([]);
    onOpenChange(false);
  };

  const handleContinue = () => {
    countAndFetchItems.mutate();
  };

  const handleConfirmDelete = () => {
    deleteItems.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Limpar Itens Entregues
          </DialogTitle>
          <DialogDescription>
            {confirmStep 
              ? 'Exporte o PDF antes de excluir os itens.'
              : 'Selecione o período para excluir os itens já entregues do sistema.'}
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Período (data de cadastro/entrega)</Label>
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
                Deixe em branco para excluir todos os itens entregues.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertTriangle className="w-10 h-10 text-destructive shrink-0" />
              <div>
                <p className="font-semibold text-destructive">
                  {itemsToDelete.length} item(ns) será(ão) excluído(s)
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Exporte o PDF com os dados antes de excluir. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={generatePdf}
              disabled={itemsToDelete.length === 0}
            >
              <FileDown className="w-4 h-4" />
              Exportar PDF ({itemsToDelete.length} itens)
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {!confirmStep ? (
            <Button 
              variant="destructive" 
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
          ) : (
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
              disabled={deleteItems.isPending || itemsToDelete.length === 0}
            >
              {deleteItems.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : itemsToDelete.length === 0 ? (
                'Nenhum item encontrado'
              ) : (
                `Confirmar Exclusão`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
