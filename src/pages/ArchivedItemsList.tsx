import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Archive,
  ArrowLeft,
  Building2,
  Calendar,
  FileDown,
  MapPin,
  Package,
  Search,
  Trash2,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { ContentState } from '@/components/layout/ContentState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArchivedLostItem,
  useArchivedLostItem,
  useArchivedLostItems,
  useDeleteArchivedLostItems,
} from '@/hooks/useArchivedLostItems';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { generatePdf } from '@/lib/pdfService';

type CampusEnum = Database['public']['Enums']['campus_enum'];

const campusOptions: CampusEnum[] = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

export default function ArchivedItemsList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const deleteArchivedItems = useDeleteArchivedLostItems();

  const [searchQuery, setSearchQuery] = useState('');
  const [campusFilter, setCampusFilter] = useState<CampusEnum | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedItem, setSelectedItem] = useState<ArchivedLostItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTargets, setDeleteTargets] = useState<ArchivedLostItem[]>([]);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data: selectedItemDetails } = useArchivedLostItem(selectedItem?.id);
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useArchivedLostItems(campusFilter);

  const allItems = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.items);
  }, [data?.pages]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (searchQuery) {
        const term = searchQuery.toLowerCase();
        const matches =
          item.code?.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term) ||
          item.found_location?.toLowerCase().includes(term) ||
          item.owner_name?.toLowerCase().includes(term) ||
          item.shelf?.toLowerCase().includes(term) ||
          item.box?.toLowerCase().includes(term);

        if (!matches) return false;
      }

      if (dateFrom || dateTo) {
        const archivedDate = item.archived_at ? parseISO(item.archived_at) : null;
        if (!archivedDate) return false;

        if (dateFrom && dateTo) {
          if (!isWithinInterval(archivedDate, {
            start: startOfDay(parseISO(dateFrom)),
            end: endOfDay(parseISO(dateTo)),
          })) return false;
        } else if (dateFrom && archivedDate < startOfDay(parseISO(dateFrom))) {
          return false;
        } else if (dateTo && archivedDate > endOfDay(parseISO(dateTo))) {
          return false;
        }
      }

      return true;
    });
  }, [allItems, dateFrom, dateTo, searchQuery]);

  useEffect(() => {
    if (!selectedItemDetails?.id) return;
    setSelectedItem(current =>
      current?.id === selectedItemDetails.id
        ? { ...current, ...selectedItemDetails }
        : current
    );
  }, [selectedItemDetails]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const clearFilters = () => {
    setSearchQuery('');
    setCampusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = Boolean(searchQuery || campusFilter !== 'all' || dateFrom || dateTo);

  const exportToPdf = async () => {
    if (!filteredItems.length) {
      toast({
        title: 'Nenhum item para exportar',
        description: 'Não há itens arquivados para gerar o PDF.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await generatePdf({
        title: 'Itens Arquivados - Achados e Perdidos',
        subtitle: `Total de itens: ${filteredItems.length}`,
        columns: [
          { header: 'Código', accessor: row => row.code || '-' },
          { header: 'Descrição', accessor: row => `${row.description?.substring(0, 30) || '-'}${row.description?.length > 30 ? '...' : ''}` },
          { header: 'Campus', accessor: row => row.campus || '-' },
          { header: 'Local', accessor: row => row.found_location || '-' },
          { header: 'Dono', accessor: row => row.owner_name || '-' },
          { header: 'Contato', accessor: row => row.owner_phone || row.owner_email || '-' },
          { header: 'Entrega', accessor: row => row.delivered_at ? format(new Date(row.delivered_at), 'dd/MM/yy', { locale: ptBR }) : '-' },
          { header: 'Arquivado', accessor: row => row.archived_at ? format(new Date(row.archived_at), 'dd/MM/yy', { locale: ptBR }) : '-' },
        ],
        data: filteredItems,
        orientation: 'landscape',
        filename: 'itens-arquivados',
      });

      toast({ title: 'PDF gerado', description: 'Arquivo baixado com sucesso.' });
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar PDF',
        description: error.message || 'Falha ao exportar o relatório.',
        variant: 'destructive',
      });
    }
  };

  const openDeleteConfirmation = (items: ArchivedLostItem[]) => {
    setDeleteTargets(items);
    setBackupConfirmed(false);
    setDeletePhrase('');
  };

  const closeDeleteConfirmation = () => {
    if (deleteArchivedItems.isPending) return;
    setDeleteTargets([]);
    setBackupConfirmed(false);
    setDeletePhrase('');
  };

  const confirmDelete = async () => {
    try {
      const summary = await deleteArchivedItems.mutateAsync(deleteTargets);
      setSelectedIds(current => {
        const next = new Set(current);
        deleteTargets.forEach(item => next.delete(item.id));
        return next;
      });

      if (selectedItem && deleteTargets.some(item => item.id === selectedItem.id)) {
        setSelectedItem(null);
      }

      toast({
        title: `${summary.itemsDeleted} ${summary.itemsDeleted === 1 ? 'item excluído' : 'itens excluídos'}`,
        description: `${summary.imagesRemoved} ${summary.imagesRemoved === 1 ? 'imagem removida' : 'imagens removidas'} · ${summary.imagesPreserved} ${summary.imagesPreserved === 1 ? 'imagem preservada' : 'imagens preservadas'}`,
      });
      closeDeleteConfirmation();
    } catch {
      toast({
        title: 'Não foi possível concluir a exclusão',
        description: 'Nenhum item fora da seleção foi alterado. Atualize a página e tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const selectedItems = allItems.filter(item => selectedIds.has(item.id));
  const visibleItemIds = useMemo(() => filteredItems.map(item => item.id), [filteredItems]);
  const selectedVisibleCount = useMemo(
    () => visibleItemIds.reduce((count, id) => count + (selectedIds.has(id) ? 1 : 0), 0),
    [selectedIds, visibleItemIds]
  );
  const allVisibleSelected = visibleItemIds.length > 0 && selectedVisibleCount === visibleItemIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const toggleAllVisible = useCallback((checked: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (checked) visibleItemIds.forEach(id => next.add(id));
      else visibleItemIds.forEach(id => next.delete(id));
      return next;
    });
  }, [visibleItemIds]);

  const requiresPhrase = deleteTargets.length > 5;
  const canConfirmDelete = backupConfirmed && (!requiresPhrase || deletePhrase === 'EXCLUIR');

  return (
    <MainLayout>
      <PageHeader
        title="Itens arquivados"
        description="Consulte o histórico de itens entregues que já saíram da operação ativa."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/lost-found/items')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            {isAdmin && selectedItems.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => openDeleteConfirmation(selectedItems)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir {selectedItems.length > 1 ? `(${selectedItems.length})` : ''}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportToPdf} disabled={!filteredItems.length}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </>
        }
      />

      <PageToolbar>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)_auto] xl:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="archived-search" className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="archived-search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Código, descrição, local, proprietário..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Campus</Label>
            <Select value={campusFilter} onValueChange={value => setCampusFilter(value as CampusEnum | 'all')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os campus</SelectItem>
                {campusOptions.map(campus => <SelectItem key={campus} value={campus}>{campus}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Arquivado de</Label>
            <DatePickerInput value={dateFrom} onChange={setDateFrom} placeholder="Data inicial" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Arquivado até</Label>
            <DatePickerInput value={dateTo} onChange={setDateTo} placeholder="Data final" />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="xl:mb-0.5"
          >
            Limpar
          </Button>
        </div>
      </PageToolbar>

      <div className="mb-3 flex flex-col gap-2 px-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{isLoading ? 'Carregando itens...' : `${filteredItems.length} ${filteredItems.length === 1 ? 'item carregado' : 'itens carregados'}`}</span>
          {hasNextPage && <span>Mais registros disponíveis</span>}
          {isAdmin && selectedItems.length > 0 && (
            <span className="font-medium text-foreground">{selectedItems.length} selecionado(s)</span>
          )}
        </div>

        {isAdmin && filteredItems.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2 font-medium text-foreground">
            <Checkbox
              aria-label="Selecionar todos os itens carregados"
              checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
              onCheckedChange={checked => toggleAllVisible(checked === true)}
            />
            Selecionar visíveis
          </label>
        )}
      </div>

      {isLoading ? (
        <ContentState loading title="Carregando itens arquivados" description="Buscando o histórico de registros." />
      ) : filteredItems.length === 0 ? (
        <ContentState
          icon={Archive}
          title="Nenhum item arquivado encontrado"
          description={hasActiveFilters ? 'Tente remover alguns filtros para ampliar a busca.' : 'Os itens arquivados aparecerão aqui após saírem da operação ativa.'}
          action={hasActiveFilters ? <Button variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button> : undefined}
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredItems.map(item => (
              <Card
                key={item.id}
                className="group cursor-pointer border-border/60 bg-card/65 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/85 hover:shadow-md"
                onClick={() => setSelectedItem(item)}
              >
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">{item.code}</span>
                        <span className="rounded-md border border-border/60 bg-muted/45 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Arquivado</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground">{item.description}</p>
                    </div>

                    {isAdmin && (
                      <div onClick={event => event.stopPropagation()}>
                        <Checkbox
                          aria-label={`Selecionar item ${item.code}`}
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={checked => setSelectedIds(current => {
                            const next = new Set(current);
                            if (checked) next.add(item.id);
                            else next.delete(item.id);
                            return next;
                          })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.campus}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.found_location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.archived_at ? `Arquivado em ${format(new Date(item.archived_at), 'dd/MM/yyyy', { locale: ptBR })}` : 'Data de arquivamento indisponível'}</span>
                    </div>
                    {item.owner_name && (
                      <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Entregue para {item.owner_name}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div ref={loadMoreRef} className="flex justify-center py-5">
            {hasNextPage && (
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
              </Button>
            )}
          </div>
        </>
      )}

      <Dialog open={!!selectedItem} onOpenChange={open => { if (!open) setSelectedItem(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4 text-primary" />
              Detalhes do item arquivado
            </DialogTitle>
            <DialogDescription>
              Registro histórico de {selectedItem?.code || 'item arquivado'}.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><p className="text-xs text-muted-foreground">Código</p><p className="mt-1 font-mono text-sm font-semibold">{selectedItem.code}</p></div>
                  <div><p className="text-xs text-muted-foreground">Campus</p><p className="mt-1 text-sm font-medium">{selectedItem.campus}</p></div>
                  <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Descrição</p><p className="mt-1 text-sm">{selectedItem.description}</p></div>
                  <div><p className="text-xs text-muted-foreground">Local encontrado</p><p className="mt-1 text-sm">{selectedItem.found_location}</p></div>
                  <div><p className="text-xs text-muted-foreground">Recebimento</p><p className="mt-1 text-sm">{selectedItem.received_date ? format(parseISO(selectedItem.received_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p></div>
                  {(selectedItem.shelf || selectedItem.box) && <>
                    <div><p className="text-xs text-muted-foreground">Estante</p><p className="mt-1 text-sm">{selectedItem.shelf || '-'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Caixa</p><p className="mt-1 text-sm">{selectedItem.box || '-'}</p></div>
                  </>}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entrega</p>
                  <p className="mt-2 text-sm font-medium">{selectedItem.owner_name || 'Sem proprietário informado'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedItem.owner_phone || selectedItem.owner_email || 'Sem contato'}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{selectedItem.delivered_at ? format(new Date(selectedItem.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data não informada'}</p>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Arquivamento</p>
                  <p className="mt-2 text-sm font-medium">{selectedItem.archived_by_name || 'Responsável não informado'}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{selectedItem.archived_at ? format(new Date(selectedItem.archived_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data não informada'}</p>
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-end border-t border-border/60 pt-4">
                  <Button variant="destructive" size="sm" onClick={() => openDeleteConfirmation([selectedItem])}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir definitivamente
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTargets.length > 0} onOpenChange={open => { if (!open) closeDeleteConfirmation(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTargets.length === 1
                ? 'Excluir item arquivado definitivamente?'
                : `Excluir ${deleteTargets.length} itens arquivados definitivamente?`}
            </DialogTitle>
            <DialogDescription>
              Esta ação remove permanentemente {deleteTargets.length === 1 ? 'o registro selecionado' : 'os registros selecionados'} e, quando seguro, as imagens relacionadas. Não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={backupConfirmed} onCheckedChange={checked => setBackupConfirmed(checked === true)} />
              <span>Confirmo que já gerei ou salvei o PDF/backup necessário.</span>
            </label>

            {requiresPhrase && (
              <div className="space-y-2">
                <Label htmlFor="archive-delete-phrase">Digite EXCLUIR para confirmar</Label>
                <Input
                  id="archive-delete-phrase"
                  value={deletePhrase}
                  onChange={event => setDeletePhrase(event.target.value)}
                  autoComplete="off"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteConfirmation} disabled={deleteArchivedItems.isPending}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={!canConfirmDelete || deleteArchivedItems.isPending}>
              {deleteArchivedItems.isPending ? 'Excluindo...' : 'Excluir definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
