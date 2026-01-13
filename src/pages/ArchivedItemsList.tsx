import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Package, 
  MapPin, 
  Calendar, 
  Loader2, 
  Building2, 
  FileDown, 
  Archive,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useArchivedLostItems, ArchivedLostItem } from '@/hooks/useArchivedLostItems';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generatePdf } from '@/lib/pdfService';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];

const campusOptions: CampusEnum[] = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

export default function ArchivedItemsList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [campusFilter, setCampusFilter] = useState<CampusEnum | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedItem, setSelectedItem] = useState<ArchivedLostItem | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useArchivedLostItems(campusFilter);

  // Flatten all pages into a single array
  const allItems = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.items);
  }, [data?.pages]);

  const filteredItems = useMemo(() => {
    if (!allItems.length) return [];
    
    return allItems.filter(item => {
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
          item.code?.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.found_location?.toLowerCase().includes(searchLower) ||
          item.owner_name?.toLowerCase().includes(searchLower) ||
          item.shelf?.toLowerCase().includes(searchLower) ||
          item.box?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Date filter (based on archived_at)
      if (dateFrom || dateTo) {
        const archivedDate = item.archived_at ? parseISO(item.archived_at) : null;
        if (!archivedDate) return false;
        
        if (dateFrom && dateTo) {
          if (!isWithinInterval(archivedDate, { 
            start: startOfDay(parseISO(dateFrom)), 
            end: endOfDay(parseISO(dateTo)) 
          })) return false;
        } else if (dateFrom) {
          if (archivedDate < startOfDay(parseISO(dateFrom))) return false;
        } else if (dateTo) {
          if (archivedDate > endOfDay(parseISO(dateTo))) return false;
        }
      }

      return true;
    });
  }, [allItems, searchQuery, dateFrom, dateTo]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const exportToPdf = async () => {
    if (filteredItems.length === 0) {
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
          { header: 'Código', accessor: (row) => row.code || '-' },
          { header: 'Descrição', accessor: (row) => (row.description?.substring(0, 30) + (row.description?.length > 30 ? '...' : '')) || '-' },
          { header: 'Campus', accessor: (row) => row.campus || '-' },
          { header: 'Local', accessor: (row) => row.found_location || '-' },
          { header: 'Dono', accessor: (row) => row.owner_name || '-' },
          { header: 'Contato', accessor: (row) => row.owner_phone || row.owner_email || '-' },
          { header: 'Entrega', accessor: (row) => row.delivered_at ? format(new Date(row.delivered_at), 'dd/MM/yy', { locale: ptBR }) : '-' },
          { header: 'Arquivado', accessor: (row) => row.archived_at ? format(new Date(row.archived_at), 'dd/MM/yy', { locale: ptBR }) : '-' },
        ],
        data: filteredItems,
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

  const clearFilters = () => {
    setSearchQuery('');
    setCampusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = searchQuery || campusFilter !== 'all' || dateFrom || dateTo;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/lost-found/items')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Archive className="w-6 h-6 text-primary" />
                Itens Arquivados
              </h1>
              <p className="text-muted-foreground">
                Histórico de itens entregues arquivados
              </p>
            </div>
          </div>
          
          <Button variant="outline" size="sm" onClick={exportToPdf} disabled={filteredItems.length === 0}>
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-lg border p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Código, descrição, local..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Campus</Label>
              <Select value={campusFilter} onValueChange={(v) => setCampusFilter(v as CampusEnum | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Campus</SelectItem>
                  {campusOptions.map(campus => (
                    <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Arquivado de</Label>
              <DatePickerInput
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="Data inicial"
              />
            </div>

            <div className="space-y-2">
              <Label>Arquivado até</Label>
              <DatePickerInput
                value={dateTo}
                onChange={setDateTo}
                placeholder="Data final"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          {isLoading ? 'Carregando...' : `${filteredItems.length} item(ns) carregado(s)${hasNextPage ? ' (mais disponíveis)' : ''}`}
        </div>

        {/* Items list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum item arquivado encontrado</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    "bg-card rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-sm font-semibold text-primary">{item.code}</span>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">Arquivado</span>
                  </div>
                  
                  <p className="text-sm font-medium line-clamp-2 mb-3">{item.description}</p>
                  
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{item.campus}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="line-clamp-1">{item.found_location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Arquivado em {item.archived_at ? format(new Date(item.archived_at), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </span>
                    </div>
                    {item.owner_name && (
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        <span className="line-clamp-1">Entregue para: {item.owner_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {isFetchingNextPage && (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              )}
              {hasNextPage && !isFetchingNextPage && (
                <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
                  Carregar mais
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-primary" />
              Detalhes do Item Arquivado
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Código</Label>
                  <p className="font-mono font-semibold">{selectedItem.code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Campus</Label>
                  <p>{selectedItem.campus}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Descrição</Label>
                <p>{selectedItem.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Local Encontrado</Label>
                  <p>{selectedItem.found_location}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data de Recebimento</Label>
                  <p>{selectedItem.received_date ? format(parseISO(selectedItem.received_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                </div>
              </div>

              {(selectedItem.shelf || selectedItem.box) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Estante</Label>
                    <p>{selectedItem.shelf || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Caixa</Label>
                    <p>{selectedItem.box || '-'}</p>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Informações de Entrega</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Entregue para</Label>
                    <p>{selectedItem.owner_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Contato</Label>
                    <p>{selectedItem.owner_phone || selectedItem.owner_email || '-'}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <Label className="text-muted-foreground">Data da Entrega</Label>
                  <p>{selectedItem.delivered_at ? format(new Date(selectedItem.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Informações do Arquivamento</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Arquivado por</Label>
                    <p>{selectedItem.archived_by_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Data do Arquivamento</Label>
                    <p>{selectedItem.archived_at ? format(new Date(selectedItem.archived_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
