import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
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
import { ArrowLeft, ClipboardList, Plus, Search, Eye, AlertTriangle } from 'lucide-react';
import { useShiftHandovers, type ShiftHandover } from '@/hooks/useShiftHandovers';
import { ShiftHandoverDetailsDialog } from '@/components/rooms/ShiftHandoverDetailsDialog';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

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
          <Eye className="h-4 w-4 mr-1" />
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link to="/rooms">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Passagem de Plantão</h1>
              <p className="text-muted-foreground">Histórico de passagens de turno</p>
            </div>
          </div>
          <Button asChild>
            <Link to="/rooms/shift-handover/new">
              <Plus className="mr-2 h-4 w-4" />
              Nova Passagem
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Passagens de Plantão
                </CardTitle>
                <Select value={shiftFilter} onValueChange={setShiftFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os turnos</SelectItem>
                    <SelectItem value="Manhã">Manhã</SelectItem>
                    <SelectItem value="Tarde">Tarde</SelectItem>
                    <SelectItem value="Noite">Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por colaborador, setor ou unidade..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 max-w-md"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Nenhum resultado encontrado' : 'Nenhuma passagem de plantão registrada'}
              </div>
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
