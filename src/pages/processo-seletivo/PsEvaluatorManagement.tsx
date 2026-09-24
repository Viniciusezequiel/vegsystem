import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FilterX,
  KeyRound,
  Loader2,
  LogIn,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePsEvent } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';

type Evaluator = {
  account_id: string;
  evaluator_name: string;
  username: string;
  role: 'coordinator' | 'subcoordinator';
  campus: string | null;
  building: string | null;
  floor: string | null;
  scope_type: string | null;
  scope_source: 'import' | 'manual' | null;
  active: boolean;
  last_login: string | null;
  scope_state: 'configured' | 'pending' | 'adjusted';
  scopes: EvaluatorScope[];
};

type EvaluatorScope = {
  id?: string;
  scope_type: 'event' | 'campus' | 'building' | 'floor';
  campus: string | null;
  building: string | null;
  floor: string | null;
  source?: 'import' | 'manual';
};

type ScopeDraft = Omit<EvaluatorScope, 'id' | 'source'>;

type LocationRow = {
  campus?: string | null;
  building?: string | null;
  floor?: string | null;
  participation_status?: string | null;
  manually_excluded?: boolean | null;
};

const emptyLocation = (): ScopeDraft => ({
  scope_type: 'building',
  campus: '',
  building: '',
  floor: '',
});

const roleLabel = (role: Evaluator['role']) =>
  role === 'coordinator' ? 'Coordenador' : 'Subcoordenador';

const maskedCpf = (value: string) =>
  value.length === 11 ? `***.***.***-${value.slice(-2)}` : 'CPF cadastrado';

const scopeLocationLabel = (scope: EvaluatorScope) =>
  [scope.campus, scope.building, scope.floor].filter(Boolean).join(' · ');

const scopeSummary = (item: Evaluator) => {
  if (item.scope_state === 'pending' || !item.scopes.length) return 'Escopo pendente';
  if (item.scopes.some(scope => scope.scope_type === 'event')) return 'Evento inteiro';
  if (item.scopes.length > 1) return `${item.scopes.length} locais`;
  return scopeLocationLabel(item.scopes[0]) || 'Escopo pendente';
};

const normalize = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const uniqueSorted = (values: Array<string | null | undefined>) =>
  [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

export default function PsEvaluatorManagement() {
  const { id: eventId } = useParams();
  const { data: event } = usePsEvent(eventId);

  const [items, setItems] = useState<Evaluator[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeTarget, setScopeTarget] = useState<Evaluator | null>(null);
  const [scopeMode, setScopeMode] = useState<'event' | 'locations'>('event');
  const [scopeDrafts, setScopeDrafts] = useState<ScopeDraft[]>([emptyLocation()]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'coordinator' | 'subcoordinator'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'inactive' | 'never' | 'adjusted'>('all');

  async function load() {
    if (!eventId) return;

    setLoading(true);

    const [accountsResult, scopesResult, locationsResult] = await Promise.all([
      (supabase as any).rpc('ps_admin_list_evaluator_accounts', { p_event_id: eventId }),
      (supabase as any).rpc('ps_admin_list_evaluator_scope_details', { p_event_id: eventId }),
      (supabase as any)
        .from('ps_event_collaborators')
        .select('campus,building,floor,participation_status,manually_excluded')
        .eq('event_id', eventId),
    ]);

    if (accountsResult.error || scopesResult.error) {
      toast.error('Não foi possível carregar a equipe de avaliação.');
    } else {
      const scopesByAccount = new Map<string, EvaluatorScope[]>(
        (scopesResult.data || []).map(
          (row: { account_id: string; scopes: EvaluatorScope[] }) => [
            row.account_id,
            row.scopes || [],
          ]
        )
      );

      setItems(
        (accountsResult.data || []).map((item: Evaluator) => ({
          ...item,
          scopes: scopesByAccount.get(item.account_id) || [],
        }))
      );
    }

    if (!locationsResult.error) {
      setLocations(
        (locationsResult.data || []).filter((row: LocationRow) =>
          !row.manually_excluded &&
          !['declined', 'replaced'].includes(String(row.participation_status || ''))
        )
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [eventId]);

  const runAction = async (
    name: string,
    params: Record<string, unknown>,
    success: string
  ) => {
    const { data, error } = await (supabase as any).rpc(name, params);

    if (error || data === false) {
      toast.error('Não foi possível concluir a ação.');
      return false;
    }

    toast.success(success);
    await load();
    return true;
  };

  function openScope(item: Evaluator) {
    setScopeTarget(item);

    const isWholeEvent = item.scopes.some(scope => scope.scope_type === 'event');

    setScopeMode(
      item.role === 'coordinator' || isWholeEvent
        ? 'event'
        : item.scopes.length
          ? 'locations'
          : 'locations'
    );

    setScopeDrafts(
      isWholeEvent || !item.scopes.length
        ? [emptyLocation()]
        : item.scopes.map(scope => ({
            scope_type: scope.scope_type === 'event' ? 'building' : scope.scope_type,
            campus: scope.campus || '',
            building: scope.building || '',
            floor: scope.floor || '',
          }))
    );
  }

  async function saveScope() {
    if (!scopeTarget) return;

    setSaving(true);

    const scopes = scopeMode === 'event'
      ? [{ scope_type: 'event', campus: null, building: null, floor: null }]
      : scopeDrafts;

    const invalid =
      scopeMode === 'locations' &&
      scopes.some(scope =>
        !scope.campus ||
        (['building', 'floor'].includes(scope.scope_type) && !scope.building) ||
        (scope.scope_type === 'floor' && !scope.floor)
      );

    if (invalid) {
      toast.error('Preencha os campos obrigatórios de todos os locais.');
      setSaving(false);
      return;
    }

    const duplicatedKeys = new Set<string>();
    let duplicated = false;

    for (const scope of scopes) {
      const key = [
        scope.scope_type,
        normalize(scope.campus),
        normalize(scope.building),
        normalize(scope.floor),
      ].join('|');

      if (duplicatedKeys.has(key)) {
        duplicated = true;
        break;
      }

      duplicatedKeys.add(key);
    }

    if (duplicated) {
      toast.error('Existem locais duplicados no escopo.');
      setSaving(false);
      return;
    }

    const success = await runAction(
      'ps_admin_replace_evaluator_scopes',
      {
        p_account_id: scopeTarget.account_id,
        p_scopes: scopes,
      },
      'Escopo atualizado.'
    );

    setSaving(false);

    if (success) {
      setScopeTarget(null);
    }
  }

  const summary = useMemo(() => {
    const pending = items.filter(item =>
      item.scope_state === 'pending' || !item.scopes.length
    );

    return {
      coordinators: items.filter(item => item.role === 'coordinator').length,
      subcoordinators: items.filter(item => item.role === 'subcoordinator').length,
      active: items.filter(item => item.active).length,
      inactive: items.filter(item => !item.active).length,
      pending: pending.length,
      adjusted: items.filter(item => item.scope_state === 'adjusted').length,
      neverLogged: items.filter(item => !item.last_login).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = normalize(search);

    return [...items]
      .filter(item => {
        if (roleFilter !== 'all' && item.role !== roleFilter) return false;

        const isPending = item.scope_state === 'pending' || !item.scopes.length;

        if (statusFilter === 'pending' && !isPending) return false;
        if (statusFilter === 'active' && !item.active) return false;
        if (statusFilter === 'inactive' && item.active) return false;
        if (statusFilter === 'never' && item.last_login) return false;
        if (statusFilter === 'adjusted' && item.scope_state !== 'adjusted') return false;

        if (!query) return true;

        const haystack = normalize([
          item.evaluator_name,
          item.username,
          roleLabel(item.role),
          ...item.scopes.map(scope => scopeLocationLabel(scope)),
        ].filter(Boolean).join(' '));

        return haystack.includes(query);
      })
      .sort((a, b) => {
        const aPending = a.scope_state === 'pending' || !a.scopes.length;
        const bPending = b.scope_state === 'pending' || !b.scopes.length;

        if (aPending !== bPending) return aPending ? -1 : 1;
        if (a.active !== b.active) return a.active ? -1 : 1;

        return String(a.evaluator_name || '').localeCompare(
          String(b.evaluator_name || ''),
          'pt-BR'
        );
      });
  }, [items, search, roleFilter, statusFilter]);

  const campusOptions = useMemo(
    () => uniqueSorted(locations.map(row => row.campus)),
    [locations]
  );

  const buildingOptionsFor = (campus: string) =>
    uniqueSorted(
      locations
        .filter(row => !campus || normalize(row.campus) === normalize(campus))
        .map(row => row.building)
    );

  const floorOptionsFor = (campus: string, building: string) =>
    uniqueSorted(
      locations
        .filter(row =>
          (!campus || normalize(row.campus) === normalize(campus)) &&
          (!building || normalize(row.building) === normalize(building))
        )
        .map(row => row.floor)
    );

  const portalUrl = `${window.location.origin}/ps/avaliador/${eventId}`;

  const copyPortalUrl = async () => {
    await navigator.clipboard.writeText(portalUrl);
    toast.success('Link do Portal de Avaliação copiado.');
  };

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const hasFilters =
    !!search ||
    roleFilter !== 'all' ||
    statusFilter !== 'all';

  if (!eventId) {
    return <div className="p-8 text-muted-foreground">Evento não informado.</div>;
  }

  return (
    <MainLayout>
      <div className="ps-module-modern">
        <PageHeader
          title="Equipe de Avaliação"
          description={
            event?.name
              ? `Acessos, escopos e situação dos avaliadores de ${event.name}.`
              : 'Gerencie acessos e escopos de coordenadores e subcoordenadores do evento.'
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-xl">
                <a href={portalUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir Portal
                </a>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => void copyPortalUrl()}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>

              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <Link to={`/admin-module/processo-seletivo/eventos/${eventId}`}>
                  Voltar ao evento
                </Link>
              </Button>
            </div>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi
            icon={<Users className="h-4 w-4" />}
            label="Coordenadores"
            value={summary.coordinators}
            helper="acesso ao evento inteiro"
          />

          <Kpi
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Subcoordenadores"
            value={summary.subcoordinators}
            helper="escopo por área de atuação"
          />

          <button
            type="button"
            className="text-left"
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          >
            <Kpi
              icon={<MapPin className="h-4 w-4" />}
              label="Escopos pendentes"
              value={summary.pending}
              helper={summary.pending ? 'precisam ser configurados' : 'todos configurados'}
              tone={summary.pending ? 'warning' : 'success'}
            />
          </button>

          <button
            type="button"
            className="text-left"
            onClick={() => setStatusFilter(statusFilter === 'never' ? 'all' : 'never')}
          >
            <Kpi
              icon={<LogIn className="h-4 w-4" />}
              label="Nunca acessaram"
              value={summary.neverLogged}
              helper="contas sem primeiro login"
              tone={summary.neverLogged ? 'warning' : 'success'}
            />
          </button>

          <Kpi
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Acessos ativos"
            value={summary.active}
            helper={summary.inactive ? `${summary.inactive} desativado(s)` : 'nenhum desativado'}
          />
        </div>

        {(summary.pending > 0 || summary.neverLogged > 0) && (
          <Card className="mt-4 rounded-2xl border-amber-500/20 bg-amber-500/[0.025]">
            <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Conferência antes do evento</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {[
                      summary.pending ? `${summary.pending} avaliador(es) ainda estão com escopo pendente.` : '',
                      summary.neverLogged ? `${summary.neverLogged} conta(s) ainda não acessaram o portal.` : '',
                    ].filter(Boolean).join(' ')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {summary.pending > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setStatusFilter('pending')}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Revisar escopos
                  </Button>
                )}

                {summary.neverLogged > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setStatusFilter('never')}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Ver sem acesso
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-4 overflow-hidden rounded-2xl border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="space-y-4 pb-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="text-base">Avaliadores provisionados</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pendências de escopo aparecem primeiro. Ajustes manuais ficam identificados.
                </p>
              </div>
              <Badge variant="secondary" className="w-fit rounded-full">
                {filteredItems.length} de {items.length}
              </Badge>
            </div>

            <div className="grid gap-2 xl:grid-cols-[minmax(300px,1fr)_220px_220px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Buscar por nome, CPF, campus, prédio ou andar..."
                  className="h-10 rounded-xl pl-10"
                />
              </div>

              <Select value={roleFilter} onValueChange={(value: any) => setRoleFilter(value)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as funções</SelectItem>
                  <SelectItem value="coordinator">Coordenadores</SelectItem>
                  <SelectItem value="subcoordinator">Subcoordenadores</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  <SelectItem value="pending">Escopo pendente</SelectItem>
                  <SelectItem value="active">Acesso ativo</SelectItem>
                  <SelectItem value="inactive">Acesso desativado</SelectItem>
                  <SelectItem value="never">Nunca acessou</SelectItem>
                  <SelectItem value="adjusted">Escopo ajustado manualmente</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl"
                disabled={!hasFilters}
                onClick={clearFilters}
              >
                <FilterX className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="border-y border-border/50 bg-muted/25 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {[
                      'Avaliador',
                      'Função',
                      'Área de atuação',
                      'Origem',
                      'Acesso',
                      'Último acesso',
                      '',
                    ].map(heading => (
                      <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                      </td>
                    </tr>
                  ) : filteredItems.map(item => {
                    const pendingScope =
                      item.scope_state === 'pending' ||
                      !item.scopes.length;

                    return (
                      <tr
                        key={item.account_id}
                        className={`transition-colors hover:bg-muted/15 ${pendingScope ? 'bg-amber-500/[0.018]' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{item.evaluator_name}</p>
                              {pendingScope && (
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-amber-500/25 text-[9px] text-amber-500"
                                >
                                  Escopo pendente
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                              {maskedCpf(item.username)}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <Badge variant={item.role === 'coordinator' ? 'default' : 'secondary'}>
                            {roleLabel(item.role)}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <Badge
                              variant={pendingScope ? 'destructive' : 'outline'}
                              className="whitespace-nowrap text-[10px]"
                            >
                              {scopeSummary(item)}
                            </Badge>

                            {item.scopes.length > 1 && (
                              <p
                                className="max-w-[360px] truncate text-[11px] text-muted-foreground"
                                title={item.scopes.map(scopeLocationLabel).join(' • ')}
                              >
                                {item.scopes.map(scopeLocationLabel).join(' • ')}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="text-[9px]">
                              {item.scope_source === 'manual' ? 'Manual' : 'Importação'}
                            </Badge>
                            {item.scope_state === 'adjusted' && (
                              <Badge
                                variant="outline"
                                className="border-primary/20 text-[9px] text-primary"
                              >
                                Ajustado
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <Badge variant={item.active ? 'default' : 'outline'}>
                            {item.active ? 'Ativo' : 'Desativado'}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">
                          {item.last_login ? (
                            <div>
                              <p className="text-xs">
                                {new Date(item.last_login).toLocaleDateString('pt-BR')}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {new Date(item.last_login).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-500/20 text-[9px] text-amber-500"
                            >
                              Nunca acessou
                            </Badge>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 rounded-lg ${pendingScope ? 'bg-amber-500/10 text-amber-500' : ''}`}
                              title="Ajustar escopo"
                              onClick={() => openScope(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              title="Redefinir senha para CPF"
                              onClick={() => {
                                if (window.confirm(
                                  `Redefinir a senha de ${item.evaluator_name} para o CPF cadastrado?`
                                )) {
                                  void runAction(
                                    'ps_admin_reset_evaluator_password',
                                    { p_account_id: item.account_id },
                                    'Senha redefinida para o CPF.'
                                  );
                                }
                              }}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              title={item.active ? 'Desativar acesso' : 'Ativar acesso'}
                              onClick={() => void runAction(
                                'ps_admin_set_evaluator_access',
                                {
                                  p_account_id: item.account_id,
                                  p_active: !item.active,
                                },
                                item.active
                                  ? 'Acesso desativado.'
                                  : 'Acesso ativado.'
                              )}
                            >
                              {item.active ? (
                                <XCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && !filteredItems.length && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center">
                        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/40" />
                        <p className="mt-2 text-sm font-semibold">
                          {items.length
                            ? 'Nenhum avaliador encontrado'
                            : 'Nenhum coordenador ou subcoordenador identificado'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {items.length
                            ? 'Ajuste os filtros para continuar.'
                            : 'Os avaliadores são provisionados a partir da equipe vinculada ao evento.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!scopeTarget}
        onOpenChange={open => !open && setScopeTarget(null)}
      >
        <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Ajustar área de atuação</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {scopeTarget?.evaluator_name} · {scopeTarget ? roleLabel(scopeTarget.role) : ''}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {locations.length > 0 && (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3">
                <div className="flex items-start gap-2">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold">
                      Locais detectados na equipe do evento
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      Use as opções sugeridas para manter campus, prédio e andar padronizados.
                      Se necessário, ainda é possível digitar um valor diferente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="scope-mode" className="text-xs text-muted-foreground">
                Tipo de acesso
              </Label>

              <select
                id="scope-mode"
                value={scopeMode}
                onChange={event =>
                  setScopeMode(event.target.value as 'event' | 'locations')
                }
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                disabled={scopeTarget?.role === 'coordinator'}
              >
                <option value="event">Evento inteiro</option>
                <option value="locations">Locais específicos</option>
              </select>

              {scopeTarget?.role === 'coordinator' && (
                <p className="text-[10px] text-muted-foreground">
                  Coordenadores sempre têm acesso ao evento inteiro.
                </p>
              )}
            </div>

            {scopeMode === 'event' ? (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm text-muted-foreground">
                Poderá visualizar e avaliar fiscais de todos os campus, prédios e andares deste evento.
              </div>
            ) : (
              <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                {scopeDrafts.map((draft, index) => {
                  const buildingOptions = buildingOptionsFor(draft.campus || '');
                  const floorOptions = floorOptionsFor(
                    draft.campus || '',
                    draft.building || ''
                  );

                  return (
                    <div
                      key={index}
                      className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">Local {index + 1}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Defina até onde este avaliador poderá enxergar.
                          </p>
                        </div>

                        {scopeDrafts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() =>
                              setScopeDrafts(current =>
                                current.filter((_, itemIndex) => itemIndex !== index)
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Abrangência
                          </Label>

                          <select
                            value={draft.scope_type}
                            onChange={event =>
                              setScopeDrafts(current =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        scope_type: event.target.value as ScopeDraft['scope_type'],
                                        building:
                                          event.target.value === 'campus'
                                            ? ''
                                            : item.building,
                                        floor:
                                          event.target.value !== 'floor'
                                            ? ''
                                            : item.floor,
                                      }
                                    : item
                                )
                              )
                            }
                            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="campus">Campus inteiro</option>
                            <option value="building">Prédio inteiro</option>
                            <option value="floor">Andar específico</option>
                          </select>
                        </div>

                        <SuggestedField
                          label="Campus"
                          value={draft.campus || ''}
                          options={campusOptions}
                          listId={`scope-campus-${index}`}
                          onChange={value =>
                            setScopeDrafts(current =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      campus: value,
                                      building:
                                        normalize(item.campus) === normalize(value)
                                          ? item.building
                                          : '',
                                      floor:
                                        normalize(item.campus) === normalize(value)
                                          ? item.floor
                                          : '',
                                    }
                                  : item
                              )
                            )
                          }
                        />

                        {draft.scope_type !== 'campus' && (
                          <SuggestedField
                            label="Prédio"
                            value={draft.building || ''}
                            options={buildingOptions}
                            listId={`scope-building-${index}`}
                            onChange={value =>
                              setScopeDrafts(current =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        building: value,
                                        floor:
                                          normalize(item.building) === normalize(value)
                                            ? item.floor
                                            : '',
                                      }
                                    : item
                                )
                              )
                            }
                          />
                        )}

                        {draft.scope_type === 'floor' && (
                          <SuggestedField
                            label="Andar"
                            value={draft.floor || ''}
                            options={floorOptions}
                            listId={`scope-floor-${index}`}
                            onChange={value =>
                              setScopeDrafts(current =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, floor: value }
                                    : item
                                )
                              )
                            }
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() =>
                    setScopeDrafts(current => [...current, emptyLocation()])
                  }
                  disabled={scopeDrafts.length >= 20}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar outro local
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setScopeTarget(null)}
            >
              Cancelar
            </Button>

            <Button
              className="rounded-xl"
              onClick={() => void saveScope()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="mr-2 h-4 w-4" />
              )}
              Salvar escopo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function Kpi({
  icon,
  label,
  value,
  helper,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value: number;
  helper?: string;
  tone?: 'default' | 'warning' | 'success';
}) {
  return (
    <Card
      className={`h-full rounded-2xl shadow-sm ${tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/[0.035]'
        : tone === 'success'
          ? 'border-emerald-500/20 bg-emerald-500/[0.025]'
          : 'border-border/60 bg-card/65'}`}
    >
      <CardContent className="flex h-full items-start gap-3 p-4">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone === 'warning'
            ? 'bg-amber-500/10 text-amber-500'
            : tone === 'success'
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-primary/10 text-primary'}`}
        >
          {icon}
        </div>

        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
          {helper && (
            <p className="mt-1 text-[10px] text-muted-foreground">{helper}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestedField({
  label,
  value,
  options,
  listId,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  listId: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        list={listId}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="rounded-xl"
        autoComplete="off"
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map(option => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </div>
  );
}
