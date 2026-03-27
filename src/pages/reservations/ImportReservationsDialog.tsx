import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileSpreadsheet, Trash2, AlertTriangle, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useReservationRooms } from '@/hooks/useRoomReservations';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ParsedReservation {
  dayOfWeek: string;
  timeSlot: string;
  roomName: string;
  title: string;
  professor: string;
  attendees: number;
  startTime: string;
  endTime: string;
}

const DAY_MAP: Record<string, number> = {
  'SEGUNDA': 1,
  'TERÇA': 2,
  'QUARTA': 3,
  'QUINTA': 4,
  'SEXTA': 5,
  'SÁBADO': 6,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportReservationsDialog({ open, onOpenChange }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: rooms } = useReservationRooms();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedReservation[]>([]);
  const [importing, setImporting] = useState(false);
  const [importTag, setImportTag] = useState('');
  const [startDate, setStartDate] = useState('');
  const [repeatWeeks, setRepeatWeeks] = useState('1');
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [results, setResults] = useState<{ success: number; errors: number }>({ success: 0, errors: 0 });

  const parseTimeRange = (timeStr: string): { start: string; end: string } | null => {
    // Parse formats like "07:00 às 07:50", "08:55 às 09:45"
    const match = timeStr.match(/(\d{1,2})[:\.]?\s*(\d{2})?\s*[àa]s?\s*(\d{1,2})[:\.]?\s*[h]?(\d{2})?/i);
    if (!match) return null;
    const startH = match[1].padStart(2, '0');
    const startM = (match[2] || '00').padStart(2, '0');
    const endH = match[3].padStart(2, '0');
    const endM = (match[4] || '00').padStart(2, '0');
    return { start: `${startH}:${startM}`, end: `${endH}:${endM}` };
  };

  const parseCellContent = (cell: string): { title: string; professor: string; attendees: number } | null => {
    if (!cell || cell.trim() === '' || cell.includes('RESERVAS EVENTUAIS') || cell.includes('15min de Intervalo') || cell.includes('INTERVALO')) return null;
    
    const lines = cell.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    
    const title = lines[0];
    let professor = '';
    let attendees = 0;
    
    for (const line of lines) {
      if (line.toUpperCase().startsWith('PROF')) {
        professor = line.replace(/^PROF\.?\s*/i, '').trim();
      }
      const alunosMatch = line.match(/(\d+)\s*ALUNOS/i);
      if (alunosMatch) {
        attendees = parseInt(alunosMatch[1]);
      }
    }
    
    return { title, professor, attendees: attendees || 1 };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const allReservations: ParsedReservation[] = [];

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false });
          
          if (!jsonData || jsonData.length < 4) continue;

          // Detect which day from sheet name or first row
          let dayOfWeek = '';
          const firstRow = (jsonData[0] as any)?.[0] || sheetName;
          for (const dayKey of Object.keys(DAY_MAP)) {
            if (firstRow.toUpperCase().includes(dayKey) || sheetName.toUpperCase().includes(dayKey)) {
              dayOfWeek = dayKey;
              break;
            }
          }
          if (!dayOfWeek) continue;

          // Find room names row (LOCAL row) and capacity row
          let roomNamesRow: string[] = [];
          let roomNamesRowIndex = -1;
          
          for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i] as string[];
            if (row && row[0] && row[0].toString().toUpperCase().includes('LOCAL')) {
              roomNamesRow = row.map(c => (c || '').toString().trim());
              roomNamesRowIndex = i;
              break;
            }
          }

          if (roomNamesRowIndex === -1) continue;

          // Parse time rows after capacity
          for (let i = roomNamesRowIndex + 2; i < jsonData.length; i++) {
            const row = jsonData[i] as string[];
            if (!row || !row[0]) continue;
            
            const timeStr = row[0].toString().trim();
            const timeRange = parseTimeRange(timeStr);
            if (!timeRange) continue;

            // Check next row for continuation (same time block)
            for (let col = 1; col < roomNamesRow.length; col++) {
              const cellValue = (row[col] || '').toString().trim();
              const parsed = parseCellContent(cellValue);
              if (!parsed) continue;
              
              const roomName = roomNamesRow[col] || '';
              if (!roomName) continue;
              
              // Clean room name (remove capacity/description after line break)
              const cleanRoomName = roomName.split('\n')[0].trim();
              
              allReservations.push({
                dayOfWeek,
                timeSlot: timeStr,
                roomName: cleanRoomName,
                title: parsed.title,
                professor: parsed.professor,
                attendees: parsed.attendees,
                startTime: timeRange.start,
                endTime: timeRange.end,
              });
            }
          }
        }

        setParsed(allReservations);
        setStep('preview');
        toast.success(`${allReservations.length} aulas/reservas encontradas no arquivo.`);
      } catch (err) {
        toast.error('Erro ao ler o arquivo. Verifique o formato.');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    if (!startDate || !parsed.length) {
      toast.error('Selecione a data de início.');
      return;
    }

    setImporting(true);
    const tag = importTag || `import_${Date.now()}`;
    let successCount = 0;
    let errorCount = 0;
    const weeks = parseInt(repeatWeeks) || 1;
    
    // Get the day of the week for the start date
    const baseDate = new Date(startDate + 'T00:00:00');
    const baseDayOfWeek = baseDate.getDay(); // 0=Sunday

    for (const reservation of parsed) {
      const targetDayNum = DAY_MAP[reservation.dayOfWeek];
      if (!targetDayNum) continue;

      // Find matching room
      const matchingRoom = rooms?.find(r => {
        const rName = r.name.toLowerCase();
        const rCode = r.code.toLowerCase();
        const search = reservation.roomName.toLowerCase();
        return rName.includes(search) || rCode.includes(search) || search.includes(rName) || search.includes(rCode);
      });

      if (!matchingRoom) {
        errorCount++;
        continue;
      }

      // Calculate the first occurrence date
      let daysUntil = targetDayNum - baseDayOfWeek;
      if (daysUntil < 0) daysUntil += 7;

      for (let week = 0; week < weeks; week++) {
        const eventDate = new Date(baseDate);
        eventDate.setDate(eventDate.getDate() + daysUntil + week * 7);
        const dateStr = eventDate.toISOString().split('T')[0];
        
        const startDt = `${dateStr}T${reservation.startTime}:00`;
        const endDt = `${dateStr}T${reservation.endTime}:00`;

        const titleWithProf = reservation.professor 
          ? `${reservation.title} - Prof. ${reservation.professor}`
          : reservation.title;

        const { error } = await supabase.from('reservations').insert({
          title: titleWithProf,
          room_id: matchingRoom.id,
          start_datetime: startDt,
          end_datetime: endDt,
          attendees_count: reservation.attendees,
          requester_name: reservation.professor || profile?.full_name || 'Importação',
          requester_email: '',
          status: 'confirmed',
          is_external: false,
          is_fixed: true,
          created_by: profile?.user_id,
          notes: `[IMPORT:${tag}] ${reservation.dayOfWeek} ${reservation.timeSlot}`,
        });

        if (error) {
          errorCount++;
        } else {
          successCount++;
        }
      }
    }

    setResults({ success: successCount, errors: errorCount });
    setImporting(false);
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['room-reservations'] });
    toast.success(`Importação concluída: ${successCount} reservas criadas, ${errorCount} erros.`);
  };

  const handleCancelImport = async () => {
    if (!importTag) {
      toast.error('Nenhuma tag de importação definida.');
      return;
    }

    const { data, error } = await supabase
      .from('reservations')
      .delete()
      .like('notes', `%[IMPORT:${importTag}]%`)
      .select('id');

    if (error) {
      toast.error('Erro ao cancelar importação: ' + error.message);
    } else {
      toast.success(`${data?.length || 0} reservas da importação removidas.`);
      queryClient.invalidateQueries({ queryKey: ['room-reservations'] });
    }
  };

  const resetDialog = () => {
    setFile(null);
    setParsed([]);
    setStep('upload');
    setResults({ success: 0, errors: 0 });
    setImportTag('');
    setStartDate('');
    setRepeatWeeks('1');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetDialog(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Mapa de Reservas
          </DialogTitle>
          <DialogDescription>
            Importe reservas a partir de uma planilha Excel no formato do mapa de salas.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <Label>Arquivo Excel (.xlsx)</Label>
              <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">
                O arquivo deve estar no formato do mapa de salas, com abas por dia da semana.
              </p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="default">{parsed.length} reservas</Badge>
              <span className="text-muted-foreground">encontradas no arquivo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Data de início do semestre/período</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Repetir por quantas semanas?</Label>
                <Input type="number" min="1" max="26" value={repeatWeeks} onChange={e => setRepeatWeeks(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Tag de importação (para poder cancelar depois)</Label>
              <Input 
                value={importTag} 
                onChange={e => setImportTag(e.target.value)} 
                placeholder="Ex: 2026-1-campus-I"
                className="mt-1"
              />
            </div>

            <div className="max-h-60 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Dia</th>
                    <th className="p-2 text-left">Horário</th>
                    <th className="p-2 text-left">Sala</th>
                    <th className="p-2 text-left">Disciplina</th>
                    <th className="p-2 text-left">Professor</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.dayOfWeek}</td>
                      <td className="p-2">{r.startTime}-{r.endTime}</td>
                      <td className="p-2">{r.roomName}</td>
                      <td className="p-2 max-w-[200px] truncate">{r.title}</td>
                      <td className="p-2">{r.professor || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 100 && (
                <p className="text-xs text-muted-foreground p-2">... e mais {parsed.length - 100} registros</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={importing || !startDate}>
                {importing ? 'Importando...' : 'Confirmar Importação'}
              </Button>
              <Button variant="outline" onClick={resetDialog}>Cancelar</Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
              <Check className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">Importação concluída</p>
                <p className="text-sm text-muted-foreground">
                  {results.success} reservas criadas com sucesso
                  {results.errors > 0 && `, ${results.errors} erros (sala não encontrada ou conflito)`}
                </p>
              </div>
            </div>

            {importTag && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm mb-2">
                    <strong>Tag de importação:</strong> {importTag}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Use esta tag para cancelar/limpar todas as reservas desta importação.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-3 w-3 mr-1" />
                        Cancelar esta importação
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar importação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Todas as reservas criadas com a tag "{importTag}" serão excluídas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Não</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelImport}>Sim, excluir tudo</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}

            <Button onClick={() => { resetDialog(); onOpenChange(false); }}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
