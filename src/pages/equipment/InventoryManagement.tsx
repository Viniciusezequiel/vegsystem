import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Package,
  ArrowLeftRight,
  FileDown,
  Upload,
  Search,
  History,
  Ban,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useEquipmentList, Equipment } from '@/hooks/useEquipment';
import {
  useInventoryMovements,
  useCreateTransfer,
  useCreateWriteOff,
  useUpdateExternalLoanAvailability,
  useBulkImportEquipment,
} from '@/hooks/useInventory';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Constants } from '@/integrations/supabase/types';
import * as XLSX from 'xlsx';

type CampusEnum = 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm';

export default function InventoryManagement() {
  const [search, setSearch] = useState('');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [writeOffDialogOpen, setWriteOffDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [importData, setImportData] = useState<any[]>([]);

  const { data: equipment, isLoading: equipmentLoading } = useEquipmentList(search);
  const { data: movements, isLoading: movementsLoading } = useInventoryMovements();
  const createTransfer = useCreateTransfer();
  const createWriteOff = useCreateWriteOff();
  const updateExternalLoan = useUpdateExternalLoanAvailability();
  const bulkImport = useBulkImportEquipment();

  // Transfer form state
  const [transferData, setTransferData] = useState({
    to_location: '',
    to_campus: '' as CampusEnum | '',
    reason: '',
    notes: '',
  });

  // Write-off form state
  const [writeOffData, setWriteOffData] = useState({
    reason: '',
    notes: '',
  });

  const handleTransfer = async () => {
    if (!selectedEquipment || !transferData.to_location || !transferData.to_campus) return;

    await createTransfer.mutateAsync({
      equipment_id: selectedEquipment.id,
      from_location: selectedEquipment.location,
      to_location: transferData.to_location,
      from_campus: selectedEquipment.campus,
      to_campus: transferData.to_campus,
      quantity: 1,
      reason: transferData.reason,
      notes: transferData.notes,
    });

    setTransferDialogOpen(false);
    setSelectedEquipment(null);
    setTransferData({ to_location: '', to_campus: '', reason: '', notes: '' });
  };

  const handleWriteOff = async () => {
    if (!selectedEquipment || !writeOffData.reason) return;

    await createWriteOff.mutateAsync({
      equipment_id: selectedEquipment.id,
      reason: writeOffData.reason,
      notes: writeOffData.notes,
    });

    setWriteOffDialogOpen(false);
    setSelectedEquipment(null);
    setWriteOffData({ reason: '', notes: '' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setImportData(data);
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (importData.length === 0) return;

    const formattedData = importData.map((row: any) => ({
      name: row['Nome'] || row['name'] || '',
      patrimony_code: String(row['Patrimônio'] || row['patrimony_code'] || row['Codigo'] || ''),
      location: row['Localização'] || row['location'] || '',
      campus: (row['Campus'] || row['campus'] || 'Campus I') as CampusEnum,
      quantity: Number(row['Quantidade'] || row['quantity'] || 1),
      category: row['Categoria'] || row['category'],
      description: row['Descrição'] || row['description'],
      allow_external_loan: row['Empréstimo Externo'] !== 'Não' && row['allow_external_loan'] !== false,
    }));

    await bulkImport.mutateAsync(formattedData);
    setImportDialogOpen(false);
    setImportData([]);
  };

  const handleToggleExternalLoan = async (id: string, currentValue: boolean) => {
    await updateExternalLoan.mutateAsync({ id, allow_external_loan: !currentValue });
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'transfer': return 'Transferência';
      case 'write_off': return 'Baixa';
      case 'import': return 'Importação';
      case 'adjustment': return 'Ajuste';
      default: return type;
    }
  };

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case 'transfer':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Transferência</Badge>;
      case 'write_off':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Baixa</Badge>;
      case 'import':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Importação</Badge>;
      case 'adjustment':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Ajuste</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Patrimônios</h1>
            <p className="text-muted-foreground">
              Controle de inventário, transferências e baixas
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Importar Patrimônios</DialogTitle>
                  <DialogDescription>
                    Faça upload de uma planilha Excel com os patrimônios
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Clique para selecionar ou arraste o arquivo
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Colunas esperadas: Nome, Patrimônio, Localização, Campus, Quantidade, Categoria
                      </p>
                    </label>
                  </div>

                  {importData.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {importData.length} itens encontrados
                      </p>
                      <div className="max-h-48 overflow-auto border rounded">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>Patrimônio</TableHead>
                              <TableHead>Campus</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importData.slice(0, 5).map((row: any, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{row['Nome'] || row['name']}</TableCell>
                                <TableCell>{row['Patrimônio'] || row['patrimony_code']}</TableCell>
                                <TableCell>{row['Campus'] || row['campus']}</TableCell>
                              </TableRow>
                            ))}
                            {importData.length > 5 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground">
                                  ... e mais {importData.length - 5} itens
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={importData.length === 0 || bulkImport.isPending}
                    >
                      {bulkImport.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>Importar {importData.length} itens</>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="inventory" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="w-4 h-4" />
              Inventário
            </TabsTrigger>
            <TabsTrigger value="movements" className="gap-2">
              <History className="w-4 h-4" />
              Movimentações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <CardTitle>Patrimônios Cadastrados</CardTitle>
                    <CardDescription>
                      Gerencie transferências, baixas e disponibilidade para empréstimo
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou patrimônio..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 w-full sm:w-[300px]"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {equipmentLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Patrimônio</TableHead>
                          <TableHead>Localização</TableHead>
                          <TableHead>Campus</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Emp. Externo</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {equipment?.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.patrimony_code}</TableCell>
                            <TableCell>{item.location}</TableCell>
                            <TableCell>{item.campus}</TableCell>
                            <TableCell>
                              {item.status === 'available' ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  Disponível
                                </Badge>
                              ) : item.status === 'borrowed' ? (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                                  Emprestado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-red-50 text-red-700">
                                  Baixa
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={(item as any).allow_external_loan ?? true}
                                onCheckedChange={() => handleToggleExternalLoan(item.id, (item as any).allow_external_loan ?? true)}
                                disabled={item.status === 'maintenance'}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedEquipment(item);
                                    setTransferDialogOpen(true);
                                  }}
                                  disabled={item.status === 'maintenance'}
                                >
                                  <ArrowLeftRight className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedEquipment(item);
                                    setWriteOffDialogOpen(true);
                                  }}
                                  disabled={item.status === 'maintenance'}
                                >
                                  <Ban className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {equipment?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              Nenhum patrimônio encontrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Movimentações</CardTitle>
                <CardDescription>
                  Transferências, baixas e importações realizadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {movementsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Patrimônio</TableHead>
                          <TableHead>De</TableHead>
                          <TableHead>Para</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Realizado por</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements?.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell>
                              {format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>{getMovementTypeBadge(movement.movement_type)}</TableCell>
                            <TableCell className="font-medium">
                              {movement.equipment?.name}
                              <span className="block text-xs text-muted-foreground">
                                {movement.equipment?.patrimony_code}
                              </span>
                            </TableCell>
                            <TableCell>
                              {movement.from_location && (
                                <span>
                                  {movement.from_location}
                                  {movement.from_campus && (
                                    <span className="block text-xs text-muted-foreground">
                                      {movement.from_campus}
                                    </span>
                                  )}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {movement.to_location && (
                                <span>
                                  {movement.to_location}
                                  {movement.to_campus && (
                                    <span className="block text-xs text-muted-foreground">
                                      {movement.to_campus}
                                    </span>
                                  )}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {movement.reason}
                            </TableCell>
                            <TableCell>{movement.performed_by_name}</TableCell>
                          </TableRow>
                        ))}
                        {movements?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              Nenhuma movimentação registrada
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Transfer Dialog */}
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Transferência</DialogTitle>
              <DialogDescription>
                Transferir {selectedEquipment?.name} ({selectedEquipment?.patrimony_code})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="text-muted-foreground">Local atual:</span>{' '}
                  <span className="font-medium">{selectedEquipment?.location}</span>
                  <span className="text-muted-foreground ml-2">({selectedEquipment?.campus})</span>
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Novo Local *</Label>
                <Input
                  placeholder="Ex: Sala 101"
                  value={transferData.to_location}
                  onChange={(e) => setTransferData({ ...transferData, to_location: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Novo Campus *</Label>
                <Select
                  value={transferData.to_campus}
                  onValueChange={(v) => setTransferData({ ...transferData, to_campus: v as CampusEnum })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o campus" />
                  </SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.campus_enum.map((campus) => (
                      <SelectItem key={campus} value={campus}>
                        {campus}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Motivo</Label>
                <Input
                  placeholder="Ex: Remanejamento de setor"
                  value={transferData.reason}
                  onChange={(e) => setTransferData({ ...transferData, reason: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Observações adicionais..."
                  value={transferData.notes}
                  onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleTransfer}
                  disabled={!transferData.to_location || !transferData.to_campus || createTransfer.isPending}
                >
                  {createTransfer.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Confirmar Transferência'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Write-off Dialog */}
        <Dialog open={writeOffDialogOpen} onOpenChange={setWriteOffDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Baixa</DialogTitle>
              <DialogDescription>
                Dar baixa em {selectedEquipment?.name} ({selectedEquipment?.patrimony_code})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm text-destructive">
                  ⚠️ Esta ação marcará o patrimônio como indisponível para uso e empréstimos.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Motivo da Baixa *</Label>
                <Select
                  value={writeOffData.reason}
                  onValueChange={(v) => setWriteOffData({ ...writeOffData, reason: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Depreciação/Fim de vida útil">Depreciação/Fim de vida útil</SelectItem>
                    <SelectItem value="Dano irreparável">Dano irreparável</SelectItem>
                    <SelectItem value="Furto/Roubo">Furto/Roubo</SelectItem>
                    <SelectItem value="Extravio">Extravio</SelectItem>
                    <SelectItem value="Doação">Doação</SelectItem>
                    <SelectItem value="Venda">Venda</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Detalhes adicionais sobre a baixa..."
                  value={writeOffData.notes}
                  onChange={(e) => setWriteOffData({ ...writeOffData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setWriteOffDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleWriteOff}
                  disabled={!writeOffData.reason || createWriteOff.isPending}
                >
                  {createWriteOff.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Confirmar Baixa'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
