import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { MainLayout } from '@/components/layout/MainLayout';

const EmbeddedShell = ({ children }: { children?: import('react').ReactNode }) => <>{children}</>;
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { ArrowLeft, Eye, Pencil, Trash2, FileSpreadsheet, Search } from 'lucide-react';
import {
  useUberRequests,
  useUpdateUberRequest,
  useDeleteUberRequest,
  UBER_STATUS_LABELS,
  UBER_STATUS_ORDER,
  type UberRequest,
  type UberStatus,
} from '@/hooks/useUberRequests';
import { UberReceipt } from '@/components/uber/UberReceipt';
import { formatDateBR, formatDateTimeBR } from '@/lib/uberReceipt';

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
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (name && !r.requester_name.toLowerCase().includes(name.toLowerCase())) return false;
      if (date && r.trip_date !== date) return false;
      if (origin && !r.origin.toLowerCase().includes(origin.toLowerCase())) return false;
      if (destination && !r.destination.toLowerCase().includes(destination.toLowerCase())) return false;
      if (status !== ALL && r.status !== status) return false;
      if (q) {
        const blob = [r.code, r.requester_name, r.origin, r.destination, r.reason, r.notes ?? '']
          .join(' ')
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [requests, search, name, date, origin, destination, status]);

  const exportExcel = () => {
    const rows = filtered.map((r) => ({
      Código: r.code,
      Solicitante: r.requester_name,
      'Local de saída': r.origin,
      'Local de destino': r.destination,
      'Data da viagem': formatDateBR(r.trip_date),
      Horário: r.trip_time,
      Motivo: r.reason,
      Observações: r.notes ?? '',
      Status: UBER_STATUS_LABELS[r.status] ?? r.status,
      'Registrado em': formatDateTimeBR(r.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitações');
    XLSX.writeFile(wb, `historico-viagens-uber-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button variant="ghost" asChild className="mb-1 -ml-2">
              <Link to="/admin-module/uber">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Controle de Solicitações</h1>
            <p className="text-muted-foreground">{filtered.length} registro(s) encontrado(s).</p>
          </div>
          <Button onClick={exportExcel} variant="outline" className="transition-transform hover:-translate-y-0.5">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar histórico (Excel)
          </Button>
        </div>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Pesquisa geral (código, nome, origem, destino, motivo)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Input placeholder="Solicitante" value={name} onChange={(e) => setName(e.target.value)} />
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input placeholder="Local de saída" value={origin} onChange={(e) => setOrigin(e.target.value)} />
              <Input placeholder="Local de destino" value={destination} onChange={(e) => setDestination(e.target.value)} />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os status</SelectItem>
                  {UBER_STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {UBER_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
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
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.requester_name}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.origin}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.destination}</TableCell>
                    <TableCell>{formatDateBR(r.trip_date)}</TableCell>
                    <TableCell>{r.trip_time}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.reason}</TableCell>
                    <TableCell>
                      <Select
                        value={r.status}
                        onValueChange={(value) =>
                          updateRequest.mutate({ id: r.id, status: value as UberStatus })
                        }
                      >
                        <SelectTrigger className="h-8 w-[190px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UBER_STATUS_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>
                              {UBER_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setViewing(r)} title="Visualizar comprovante">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(r)} title="Editar solicitação">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(r)} title="Excluir registro">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      Nenhuma solicitação encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Comprovante</DialogTitle>
          </DialogHeader>
          {viewing && <UberReceipt data={viewing} showSuccess={false} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Editar solicitação</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              {(
                [
                  ['requester_name', 'Nome do solicitante', 'text'],
                  ['origin', 'Local de saída', 'text'],
                  ['destination', 'Local de destino', 'text'],
                  ['trip_date', 'Data da viagem', 'date'],
                  ['trip_time', 'Horário', 'time'],
                ] as const
              ).map(([key, label, type]) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    value={(editing[key] as string) ?? ''}
                    onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label>Motivo da viagem</Label>
                <Textarea
                  rows={3}
                  value={editing.reason}
                  onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Observações</Label>
                <Textarea
                  rows={2}
                  value={editing.notes ?? ''}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
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

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
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
