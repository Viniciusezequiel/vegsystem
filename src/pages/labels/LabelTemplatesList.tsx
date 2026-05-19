import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLabelTemplates, useDeleteLabelTemplate } from '@/hooks/useLabelTemplates';
import { Plus, Pencil, Trash2, Printer, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function LabelTemplatesList() {
  const navigate = useNavigate();
  const { data: templates = [], isLoading } = useLabelTemplates();
  const del = useDeleteLabelTemplate();
  const { toast } = useToast();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Tag className="h-6 w-6 text-primary" />
              Modelos de Etiquetas
            </h1>
            <p className="text-muted-foreground text-sm">Crie modelos reutilizáveis e gere etiquetas a partir de planilhas.</p>
          </div>
          <Button onClick={() => navigate('/labels/new')}>
            <Plus className="h-4 w-4 mr-2" /> Novo modelo
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : templates.length === 0 ? (
          <Card className="p-10 text-center">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">Nenhum modelo cadastrado ainda.</p>
            <Button onClick={() => navigate('/labels/new')}>
              <Plus className="h-4 w-4 mr-2" /> Criar primeiro modelo
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Card key={t.id} className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold truncate">{t.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t.page_size} {t.orientation === 'portrait' ? 'retrato' : 'paisagem'} · {t.columns}×{t.rows} · {t.label_width}×{t.label_height}mm
                  </p>
                  <p className="text-xs text-muted-foreground">{t.fields?.length || 0} campo(s)</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => navigate(`/labels/generate/${t.id}`)}>
                    <Printer className="h-3.5 w-3.5 mr-1" /> Gerar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/labels/edit/${t.id}`)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O modelo "{t.name}" será removido permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            await del.mutateAsync(t.id);
                            toast({ title: 'Modelo excluído' });
                          }}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
