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
import { Archive, AlertTriangle, Loader2, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ArchiveDeliveredItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchiveDeliveredItemsDialog({ open, onOpenChange }: ArchiveDeliveredItemsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [itemsToArchive, setItemsToArchive] = useState<any[]>([]);

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

  const generatePdf = () => {
    if (itemsToArchive.length === 0) return;

    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Itens Arquivados - Achados e Perdidos', 14, 18);
    
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
    doc.text(`Total de itens: ${itemsToArchive.length}`, 14, 32);
    doc.text(`Data de geração: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 38);

    const tableData = itemsToArchive.map(item => [
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

    const fileName = `itens-arquivados-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
    doc.save(fileName);

    toast({
      title: 'PDF gerado',
      description: `Arquivo ${fileName} baixado com sucesso.`,
    });
  };

  const archiveItems = useMutation({
    mutationFn: async () => {
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
      const CHUNK_SIZE = 50;
      let archivedCount = 0;

      for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
        const chunk = validItems.slice(i, i + CHUNK_SIZE);
        
        // Prepare archive records
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

        if (archiveError) throw archiveError;

        // Delete from main table
        const chunkIds = chunk.map((item) => item.id);
        const { error: deleteError } = await supabase
          .from('lost_items')
          .delete()
          .in('id', chunkIds);

        if (deleteError) throw deleteError;
        archivedCount += chunk.length;
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
        user_name: userName,
        module: 'lost-items',
        action: 'archive',
        entity_id: null,
        entity_description: 'Arquivamento em lote',
        details: `Arquivou ${archivedCount} itens entregues (${dateRangeText})`,
      });

      return archivedCount;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      queryClient.invalidateQueries({ queryKey: ['lost-items-archive'] });
      toast({
        title: 'Itens arquivados',
        description: `${count} item(ns) entregue(s) foram arquivados com sucesso.`,
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
    setItemsToArchive([]);
    onOpenChange(false);
  };

  const handleContinue = () => {
    countAndFetchItems.mutate();
  };

  const handleConfirmArchive = () => {
    archiveItems.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Archive className="w-5 h-5" />
            Arquivar Itens Entregues
          </DialogTitle>
          <DialogDescription>
            {confirmStep 
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
              onClick={generatePdf}
              disabled={itemsToArchive.length === 0}
            >
              <FileDown className="w-4 h-4" />
              Exportar PDF ({itemsToArchive.length} itens)
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
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
          ) : (
            <Button 
              onClick={handleConfirmArchive}
              disabled={archiveItems.isPending || itemsToArchive.length === 0}
            >
              {archiveItems.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Arquivando...
                </>
              ) : itemsToArchive.length === 0 ? (
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
