import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useReservationRooms } from '@/hooks/useRoomReservations';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, PlayCircle, Save, RotateCcw, AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react';

interface RawRow {
  Curso: string;
  Turno: string;
  Turma: string;
  SubTurma?: string;
  Disciplina: string;
  Professor: string;
  Tipo: string;
  CargaHoraria: number;
  Ambiente?: string;
  Periodicidade: string;
  Dia: string;
  HoraInicio: string;
  HoraFim: string;
}

interface AllocationItem {
  key: string;
  curso: string;
  turma: string;
  disciplina: string;
  professor: string;
  tipo: string;
  dia: string;
  diaIdx: number;
  horaInicio: string;
  horaFim: string;
  periodicidade: string;
  needed: number;
  assignedRoomId?: string;
  assignedRoomCode?: string;
  assignedRoomCapacity?: number;
  status: 'ok' | 'no-room' | 'conflict' | 'skipped';
  message?: string;
}

const DIA_MAP: Record<string, number> = {
  'segunda-feira': 1, 'terça-feira': 2, 'quarta-feira': 3,
  'quinta-feira': 4, 'sexta-feira': 5, 'sábado': 6, 'domingo': 0,
};

function normalize(s: string) { return (s || '').toString().trim().toLowerCase(); }

function timeToStr(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v instanceof Date) {
    return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') {
    const totalMin = Math.round(v * 24 * 60);
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  }
  return String(v);
}

function getTurmaSize(curso: string, turma: string, defaultSize: number): number {
  const c = normalize(curso);
  const t = normalize(turma);
  if (c === 'medicina' && (t.startsWith('1º') || t.startsWith('2º') || t.startsWith('1°') || t.startsWith('2°'))) {
    return 70;
  }
  return defaultSize;
}

export default function ImportClasses() {
  const { profile } = useAuth();
  const { data: rooms = [] } = useReservationRooms();
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-12-12');
  const [defaultTurmaSize, setDefaultTurmaSize] = useState(60);
  const [campusPreference, setCampusPreference] = useState<string>('any');
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [rollbackTag, setRollbackTag] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null });
    setRawRows(rows);
    setAllocations([]);
    toast.success(`${rows.length} linhas lidas da planilha`);
  };

  const stats = useMemo(() => {
    const teoricas = rawRows.filter(r => normalize(r.Tipo) === 'teórica' || normalize(r.Tipo) === 'teorica');
    const praticas = rawRows.filter(r => normalize(r.Tipo) === 'prática' || normalize(r.Tipo) === 'pratica');
    const extensao = rawRows.filter(r => normalize(r.Tipo) === 'extensão' || normalize(r.Tipo) === 'extensao');
    return { total: rawRows.length, teoricas: teoricas.length, praticas: praticas.length, extensao: extensao.length };
  }, [rawRows]);

  const runAllocation = () => {
    if (!rawRows.length) {
      toast.error('Carregue a planilha primeiro');
      return;
    }
    if (!rooms.length) {
      toast.error('Nenhuma sala cadastrada');
      return;
    }

    // 1. Filtrar apenas Teórica
    const target = rawRows.filter(r => {
      const t = normalize(r.Tipo);
      return t === 'teórica' || t === 'teorica';
    });

    // 2. Agrupar por (curso+turma+disciplina+dia+horaInicio+horaFim) — cada slot único
    const groups = new Map<string, AllocationItem>();
    for (const r of target) {
      const dia = normalize(r.Dia);
      const diaIdx = DIA_MAP[dia] ?? -1;
      const hi = timeToStr(r.HoraInicio);
      const hf = timeToStr(r.HoraFim);
      const key = `${r.Curso}|${r.Turma}|${r.Disciplina}|${dia}|${hi}|${hf}`;
      if (groups.has(key)) continue;
      groups.set(key, {
        key,
        curso: r.Curso,
        turma: r.Turma,
        disciplina: r.Disciplina,
        professor: r.Professor,
        tipo: r.Tipo,
        dia: r.Dia,
        diaIdx,
        horaInicio: hi,
        horaFim: hf,
        periodicidade: r.Periodicidade,
        needed: getTurmaSize(r.Curso, r.Turma, defaultTurmaSize),
        status: 'skipped',
      });
    }

    const items = Array.from(groups.values());
    // 3. Ordenar por capacidade necessária desc, depois por dia/hora
    items.sort((a, b) => b.needed - a.needed || a.diaIdx - b.diaIdx || a.horaInicio.localeCompare(b.horaInicio));

    // 4. Salas candidatas (filtra por campus se preferência)
    const candidates = rooms
      .filter(r => campusPreference === 'any' || r.campus === campusPreference)
      .sort((a, b) => a.capacity - b.capacity); // menor capacidade primeiro (best-fit)

    // 5. Mapa de ocupação: roomId -> array de { diaIdx, hi, hf }
    const occupancy = new Map<string, Array<{ d: number; s: string; e: string }>>();
    const overlaps = (room: string, d: number, s: string, e: string) => {
      const occ = occupancy.get(room) || [];
      return occ.some(o => o.d === d && !(e <= o.s || s >= o.e));
    };

    for (const it of items) {
      if (it.diaIdx < 0 || !it.horaInicio || !it.horaFim) {
        it.status = 'skipped';
        it.message = 'Dia ou horário inválido';
        continue;
      }
      // best-fit: menor sala que comporte e sem conflito
      const fit = candidates.find(r => r.capacity >= it.needed && !overlaps(r.id, it.diaIdx, it.horaInicio, it.horaFim));
      if (!fit) {
        const hasCap = candidates.some(r => r.capacity >= it.needed);
        it.status = hasCap ? 'conflict' : 'no-room';
        it.message = hasCap ? 'Conflito de horário em todas salas compatíveis' : `Nenhuma sala com capacidade >= ${it.needed}`;
        continue;
      }
      it.assignedRoomId = fit.id;
      it.assignedRoomCode = fit.code;
      it.assignedRoomCapacity = fit.capacity;
      it.status = 'ok';
      const occ = occupancy.get(fit.id) || [];
      occ.push({ d: it.diaIdx, s: it.horaInicio, e: it.horaFim });
      occupancy.set(fit.id, occ);
    }

    setAllocations(items);
    const ok = items.filter(i => i.status === 'ok').length;
    toast.success(`Alocação calculada: ${ok}/${items.length} aulas alocadas`);
  };

  const commitImport = async () => {
    const ok = allocations.filter(a => a.status === 'ok' && a.assignedRoomId);
    if (!ok.length) {
      toast.error('Nada para importar');
      return;
    }
    setImporting(true);
    const tag = `aulas_${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');

    const inserts: Array<Record<string, unknown>> = [];
    for (const it of ok) {
      // gerar todas as semanas
      const firstDate = new Date(start);
      while (firstDate.getDay() !== it.diaIdx) firstDate.setDate(firstDate.getDate() + 1);
      const stepDays = normalize(it.periodicidade) === 'quinzenal' ? 14 : 7;
      const cursor = new Date(firstDate);
      while (cursor <= end) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        const sDt = `${y}-${m}-${d}T${it.horaInicio}:00`;
        const eDt = `${y}-${m}-${d}T${it.horaFim}:00`;
        inserts.push({
          title: `${it.disciplina} — ${it.turma}`,
          description: `${it.curso} | Prof: ${it.professor}`,
          room_id: it.assignedRoomId,
          start_datetime: sDt,
          end_datetime: eDt,
          attendees_count: it.needed,
          status: 'confirmed',
          is_external: false,
          is_fixed: true,
          requester_name: profile?.full_name || 'Importador',
          requester_email: '',
          created_by: profile?.user_id,
          import_tag: tag,
          notes: `Importação automática 2026/2`,
        });
        cursor.setDate(cursor.getDate() + stepDays);
      }
    }

    // batch insert em blocos de 500
    let inserted = 0;
    for (let i = 0; i < inserts.length; i += 500) {
      const batch = inserts.slice(i, i + 500);
      const { error } = await supabase.from('reservations').insert(batch as never);
      if (error) {
        toast.error(`Erro no lote ${i}: ${error.message}`);
        setImporting(false);
        return;
      }
      inserted += batch.length;
    }
    setImporting(false);
    toast.success(`${inserted} reservas criadas. Tag: ${tag}`);
    setRollbackTag(tag);
  };

  const rollback = async () => {
    if (!rollbackTag) return;
    if (!confirm(`Apagar todas as reservas com tag ${rollbackTag}?`)) return;
    const { error, count } = await supabase
      .from('reservations')
      .delete({ count: 'exact' })
      .eq('import_tag', rollbackTag);
    if (error) { toast.error(error.message); return; }
    toast.success(`${count || 0} reservas removidas`);
    setRollbackTag('');
  };

  const okCount = allocations.filter(a => a.status === 'ok').length;
  const failCount = allocations.length - okCount;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar Aulas (Alocação Automática)</h1>
        <p className="text-muted-foreground">Importa o relatório de disciplinas e aloca salas conforme capacidade e disponibilidade.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>1. Configuração</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Planilha (.xlsx)</Label>
            <Input type="file" accept=".xlsx,.xls" onChange={handleFile} />
            {fileName && <p className="text-xs text-muted-foreground mt-1">{fileName}</p>}
          </div>
          <div>
            <Label>Início do semestre</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Fim do semestre</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label>Tamanho turma padrão</Label>
            <Input type="number" value={defaultTurmaSize} onChange={e => setDefaultTurmaSize(+e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Med 1º/2º usa 70 fixo</p>
          </div>
          <div className="md:col-span-2">
            <Label>Campus preferencial</Label>
            <Select value={campusPreference} onValueChange={setCampusPreference}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer campus</SelectItem>
                <SelectItem value="Campus I">Campus I</SelectItem>
                <SelectItem value="Campus II">Campus II</SelectItem>
                <SelectItem value="Campus IV">Campus IV</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {rawRows.length > 0 && (
        <Card>
          <CardHeader><CardTitle>2. Resumo do arquivo</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Badge variant="outline">Total: {stats.total}</Badge>
            <Badge>Teóricas (serão alocadas): {stats.teoricas}</Badge>
            <Badge variant="secondary">Práticas (já têm ambiente): {stats.praticas}</Badge>
            <Badge variant="secondary">Extensão (ignoradas): {stats.extensao}</Badge>
            <div className="w-full">
              <Button onClick={runAllocation} className="mt-3">
                <PlayCircle className="mr-2 h-4 w-4" /> Calcular alocação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Pré-visualização da alocação</CardTitle>
            <div className="flex gap-2 mt-2">
              <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />OK: {okCount}</Badge>
              <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Falhas: {failCount}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="ok">
              <TabsList>
                <TabsTrigger value="ok">Alocadas ({okCount})</TabsTrigger>
                <TabsTrigger value="fail">Falhas ({failCount})</TabsTrigger>
              </TabsList>
              <TabsContent value="ok">
                <div className="max-h-[500px] overflow-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Curso / Turma</TableHead>
                        <TableHead>Disciplina</TableHead>
                        <TableHead>Dia / Horário</TableHead>
                        <TableHead>Cap</TableHead>
                        <TableHead>Sala</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocations.filter(a => a.status === 'ok').map(a => (
                        <TableRow key={a.key}>
                          <TableCell className="text-xs">{a.curso}<br/><span className="text-muted-foreground">{a.turma}</span></TableCell>
                          <TableCell className="text-xs">{a.disciplina}</TableCell>
                          <TableCell className="text-xs">{a.dia}<br/>{a.horaInicio}-{a.horaFim}</TableCell>
                          <TableCell>{a.needed}</TableCell>
                          <TableCell><Badge>{a.assignedRoomCode} ({a.assignedRoomCapacity})</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="fail">
                <div className="max-h-[500px] overflow-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Curso / Turma</TableHead>
                        <TableHead>Disciplina</TableHead>
                        <TableHead>Dia / Horário</TableHead>
                        <TableHead>Cap</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocations.filter(a => a.status !== 'ok').map(a => (
                        <TableRow key={a.key}>
                          <TableCell className="text-xs">{a.curso}<br/><span className="text-muted-foreground">{a.turma}</span></TableCell>
                          <TableCell className="text-xs">{a.disciplina}</TableCell>
                          <TableCell className="text-xs">{a.dia}<br/>{a.horaInicio}-{a.horaFim}</TableCell>
                          <TableCell>{a.needed}</TableCell>
                          <TableCell className="text-xs text-destructive">{a.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>

            {okCount > 0 && (
              <Alert className="mt-4">
                <AlertDescription>
                  Ao confirmar, serão criadas <strong>reservas semanais</strong> de {startDate} até {endDate} para cada aula alocada (quinzenais respeitam periodicidade). Todas levarão uma <strong>tag de importação</strong> para permitir reverter em lote.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 mt-4">
              <Button onClick={commitImport} disabled={importing || !okCount}>
                <Save className="mr-2 h-4 w-4" />
                {importing ? 'Importando...' : `Confirmar e criar ${okCount} aulas`}
              </Button>
              {rollbackTag && (
                <Button variant="destructive" onClick={rollback}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reverter última importação ({rollbackTag})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
