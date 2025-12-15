import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { 
  History, 
  Search, 
  Loader2, 
  User, 
  Package, 
  Calendar as CalendarIcon, 
  Box,
  Settings,
  FileText,
  Building2
} from 'lucide-react';
import { useActivityLogs, getActionLabel, getModuleLabel } from '@/hooks/useActivityLogs';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const moduleOptions = [
  { value: 'all', label: 'Todos os Módulos', icon: Settings },
  { value: 'lost-items', label: 'Achados e Perdidos', icon: Package },
  { value: 'reservations', label: 'Reservas', icon: CalendarIcon },
  { value: 'equipment', label: 'Equipamentos', icon: Box },
  { value: 'lockers', label: 'Escaninhos', icon: Box },
  { value: 'materials', label: 'Materiais', icon: FileText },
  { value: 'users', label: 'Usuários', icon: User },
  { value: 'rooms', label: 'Salas', icon: Building2 },
];

const actionVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
  approve: 'default',
  reject: 'destructive',
  return: 'secondary',
  deliver: 'default',
  import: 'outline',
  export: 'outline',
};

export default function ActivityHistory() {
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const { data: logs, isLoading } = useActivityLogs({
    module: moduleFilter !== 'all' ? moduleFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: search || undefined,
  });

  const formatDateTime = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <History className="w-6 h-6" />
          Histórico de Atividades
        </h1>
        <p className="page-subtitle">Acompanhe todas as ações realizadas no sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário, descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                {moduleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="w-4 h-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 items-center">
              <DatePickerInput
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="De"
                className="w-[130px]"
              />
              <span className="text-muted-foreground">-</span>
              <DatePickerInput
                value={dateTo}
                onChange={setDateTo}
                placeholder="Até"
                className="w-[130px]"
              />
            </div>

            {(search || moduleFilter !== 'all' || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setModuleFilter('all');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Atividades Recentes</span>
            {logs && (
              <Badge variant="secondary">{logs.length} registro(s)</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-center py-16">
              <History className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">Nenhuma atividade encontrada</h3>
              <p className="text-muted-foreground mt-1">
                Ajuste os filtros ou aguarde novas ações no sistema
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="hidden lg:table-cell">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{log.user_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getModuleLabel(log.module)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionVariants[log.action] || 'default'}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {log.entity_description || '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[250px] truncate text-muted-foreground">
                        {log.details || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
