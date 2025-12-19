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
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
      let query = supabase
        .from('lost_items')
        .select('*')
        .eq('status', 'delivered')
        .order('received_date', { ascending: false });

      // Filter by received_date (DATE column)
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

    const doc = new jsPDF('landscape');
    
    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Itens Entregues - Achados e Perdidos', 14, 18);
    
    // Date range info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const dateRangeText = dateFrom && dateTo 
      ? `Período (recebimento): ${format(new Date(dateFrom), 'dd/MM/yyyy')} até ${format(new Date(dateTo), 'dd/MM/yyyy')}`
      : dateFrom 
      ? `A partir de (recebimento): ${format(new Date(dateFrom), 'dd/MM/yyyy')}`
      : dateTo 
      ? `Até (recebimento): ${format(new Date(dateTo), 'dd/MM/yyyy')}`
      : 'Todos os itens entregues';
    doc.text(dateRangeText, 14, 26);
    doc.text(`Total de itens: ${itemsToDelete.length}`, 14, 32);
    doc.text(`Data de geração: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 38);

    // Table with more columns
    const tableData = itemsToDelete.map(item => [
      item.code || '-',
      item.description?.substring(0, 35) + (item.description?.length > 35 ? '...' : '') || '-',
      item.campus || '-',
      item.found_location || '-',
      item.shelf || '-',
      item.box || '-',
      item.received_date ? format(new Date(item.received_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '-',
      item.owner_name || '-',
      item.owner_phone || item.owner_email || '-',
      item.delivered_at ? format(new Date(item.delivered_at), 'dd/MM/yyyy', { locale: ptBR }) : '-',
    ]);

    autoTable(doc, {
      head: [['Código', 'Descrição', 'Campus', 'Local Achado', 'Estante', 'Caixa', 'Recebimento', 'Dono', 'Contato', 'Entrega']],
      body: tableData,
      startY: 44,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });

    // Footer with page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

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
      // Validate items to delete
      if (itemsToDelete.length === 0) {
        throw new Error('Nenhum item para excluir');
      }

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const idsToDelete = itemsToDelete
        .map((item) => item.id)
        .filter((id): id is string => typeof id === 'string' && UUID_RE.test(id));

      if (idsToDelete.length === 0) {
        throw new Error('Nenhum ID válido para excluir');
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

      // Deleta em lotes para evitar URL grande demais (Bad Request)
      const CHUNK_SIZE = 50;
      let deletedCount = 0;

      for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
        const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from('lost_items')
          .delete()
          .in('id', chunk);

        if (error) throw error;
        deletedCount += chunk.length;
      }

      const dateRangeText = dateFrom && dateTo 
        ? `de ${format(new Date(dateFrom), 'dd/MM/yyyy')} até ${format(new Date(dateTo), 'dd/MM/yyyy')}`
        : dateFrom 
        ? `a partir de ${format(new Date(dateFrom), 'dd/MM/yyyy')}`
        : dateTo 
        ? `até ${format(new Date(dateTo), 'dd/MM/yyyy')}`
        : 'todos';

      await supabase.from('activity_logs').insert({
        user_id: user.id,
        user_name: profile?.full_name || user.email || 'Sistema',
        module: 'lost-items',
        action: 'delete',
        entity_id: null,
        entity_description: 'Limpeza em lote',
        details: `Excluiu ${deletedCount} itens entregues (${dateRangeText})`,
      });

      return deletedCount;
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
