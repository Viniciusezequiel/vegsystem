import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  PlayCircle,
  RotateCcw,
  Save,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { ContentState } from '@/components/layout/ContentState';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useReservationRooms } from '@/hooks/useRoomReservations';
import { supabase } from '@/integrations/supabase/client';

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
  'segunda-feira': 1,
  'terça-feira': 2,
  'quarta-feira': 3,
  'quinta-feira': 4,
  'sexta-feira': 5,
  'sábado': 6,
  'domingo': 0,
};

function normalize(value: string) {
  return (value || '').toString().trim().toLowerCase();
}

function timeToStr(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
  }
  if (typeof value === 'number') {
    const totalMin = Math.round(value * 24 * 60);
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  }
  return String(value);
}

function getTurmaSize(curso: string, turma: string, defaultSize: number): number {
  const normalizedCourse = normalize(curso);
  const normalizedClass = normalize(turma);
  if (
    normalizedCourse === 'medicina' &&
    (normalizedClass.startsWith('1º') ||
      normalizedClass.startsWith('2º') ||
      normalizedClass.startsWith('1°') ||
      normalizedClass.startsWith('2°'))
  ) {
    return 70;
  }
  return defaultSize;
}

export default function ImportClasses() {
  const { profile } = useAuth();
  const { data: rooms = [] } = useReservationRooms();
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-12-12');
  const [defaultTurmaSize, setDefaultTurmaSize] = useState(60);
  const [campusPreference, setCampusPreference] = useState('any');
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [rollbackTag, setRollbackTag] = useState('');

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, { defval: null });
    setRawRows(rows);
    setAllocations([]);
    toast.success(`${rows.length} linhas lidas da planilha`);
  };

  const stats = useMemo(() => {
    const teoricas = rawRows.filter(row => normalize(row.Tipo) === 'teórica' || normalize(row.Tipo) === 'teorica');
    const praticas = rawRows.filter(row => normalize(row.Tipo) === 'prática' || normalize(row.Tipo) === 'pratica');
    const extensao = rawRows.filter(row => normalize(row.Tipo) === 'extensão' || normalize(row.Tipo) === 'extensao');
    return {
      total: rawRows.length,
      teoricas: teoricas.length,
      praticas: praticas.length,
      extensao: extensao.length,
    };
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

    const target = rawRows.filter(row => {
      const type = normalize(row.Tipo);
      return type === 'teórica' || type === 'teorica';
    });

    const groups = new Map<string, AllocationItem>();
    for (const row of target) {
      const dia = normalize(row.Dia);
      const diaIdx = DIA_MAP[dia] ?? -1;
      const horaInicio = timeToStr(row.HoraInicio);
      const horaFim = timeToStr(row.HoraFim);
      const key = `${row.Curso}|${row.Turma}|${row.Disciplina}|${dia}|${horaInicio}|${horaFim}`;
      if (groups.has(key)) continue;

      groups.set(key, {
        key,
        curso: row.Curso,
        turma: row.Turma,
        disciplina: row.Disciplina,
        professor: row.Professor,
        tipo: row.Tipo,
        dia: row.Dia,
        diaIdx,
        horaInicio,
        horaFim,
        periodicidade: row.Periodicidade,
        needed: getTurmaSize(row.Curso, row.Turma, defaultTurmaSize),
        status: 'skipped',
      });
    }

    const items = Array.from(groups.values());
    items.sort((a, b) => b.needed - a.needed || a.diaIdx - b.diaIdx || a.horaInicio.localeCompare(b.horaInicio));

    const candidates = rooms
      .filter(room => campusPreference === 'any' || room.campus === campusPreference)
      .sort((a, b) => a.capacity - b.capacity);

    const occupancy = new Map<string, Array<{ d: number; s: string; e: string }>>();
    const overlaps = (roomId: string, day: number, start: string, end: string) => {
      const occupied = occupancy.get(roomId) || [];
      return occupied.some(slot => slot.d === day && !(end <= slot.s || start >= slot.e));
    };

    for (const item of items) {
      if (item.diaIdx < 0 || !item.horaInicio || !item.horaFim) {
        item.status = 'skipped';
        item.message = 'Dia ou horário inválido';
        continue;
      }

      const fit = candidates.find(
        room => room.capacity >= item.needed && !overlaps(room.id, item.diaIdx, item.horaInicio, item.horaFim)
      );

      if (!fit) {
        const hasCapacity = candidates.some(room => room.capacity >= item.needed);
        item.status = hasCapacity ? 'conflict' : 'no-room';
        item.message = hasCapacity
          ? 'Conflito de horário em todas salas compatíveis'
          : `Nenhuma sala com capacidade >= ${item.needed}`;
        continue;
      }

      item.assignedRoomId = fit.id;
      item.assignedRoomCode = fit.code;
      item.assignedRoomCapacity = fit.capacity;
      item.status = 'ok';
      const occupied = occupancy.get(fit.id) || [];
      occupied.push({ d: item.diaIdx, s: item.horaInicio, e: item.horaFim });
      occupancy.set(fit.id, occupied);
    }

    setAllocations(items);
    const ok = items.filter(item => item.status === 'ok').length;
    toast.success(`Alocação calculada: ${ok}/${items.length} aulas alocadas`);
  };

  const commitImport = async () => {
    const validAllocations = allocations.filter(item => item.status === 'ok' && item.assignedRoomId);
    if (!validAllocations.length) {
      toast.error('Nada para importar');
      return;
    }

    setImporting(true);
    const tag = `aulas_${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    const inserts: Array<Record<string, unknown>> = [];

    for (const item of validAllocations) {
      const firstDate = new Date(start);
      while (firstDate.getDay() !== item.diaIdx) firstDate.setDate(firstDate.getDate() + 1);
      const stepDays = normalize(item.periodicidade) === 'quinzenal' ? 14 : 7;
      const cursor = new Date(firstDate);

      while (cursor <= end) {
        const year = cursor.getFullYear();
        const month = String(cursor.getMonth() + 1).padStart(2, '0');
        const day = String(cursor.getDate()).padStart(2, '0');
        const startDateTime = `${year}-${month}-${day}T${item.horaInicio}:00`;
        const endDateTime = `${year}-${month}-${day}T${item.horaFim}:00`;

        inserts.push({
          title: `${item.disciplina} — ${item.turma}`,
          description: `${item.curso} | Prof: ${item.professor}`,
          room_id: item.assignedRoomId,
          start_datetime: startDateTime,
          end_datetime: endDateTime,
          attendees_count: item.needed,
          status: 'confirmed',
          is_external: false,
          is_fixed: true,
          requester_name: profile?.full_name || 'Importador',
          requester_email: '',
          created_by: profile?.user_id,
          import_tag: tag,
          notes: 'Importação automática 2026/2',
        });

        cursor.setDate(cursor.getDate() + stepDays);
      }
    }

    let inserted = 0;
    for (let index = 0; index < inserts.length; index += 500) {
      const batch = inserts.slice(index, index + 500);
      const { error } = await supabase.from('reservations').insert(batch as never);
      if (error) {
        toast.error(`Erro no lote ${index}: ${error.message}`);
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

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${count || 0} reservas removidas`);
    setRollbackTag('');
  };

  const exportMapaSalas = () => {
    type Entry = {
      diaIdx: number;
      dia: string;
      hi: string;
      hf: string;
      roomId: string;
      roomCode: string;
      roomCampus: string;
      disciplina: string;
      turma: string;
      curso: string;
      professor: string;
      alunos: number;
      tipo: string;
    };

    const entries: Entry[] = [];

    for (const allocation of allocations) {
      if (allocation.status !== 'ok' || !allocation.assignedRoomId) continue;
      const room = rooms.find(candidate => candidate.id === allocation.assignedRoomId);
      if (!room) continue;

      entries.push({
        diaIdx: allocation.diaIdx,
        dia: allocation.dia,
        hi: allocation.horaInicio,
        hf: allocation.horaFim,
        roomId: room.id,
        roomCode: room.code,
        roomCampus: room.campus,
        disciplina: allocation.disciplina,
        turma: allocation.turma,
        curso: allocation.curso,
        professor: allocation.professor,
        alunos: allocation.needed,
        tipo: allocation.tipo,
      });
    }

    const matchRoom = (ambiente: string) => {
      if (!ambiente) return null;
      const normalizedEnvironment = ambiente.toLowerCase();
      let best = rooms.find(room => room.code && normalizedEnvironment.includes(room.code.toLowerCase()));
      if (!best) best = rooms.find(room => room.name && normalizedEnvironment.includes(room.name.toLowerCase()));
      return best || null;
    };

    for (const row of rawRows) {
      const type = normalize(row.Tipo);
      if (type !== 'prática' && type !== 'pratica' && type !== 'extensão' && type !== 'extensao') continue;
      if (!row.Ambiente) continue;

      const room = matchRoom(row.Ambiente);
      if (!room) continue;
      const dia = (row.Dia || '').toString();
      const diaIdx = DIA_MAP[normalize(dia)] ?? -1;
      if (diaIdx < 0) continue;

      entries.push({
        diaIdx,
        dia,
        hi: timeToStr(row.HoraInicio),
        hf: timeToStr(row.HoraFim),
        roomId: room.id,
        roomCode: room.code,
        roomCampus: room.campus,
        disciplina: row.Disciplina,
        turma: row.Turma,
        curso: row.Curso,
        professor: row.Professor,
        alunos: getTurmaSize(row.Curso, row.Turma, defaultTurmaSize),
        tipo: row.Tipo,
      });
    }

    if (!entries.length) {
      toast.error('Sem dados para exportar. Carregue a planilha e calcule a alocação primeiro.');
      return;
    }

    const dayOrder = [1, 2, 3, 4, 5, 6];
    const dayNames: Record<number, string> = {
      1: 'SEGUNDA',
      2: 'TERÇA',
      3: 'QUARTA',
      4: 'QUINTA',
      5: 'SEXTA',
      6: 'SÁBADO',
    };

    const campusList = Array.from(new Set(entries.map(entry => entry.roomCampus))).sort();
    const workbook = XLSX.utils.book_new();

    for (const currentCampus of campusList) {
      const campusEntries = entries.filter(entry => entry.roomCampus === currentCampus);
      const campusRooms = rooms
        .filter(room => room.campus === currentCampus)
        .sort((a, b) => (a.code || '').localeCompare(b.code || ''));

      for (const dayIndex of dayOrder) {
        const dayEntries = campusEntries.filter(entry => entry.diaIdx === dayIndex);
        if (!dayEntries.length) continue;

        const slotSet = new Set<string>();
        dayEntries.forEach(entry => slotSet.add(`${entry.hi}-${entry.hf}`));
        const slots = Array.from(slotSet).sort();

        const header1 = ['HORÁRIO', ...campusRooms.map(room => room.code)];
        const header2 = ['CAPACIDADE', ...campusRooms.map(room => room.capacity)];
        const aoa: (string | number)[][] = [
          [`MAPA FCMMG — ${dayNames[dayIndex]} — ${currentCampus}`],
          header1,
          header2 as (string | number)[],
        ];

        for (const slot of slots) {
          const [start, end] = slot.split('-');
          const row: (string | number)[] = [`${start} às ${end}`];

          for (const room of campusRooms) {
            const hits = dayEntries.filter(
              entry => entry.roomId === room.id && `${entry.hi}-${entry.hf}` === slot
            );
            if (!hits.length) {
              row.push('');
              continue;
            }

            row.push(
              hits
                .map(hit => `${hit.disciplina}\n${hit.turma}\nPROF. ${hit.professor}\n${hit.alunos} ALUNOS`)
                .join('\n---\n')
            );
          }
          aoa.push(row);
        }

        const worksheet = XLSX.utils.aoa_to_sheet(aoa);
        worksheet['!cols'] = [{ wch: 18 }, ...campusRooms.map(() => ({ wch: 28 }))];
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

        for (let row = range.s.r; row <= range.e.r; row++) {
          for (let column = range.s.c; column <= range.e.c; column++) {
            const address = XLSX.utils.encode_cell({ r: row, c: column });
            if (!worksheet[address]) continue;
            worksheet[address].s = { alignment: { wrapText: true, vertical: 'top' } };
          }
        }

        const sheetName = `${dayNames[dayIndex]}-${currentCampus}`.slice(0, 31).replace(/[\\/?*[\]]/g, '');
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }
    }

    XLSX.writeFile(workbook, `Mapa_Salas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Mapa de salas exportado');
  };

  const okCount = allocations.filter(allocation => allocation.status === 'ok').length;
  const failCount = allocations.length - okCount;

  return (
    <MainLayout>
      <PageHeader
        title="Importação de aulas"
        description="Leia a grade acadêmica, calcule a melhor alocação de salas e crie as reservas em lote."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <Card className="border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1. Preparar importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5 xl:col-span-2">
                <Label htmlFor="classes-file" className="text-xs text-muted-foreground">Planilha (.xlsx ou .xls)</Label>
                <label
                  htmlFor="classes-file"
                  className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed border-border/70 bg-muted/20 px-3 text-sm transition-colors hover:border-primary/35 hover:bg-muted/35"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Upload className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{fileName || 'Selecionar arquivo da grade'}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">Procurar</span>
                </label>
                <Input id="classes-file" type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Início do semestre</Label>
                <Input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fim do semestre</Label>
                <Input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tamanho padrão da turma</Label>
                <Input type="number" min={1} value={defaultTurmaSize} onChange={event => setDefaultTurmaSize(+event.target.value)} />
                <p className="text-[11px] text-muted-foreground">Medicina 1º/2º utiliza 70 alunos.</p>
              </div>

              <div className="space-y-1.5 md:col-span-2 xl:col-span-2">
                <Label className="text-xs text-muted-foreground">Campus preferencial</Label>
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
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Leitura do arquivo</CardTitle>
          </CardHeader>
          <CardContent>
            {!rawRows.length ? (
              <div className="flex min-h-[118px] flex-col items-center justify-center text-center">
                <FileSpreadsheet className="mb-2 h-7 w-7 text-muted-foreground/50" />
                <p className="text-sm font-medium">Nenhuma planilha carregada</p>
                <p className="mt-1 text-xs text-muted-foreground">Selecione o arquivo para iniciar a análise.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3"><p className="text-[11px] text-muted-foreground">Linhas</p><p className="mt-1 text-xl font-semibold tabular-nums">{stats.total}</p></div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3"><p className="text-[11px] text-muted-foreground">Teóricas</p><p className="mt-1 text-xl font-semibold tabular-nums">{stats.teoricas}</p></div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3"><p className="text-[11px] text-muted-foreground">Práticas</p><p className="mt-1 text-xl font-semibold tabular-nums">{stats.praticas}</p></div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3"><p className="text-[11px] text-muted-foreground">Extensão</p><p className="mt-1 text-xl font-semibold tabular-nums">{stats.extensao}</p></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={runAllocation} disabled={!rawRows.length}>
          <PlayCircle className="mr-2 h-4 w-4" />
          Calcular alocação
        </Button>
        <p className="text-xs text-muted-foreground">
          O cálculo usa capacidade, disponibilidade, dia e horário para buscar a menor sala compatível.
        </p>
      </div>

      {!allocations.length ? (
        <ContentState
          className="mt-5"
          icon={FileSpreadsheet}
          title="Aguardando cálculo de alocação"
          description={rawRows.length ? 'Clique em “Calcular alocação” para gerar a prévia antes de criar as reservas.' : 'Carregue uma planilha para iniciar.'}
        />
      ) : (
        <Card className="mt-5 border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">2. Pré-visualização da alocação</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Revise os resultados antes de gravar as reservas no calendário.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />{okCount} alocadas</Badge>
                <Badge variant={failCount ? 'destructive' : 'secondary'} className="gap-1"><AlertTriangle className="h-3 w-3" />{failCount} falhas</Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Tabs defaultValue="ok" className="space-y-3">
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-border/60 bg-muted/30 p-1 sm:w-[340px]">
                <TabsTrigger value="ok">Alocadas ({okCount})</TabsTrigger>
                <TabsTrigger value="fail">Falhas ({failCount})</TabsTrigger>
              </TabsList>

              <TabsContent value="ok" className="mt-0">
                {okCount === 0 ? (
                  <ContentState icon={AlertTriangle} title="Nenhuma aula alocada" description="Revise capacidade, campus e disponibilidade das salas." />
                ) : (
                  <div className="max-h-[520px] overflow-auto rounded-xl border border-border/60">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead>Curso / Turma</TableHead>
                          <TableHead>Disciplina</TableHead>
                          <TableHead>Dia / Horário</TableHead>
                          <TableHead>Alunos</TableHead>
                          <TableHead>Sala</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allocations.filter(item => item.status === 'ok').map(item => (
                          <TableRow key={item.key}>
                            <TableCell><p className="text-sm font-medium">{item.curso}</p><p className="text-xs text-muted-foreground">{item.turma}</p></TableCell>
                            <TableCell className="text-sm">{item.disciplina}</TableCell>
                            <TableCell><p className="text-sm">{item.dia}</p><p className="text-xs text-muted-foreground">{item.horaInicio} – {item.horaFim}</p></TableCell>
                            <TableCell className="tabular-nums">{item.needed}</TableCell>
                            <TableCell><Badge variant="secondary">{item.assignedRoomCode} · {item.assignedRoomCapacity}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="fail" className="mt-0">
                {failCount === 0 ? (
                  <ContentState icon={CheckCircle2} title="Nenhuma falha encontrada" description="Todas as aulas teóricas receberam uma sala compatível." />
                ) : (
                  <div className="max-h-[520px] overflow-auto rounded-xl border border-border/60">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead>Curso / Turma</TableHead>
                          <TableHead>Disciplina</TableHead>
                          <TableHead>Dia / Horário</TableHead>
                          <TableHead>Alunos</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allocations.filter(item => item.status !== 'ok').map(item => (
                          <TableRow key={item.key}>
                            <TableCell><p className="text-sm font-medium">{item.curso}</p><p className="text-xs text-muted-foreground">{item.turma}</p></TableCell>
                            <TableCell className="text-sm">{item.disciplina}</TableCell>
                            <TableCell><p className="text-sm">{item.dia}</p><p className="text-xs text-muted-foreground">{item.horaInicio} – {item.horaFim}</p></TableCell>
                            <TableCell className="tabular-nums">{item.needed}</TableCell>
                            <TableCell className="max-w-[320px] text-xs text-destructive">{item.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {okCount > 0 && (
              <Alert className="border-border/60 bg-muted/20">
                <AlertDescription className="text-xs leading-relaxed">
                  Ao confirmar, o sistema criará reservas recorrentes entre <strong>{startDate}</strong> e <strong>{endDate}</strong>, respeitando periodicidade semanal ou quinzenal. A importação recebe uma tag para permitir reversão em lote.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
              <Button onClick={commitImport} disabled={importing || !okCount}>
                <Save className="mr-2 h-4 w-4" />
                {importing ? 'Importando...' : `Confirmar ${okCount} aula(s)`}
              </Button>
              <Button variant="outline" onClick={exportMapaSalas} disabled={!okCount}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar mapa de salas
              </Button>
              {rollbackTag && (
                <Button variant="destructive" onClick={rollback}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reverter última importação
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
}
