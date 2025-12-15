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
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [itemsCount, setItemsCount] = useState<number | null>(null);

  const countItems = useMutation({
    mutationFn: async () => {
      let query = supabase
        .from('lost_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'delivered');

      if (dateFrom) {
        query = query.gte('delivered_at', `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte('delivered_at', `${dateTo}T23:59:59`);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    onSuccess: (count) => {
      setItemsCount(count);
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

  const deleteItems = useMutation({
    mutationFn: async () => {
      // Get user info for activity log
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

      if (dateFrom) {
        query = query.gte('delivered_at', `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte('delivered_at', `${dateTo}T23:59:59`);
      }

      const { error } = await query;
      if (error) throw error;

      // Log activity
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
        details: `Excluiu ${itemsCount} itens entregues (${dateRangeText})`,
      });

      return itemsCount;
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
    setItemsCount(null);
    onOpenChange(false);
  };

  const handleContinue = () => {
    countItems.mutate();
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
              ? 'Confirme a exclusão dos itens entregues.'
              : 'Selecione o período para excluir os itens já entregues do sistema.'}
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Período de entrega</Label>
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
          <div className="py-6">
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertTriangle className="w-10 h-10 text-destructive shrink-0" />
              <div>
                <p className="font-semibold text-destructive">
                  {itemsCount} item(ns) será(ão) excluído(s)
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Esta ação não pode ser desfeita. Todos os dados dos itens, incluindo imagens, serão removidos permanentemente.
                </p>
              </div>
            </div>
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
              disabled={countItems.isPending}
            >
              {countItems.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Contando...
                </>
              ) : (
                'Continuar'
              )}
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
              disabled={deleteItems.isPending || itemsCount === 0}
            >
              {deleteItems.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : itemsCount === 0 ? (
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
