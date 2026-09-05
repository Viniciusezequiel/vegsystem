import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  Eye,
  FileSpreadsheet,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { UberReceipt } from '@/components/uber/UberReceipt';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  UBER_STATUS_LABELS,
  UBER_STATUS_ORDER,
  useDeleteUberRequest,
  useUberRequests,
  useUpdateUberRequest,
  type UberRequest,
  type UberStatus,
} from '@/hooks/useUberRequests';
import { formatDateBR, formatDateTimeBR } from '@/lib/uberReceipt';

const EmbeddedShell = ({ children }: { children?: import('react').ReactNode }) => <>{children}</>;
const ALL = '__all__';

export default function UberControl({ embedded }: { embedded?: boolean } = {}) {
  const Shell = embedded ? EmbeddedShell : MainLayout;
  const { data: requests = [], isLoading } = useUberRequests();
  const updateRequest = useUpdateUberRequest();
  const deleteRequest = useDeleteUberRequest();

  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [viewing, setViewing] = useState<UberRequest | null>(null);
  const [editing, setEditing] = useState<UberRequest | null>(null);
  const [deleting, setDeleting] = useState<UberRequest | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter(request => {
      if (name && !request.requester_name.toLowerCase().includes(name.toLowerCase())) return false;
      if (date && request.trip_date !== date) return false;
      if (origin && !request.origin.toLowerCase().includes(origin.toLowerCase())) return false;
      if (destination && !request.destination.toLowerCase().includes(destination.toLowerCase())) return false;
      if (status !== ALL && request.status !== status) return false;
      if (query) {
        const searchable = [request.code, request.requester_name, request.origin, request.destination, request.reason, request.notes ?? '']
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
  }, [requests, search, name, date, origin, destination, status]);

  const hasFilters = Boolean(search || name || date || origin || destination || status !== ALL);

  const exportExcel = () => {
    const rows = filtered.map(request => ({
      Código: request.code,
      Solicitante: request.requester_name,
      'Local de saída': request.origin,
      'Local de destino': request.destination,
      'Data da viagem': formatDateBR(request.trip_date),
      Horário: request.trip_time,
      Motivo: request.reason,
      Observações: request.notes ?? '',
      Status: UBER_STATUS_LABELS[request.status] ?? request.status,
      'Registrado em': formatDateTimeBR(request.created_at),
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Solicitações');
    XLSX.writeFile(workbook, `historico-viagens-uber-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const clearFilters = () => {
    setSearch('');
    setName('');
    setDate('');
    setOrigin('');
    setDestination('');
    setStatus(ALL);
  };

  return (
    <Shell>
      <div className="space-y-4">
        {!embedded && (
          <PageHeader
            title="Controle de solicitações"
            description={`${filtered.length} registro(s) encontrado(s) no histórico de transporte.`}
            actions={
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin-module/uber">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Link>
                </Button>
                <Button onClick={exportExcel} variant="outline" size="sm">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Exportar Excel
                </Button>
              </>
            }
          />
        )}

        {embedded && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Controle de solicitações</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{filtered.length} registro(s) encontrado(s).</p>
            </div>
            <Button onClick={exportExcel} variant="outline" size="sm">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        )}

        <PageToolbar className="mb-0">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Pesquisa geral por código, nome, trajeto ou motivo..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <Input placeholder="Solicitante" value={name} onChange={event => setName(event.target.value)} />
              <Input type="date" value={date} onChange={event => setDate(event.target.value)} />
              <Input placeholder="Origem" value={origin} onChange={event => setOrigin(event.target.value)} />
              <Input placeholder="Destino" value={destination} onChange={event => setDestination(event.target.value)} />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os status</SelectItem>
                  {UBER_STATUS_ORDER.map(option => (
                    <SelectItem key={option} value={option}>{UBER_STATUS_LABELS[option]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>
              </div>
            )}
          </div>
        </PageToolbar>

        <Card className="overflow-hidden border-border/60 bg-card/65 shadow-sm">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/25 hover:bg-muted/25">
                  <TableHead>Código</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(request => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{request.code}</TableCell>
                    <TableCell className="font-medium">{request.requester_name}</TableCell>
                    <TableCell className="max-w-[170px] truncate">{request.origin}</TableCell>
                    <TableCell className="max-w-[170px] truncate">{request.destination}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateBR(request.trip_date)}</TableCell>
                    <TableCell>{request.trip_time}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">{request.reason}</TableCell>
                    <TableCell>
                      <Select
                        value={request.status}
                        onValueChange={value => updateRequest.mutate({ id: request.id, status: value as UberStatus })}
                      >
                        <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UBER_STATUS_ORDER.map(option => (
                            <SelectItem key={option} value={option}>{UBER_STATUS_LABELS[option]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setViewing(request)} title="Visualizar comprovante">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(request)} title="Editar solicitação">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(request)} title="Excluir registro">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <p className="text-sm font-medium">Nenhuma solicitação encontrada</p>
                      <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros para ampliar os resultados.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!viewing} onOpenChange={open => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl" onInteractOutside={event => event.preventDefault()}>
          <DialogHeader><DialogTitle>Comprovante</DialogTitle></DialogHeader>
          {viewing && <UberReceipt data={viewing} showSuccess={false} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-lg" onInteractOutside={event => event.preventDefault()}>
          <DialogHeader><DialogTitle>Editar solicitação</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              {(
                [
                  ['requester_name', 'Nome do solicitante', 'text'],
                  ['origin', 'Local de saída', 'text'],
                  ['destination', 'Local de destino', 'text'],
                  ['trip_date', 'Data da viagem', 'date'],
                  ['trip_time', 'Horário', 'time'],
                ] as const
              ).map(([key, label, type]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type={type}
                    value={(editing[key] as string) ?? ''}
                    onChange={event => setEditing({ ...editing, [key]: event.target.value })}
                  />
                </div>
              ))}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Motivo da viagem</Label>
                <Textarea rows={3} value={editing.reason} onChange={event => setEditing({ ...editing, reason: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Observações</Label>
                <Textarea rows={2} value={editing.notes ?? ''} onChange={event => setEditing({ ...editing, notes: event.target.value })} />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button
                  onClick={() => {
                    updateRequest.mutate(
                      {
                        id: editing.id,
                        requester_name: editing.requester_name,
                        origin: editing.origin,
                        destination: editing.destination,
                        trip_date: editing.trip_date,
                        trip_time: editing.trip_time,
                        reason: editing.reason,
                        notes: editing.notes,
                      },
                      { onSuccess: () => setEditing(null) }
                    );
                  }}
                >
                  Salvar alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              A solicitação {deleting?.code} será removida permanentemente do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) deleteRequest.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}
