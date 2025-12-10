import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Package, Send } from 'lucide-react';
import { useCreateMaterialRequest, MaterialRequestItem } from '@/hooks/useMaterialRequests';

export default function MaterialRequestForm() {
  const navigate = useNavigate();
  const createRequest = useCreateMaterialRequest();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [items, setItems] = useState<MaterialRequestItem[]>([
    { name: '', quantity: 1, description: '' }
  ]);

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, description: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof MaterialRequestItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validItems = items.filter(item => item.name.trim() !== '');
    if (validItems.length === 0) {
      return;
    }
    
    await createRequest.mutateAsync({
      title,
      description,
      items: validItems,
      priority,
    });
    
    navigate('/materials');
  };

  return (
    <MainLayout>
      <div className="page-header">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/materials')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h1 className="page-title">Nova Solicitação</h1>
        </div>
        <p className="page-subtitle">Solicite materiais para sua equipe</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Informações da Solicitação</CardTitle>
            <CardDescription>Preencha os dados da sua solicitação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Material de escritório"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição / Justificativa</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o motivo da solicitação..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Itens Solicitados</CardTitle>
                <CardDescription>Adicione os itens que você precisa</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex gap-4 items-start p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex-1 space-y-2">
                  <Label>Nome do Item *</Label>
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    placeholder="Ex: Caneta esferográfica azul"
                    required
                  />
                </div>
                <div className="w-24 space-y-2">
                  <Label>Qtd *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    required
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Observação</Label>
                  <Input
                    value={item.description || ''}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-7 text-destructive hover:text-destructive"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/materials')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createRequest.isPending} className="gap-2">
            <Send className="w-4 h-4" />
            {createRequest.isPending ? 'Enviando...' : 'Enviar Solicitação'}
          </Button>
        </div>
      </form>
    </MainLayout>
  );
}
