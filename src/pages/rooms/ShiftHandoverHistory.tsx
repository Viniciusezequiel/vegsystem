import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { ContentState } from '@/components/layout/ContentState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardList, Plus, Search, Eye, AlertTriangle, X } from 'lucide-react';
import { useShiftHandovers, type ShiftHandover } from '@/hooks/useShiftHandovers';
import { ShiftHandoverDetailsDialog } from '@/components/rooms/ShiftHandoverDetailsDialog';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { RoomsModuleNav } from '@/components/rooms/RoomsModuleNav';

function useProfileName(userId: string) {
  return useQuery({
    queryKey: ['profile-name', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.full_name || null;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

function HandoverRow({ handover, onView }: { handover: ShiftHandover; onView: () => void }) {
  const { data: profileName, isLoading } = useProfileName(handover.filled_by);

  return (
    <TableRow>
      <TableCell className="font-medium">
        {format(parseISO(handover.handover_date), 'dd/MM/yyyy')}
      </TableCell>
      <TableCell>{handover.day_of_week}</TableCell>
      <TableCell>
        <Badge variant="outline">{handover.shift}</Badge>
      </TableCell>
      <TableCell>{handover.sector}</TableCell>
      <TableCell>{handover.unit}</TableCell>
      <TableCell>{isLoading ? '...' : profileName || handover.collaborator_name}</TableCell>
      <TableCell>{handover.collaborator_time}</TableCell>
      <TableCell>
        {handover.has_impact_incident && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Sim
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" onClick={onView}>
          <Eye className="mr-1 h-4 w-4" />
          Detalhes
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function ShiftHandoverHistory() {
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: handovers, isLoading } = useShiftHandovers(
    shiftFilter !== 'all' ? { shift: shiftFilter } : undefined
  );

  const filtered = useMemo(() => {
    if (!handovers) return [];
    if (!searchQuery.trim()) return handovers;
    const q = searchQuery.toLowerCase();
    return handovers.filter(h =>
      h.collaborator_name.toLowerCase().includes(q) ||
      h.sector.toLowerCase().includes(q) ||
      h.unit.toLowerCase().includes(q) ||
      h.day_of_week.toLowerCase().includes(q)
    );
  }, [handovers, searchQuery]);

  const hasFilters = searchQuery.trim().length > 0 || shiftFilter !== 'all';

  return (
    <MainLayout>
      <div className="space-y-6">
        <RoomsModuleNav />

        <PageHeader
          title="Passagem de Plantão"
          description="Histórico de passagens de turno"
          actions={
            <Button asChild>
              <Link to="/rooms/shift-handover/new">
                <Plus className="mr-2 h-4 w-4" />
                Nova Passagem
              </Link>
            </Button>
          }
        />

        <PageToolbar className="mb-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_190px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por colaborador, setor ou unidade..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={shiftFilter} onValueChange={setShiftFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por turno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os turnos</SelectItem>
                <SelectItem value="Manhã">Manhã</SelectItem>
                <SelectItem value="Tarde">Tarde</SelectItem>
                <SelectItem value="Noite">Noite</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setShiftFilter('all');
                }}
              >
                <X className="mr-1 h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>
        </PageToolbar>

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Passagens de Plantão
              <Badge variant="outline" className="ml-auto">
                {filtered.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ContentState
                loading
                title="Carregando passagens"
                description="Buscando o histórico mais recente."
              />
            ) : filtered.length === 0 ? (
              <ContentState
                icon={ClipboardList}
                title={searchQuery ? 'Nenhum resultado encontrado' : 'Nenhuma passagem registrada'}
                description={
                  hasFilters
                    ? 'Ajuste ou limpe os filtros para ampliar a busca.'
                    : 'As passagens de plantão registradas aparecerão aqui.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Dia</TableHead>
                      <TableHead>Turno</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Impacto</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(handover => (
                      <HandoverRow
                        key={handover.id}
                        handover={handover}
                        onView={() => setSelectedId(handover.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <ShiftHandoverDetailsDialog
          handoverId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </MainLayout>
  );
}
