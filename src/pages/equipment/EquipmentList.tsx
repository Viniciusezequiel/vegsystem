import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Search, Package, ArrowRight, Edit, Trash2 } from 'lucide-react';
import { useEquipmentList, useDeleteEquipment, Equipment } from '@/hooks/useEquipment';
import { useAuth } from '@/contexts/AuthContext';
import { PdfExportButton, PdfColumn, PdfFilter } from '@/components/ui/PdfExportButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const statusLabels = {
  available: { label: 'Disponível', variant: 'default' as const },
  borrowed: { label: 'Emprestado', variant: 'secondary' as const },
  maintenance: { label: 'Manutenção', variant: 'destructive' as const },
};

export default function EquipmentList() {
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState<string>('all');
  const { data: equipment, isLoading } = useEquipmentList(search);
  const deleteEquipment = useDeleteEquipment();
  const { isAdmin } = useAuth();

  const filteredEquipment = equipment?.filter(item => 
    campusFilter === 'all' || item.campus === campusFilter
  );

  const handleDelete = (id: string) => {
    deleteEquipment.mutate(id);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Patrimônios</h1>
            <p className="text-muted-foreground">Gerencie o inventário de equipamentos</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PdfExportButton
              title="Relatório de Equipamentos"
              filename="equipamentos"
              columns={[
                { header: 'Nome', accessor: 'name' },
                { header: 'Patrimônio', accessor: 'patrimony_code' },
                { header: 'Qtd. Total', accessor: (row) => String(row.quantity) },
                { header: 'Disponível', accessor: (row) => String(row.available_quantity) },
                { header: 'Campus', accessor: 'campus' },
                { header: 'Local', accessor: 'location' },
                { header: 'Status', accessor: (row) => statusLabels[row.status as keyof typeof statusLabels]?.label || row.status },
              ]}
              data={filteredEquipment || []}
              filters={[
                {
                  label: 'Campus',
                  key: 'campus',
                  options: [
                    { label: 'Campus I', value: 'Campus I' },
                    { label: 'Campus II', value: 'Campus II' },
                    { label: 'Campus IV', value: 'Campus IV' },
                    { label: 'Campus HUCM Adm', value: 'Campus HUCM Adm' },
                  ],
                },
                {
                  label: 'Status',
                  key: 'status',
                  options: [
                    { label: 'Disponível', value: 'available' },
                    { label: 'Emprestado', value: 'borrowed' },
                    { label: 'Manutenção', value: 'maintenance' },
                  ],
                },
              ]}
            />
            <Button asChild variant="outline">
              <Link to="/equipment/loans">
                <ArrowRight className="mr-2 h-4 w-4" />
                Empréstimos
              </Link>
            </Button>
            <Button asChild>
              <Link to="/equipment/register">
                <Plus className="mr-2 h-4 w-4" />
                Novo Equipamento
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Inventário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou patrimônio..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={campusFilter} onValueChange={setCampusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por campus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os campus</SelectItem>
                  <SelectItem value="Campus I">Campus I</SelectItem>
                  <SelectItem value="Campus II">Campus II</SelectItem>
                  <SelectItem value="Campus IV">Campus IV</SelectItem>
                  <SelectItem value="Campus HUCM Adm">Campus HUCM Adm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredEquipment?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum equipamento encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Patrimônio</TableHead>
                      <TableHead>Qtd. Total</TableHead>
                      <TableHead>Disponível</TableHead>
                      <TableHead>Campus</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEquipment?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.patrimony_code}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.available_quantity}</TableCell>
                        <TableCell>{item.campus}</TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell>
                          <Badge variant={statusLabels[item.status].variant}>
                            {statusLabels[item.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/equipment/loan/new?equipment=${item.id}`}>
                                Emprestar
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm">
                              <Link to={`/equipment/edit/${item.id}`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir o equipamento "{item.name}"?
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(item.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
