import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentState } from '@/components/layout/ContentState';
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
      <div className="space-y-5">
        <PageHeader
          title="Modelos de Etiquetas"
          description="Crie modelos reutilizáveis e gere etiquetas a partir de planilhas"
          actions={
            <Button onClick={() => navigate('/labels/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Novo modelo
            </Button>
          }
        />

        {isLoading ? (
          <ContentState
            loading
            title="Carregando modelos"
            description="Buscando os modelos de etiquetas cadastrados."
          />
        ) : templates.length === 0 ? (
          <ContentState
            icon={Tag}
            title="Nenhum modelo cadastrado"
            description="Crie seu primeiro modelo para começar a gerar etiquetas."
            action={
              <Button onClick={() => navigate('/labels/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Criar primeiro modelo
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <Card
                key={t.id}
                className="space-y-4 border-border/60 bg-card/65 p-4 transition-colors hover:border-primary/25 hover:bg-card/80"
              >
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Tag className="h-4 w-4" />
                    </div>
                    <h3 className="truncate font-semibold">{t.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.page_size} {t.orientation === 'portrait' ? 'retrato' : 'paisagem'} · {t.columns}×{t.rows} · {t.label_width}×{t.label_height}mm
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.fields?.length || 0} campo(s) configurado(s)</p>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
                  <Button size="sm" onClick={() => navigate(`/labels/generate/${t.id}`)}>
                    <Printer className="mr-1 h-3.5 w-3.5" />
                    Gerar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/labels/edit/${t.id}`)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Editar
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
