import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Check, X, Mail, Phone, Building, UserIcon, ArrowLeft, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExternalUserRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string;
  sector: string | null;
  user_type: string | null;
  approval_status: string;
  rejection_reason: string | null;
  approved_at: string | null;
  created_at: string;
}

export default function ExternalUsersApproval() {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const [users, setUsers] = useState<ExternalUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rejecting, setRejecting] = useState<ExternalUserRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actioning, setActioning] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('external_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar usuários externos');
    setUsers((data || []) as unknown as ExternalUserRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (u: ExternalUserRow) => {
    setActioning(u.id);
    const { error } = await supabase
      .from('external_users')
      .update({
        approval_status: 'approved',
        approved_by: profile?.user_id || null,
        approved_at: new Date().toISOString(),
        rejection_reason: null,
      } as never)
      .eq('id', u.id);
    setActioning(null);
    if (error) toast.error('Erro ao aprovar');
    else { toast.success(`${u.full_name} aprovado(a)!`); load(); }
  };

  const reject = async () => {
    if (!rejecting) return;
    setActioning(rejecting.id);
    const { error } = await supabase
      .from('external_users')
      .update({
        approval_status: 'rejected',
        rejection_reason: rejectReason || null,
      } as never)
      .eq('id', rejecting.id);
    setActioning(null);
    if (error) toast.error('Erro ao rejeitar');
    else {
      toast.success('Cadastro rejeitado');
      setRejecting(null);
      setRejectReason('');
      load();
    }
  };

  const filterBy = (status: string) => users.filter(u => {
    if (u.approval_status !== status) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.cpf.includes(q) ||
      (u.sector || '').toLowerCase().includes(q)
    );
  });

  const pending = filterBy('pending');
  const approved = filterBy('approved');
  const rejected = filterBy('rejected');

  const renderCard = (u: ExternalUserRow, opts?: { actions?: boolean; showRejection?: boolean }) => (
    <Card key={u.id}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{u.full_name}</h3>
              {u.user_type && <Badge variant="outline" className="text-[10px]">{u.user_type}</Badge>}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</span>
              {u.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {u.phone}</span>}
              <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> CPF: {u.cpf}</span>
              {u.sector && <span className="flex items-center gap-1"><Building className="h-3 w-3" /> {u.sector}</span>}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cadastrado em {format(parseISO(u.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            {opts?.showRejection && u.rejection_reason && (
              <p className="text-xs text-destructive">Motivo: {u.rejection_reason}</p>
            )}
          </div>
          {opts?.actions && (
            <div className="flex gap-2">
              <Button size="sm" disabled={actioning === u.id} onClick={() => approve(u)}>
                <Check className="h-3 w-3 mr-1" /> Aprovar
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" disabled={actioning === u.id}
                onClick={() => { setRejecting(u); setRejectReason(''); }}>
                <X className="h-3 w-3 mr-1" /> Rejeitar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-muted-foreground">Acesso restrito a administradores.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Aprovação de Clientes Externos</h1>
            <p className="text-sm text-muted-foreground">Gerencie cadastros do Portal do Cliente</p>
          </div>
        </div>

        <Input placeholder="Buscar por nome, e-mail, CPF..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />

        {loading ? (
          <div className="text-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        ) : (
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
              <TabsTrigger value="approved">Aprovados ({approved.length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejeitados ({rejected.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="space-y-2 mt-3">
              {pending.length === 0
                ? <p className="text-muted-foreground text-sm py-4">Nenhum cadastro pendente.</p>
                : pending.map(u => renderCard(u, { actions: true }))}
            </TabsContent>
            <TabsContent value="approved" className="space-y-2 mt-3">
              {approved.map(u => renderCard(u))}
            </TabsContent>
            <TabsContent value="rejected" className="space-y-2 mt-3">
              {rejected.map(u => renderCard(u, { showRejection: true }))}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={!!rejecting} onOpenChange={v => { if (!v) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar cadastro de {rejecting?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo (opcional, será mostrado ao cliente)</Label>
            <Textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Ex: Dados incompletos, fora do escopo de atendimento..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Voltar</Button>
            <Button variant="destructive" onClick={reject} disabled={!!actioning}>
              {actioning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
