import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { Plus, Building, ClipboardCheck, ArrowRight, Trash2 } from 'lucide-react';
import { useRoomsList, useCreateRoom, useDeleteRoom } from '@/hooks/useRooms';
import { useAuth } from '@/contexts/AuthContext';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const roomSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  campus: z.enum(['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm']),
  building: z.string().min(1, 'Prédio é obrigatório'),
  floor: z.string().optional(),
  capacity: z.coerce.number().optional(),
  description: z.string().optional(),
});

type RoomFormData = z.infer<typeof roomSchema>;

export default function RoomsList() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: rooms, isLoading } = useRoomsList();
  const createRoom = useCreateRoom();
  const deleteRoom = useDeleteRoom();
  const { isAdmin } = useAuth();

  const form = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: '',
      campus: 'Campus I',
      building: '',
      floor: '',
      capacity: undefined,
      description: '',
    },
  });

  const onSubmit = async (data: RoomFormData) => {
    await createRoom.mutateAsync({
      name: data.name,
      campus: data.campus,
      building: data.building,
      floor: data.floor || null,
      capacity: data.capacity || null,
      description: data.description || null,
    });
    form.reset();
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteRoom.mutate(id);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Salas</h1>
            <p className="text-muted-foreground">Gerencie as salas e checklists</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PdfExportButton
              title="Relatório de Salas"
              filename="salas"
              columns={[
                { header: 'Nome', accessor: 'name' },
                { header: 'Campus', accessor: 'campus' },
                { header: 'Prédio', accessor: 'building' },
                { header: 'Andar', accessor: (row) => row.floor || '-' },
                { header: 'Capacidade', accessor: (row) => row.capacity ? String(row.capacity) : '-' },
              ]}
              data={rooms || []}
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
              ]}
            />
            <Button asChild variant="outline">
              <Link to="/rooms/checklists">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Ver Checklists
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/rooms/checklist/new">
                <ArrowRight className="mr-2 h-4 w-4" />
                Novo Checklist
              </Link>
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Sala
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Sala</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Sala *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Sala 101" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="campus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Campus *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Campus I">Campus I</SelectItem>
                              <SelectItem value="Campus II">Campus II</SelectItem>
                              <SelectItem value="Campus IV">Campus IV</SelectItem>
                              <SelectItem value="Campus HUCM Adm">Campus HUCM Adm</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="building"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prédio *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Bloco A" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="floor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Andar</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: 2º" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="capacity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Capacidade</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="Nº pessoas" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createRoom.isPending}>
                        {createRoom.isPending ? 'Salvando...' : 'Cadastrar'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Salas Cadastradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : rooms?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma sala cadastrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Campus</TableHead>
                      <TableHead>Prédio</TableHead>
                      <TableHead>Andar</TableHead>
                      <TableHead>Capacidade</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms?.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell className="font-medium">{room.name}</TableCell>
                        <TableCell>{room.campus}</TableCell>
                        <TableCell>{room.building}</TableCell>
                        <TableCell>{room.floor || '-'}</TableCell>
                        <TableCell>{room.capacity || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/rooms/checklist/new?room=${room.id}`}>
                                <ClipboardCheck className="h-4 w-4 mr-1" />
                                Checklist
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
                                      Tem certeza que deseja excluir a sala "{room.name}"?
                                      Todos os checklists associados serão excluídos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(room.id)}>
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
