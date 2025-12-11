import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  Download,
  RefreshCw,
  StopCircle,
  Pin,
  Calendar
} from 'lucide-react';
import { useReservationRooms } from '@/hooks/useReservations';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parse, isValid } from 'date-fns';

interface ParsedReservation {
  row: number;
  title: string;
  roomCode: string;
  roomId?: string;
  date: string;
  startTime: string;
  endTime: string;
  requesterName: string;
  requesterEmail: string;
  attendeesCount: number;
  reservationType: 'fixed' | 'free' | 'regular';
  status: 'valid' | 'error' | 'warning';
  errors: string[];
  processed?: boolean;
  success?: boolean;
}

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExcelImportDialog({ open, onOpenChange }: ExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedReservation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; cancelled: number }>({ success: 0, failed: 0, cancelled: 0 });
  const [step, setStep] = useState<'upload' | 'preview' | 'results'>('upload');
  const [defaultReservationType, setDefaultReservationType] = useState<'fixed' | 'free' | 'regular'>('regular');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const { toast } = useToast();

  const { data: rooms } = useReservationRooms();

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setIsProcessing(false);
    setIsImporting(false);
    setIsCancelling(false);
    setImportProgress(0);
    setImportResults({ success: 0, failed: 0, cancelled: 0 });
    setStep('upload');
    cancelRef.current = false;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (isImporting) {
      cancelRef.current = true;
      setIsCancelling(true);
      return;
    }
    resetState();
    onOpenChange(false);
  };

  const handleCancelImport = () => {
    cancelRef.current = true;
    setIsCancelling(true);
    toast({
      title: 'Cancelando importação...',
      description: 'A importação será interrompida após a reserva atual.',
    });
  };

  const parseDate = (value: string | number): string | null => {
    if (!value) return null;
    
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y.toString().padStart(4, '0')}-${date.m.toString().padStart(2, '0')}-${date.d.toString().padStart(2, '0')}`;
      }
    }
    
    const strValue = String(value).trim();
    const formats = ['dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd', 'd/M/yyyy', 'd-M-yyyy'];
    
    for (const fmt of formats) {
      const parsed = parse(strValue, fmt, new Date());
      if (isValid(parsed)) {
        return format(parsed, 'yyyy-MM-dd');
      }
    }
    
    return null;
  };

  const parseTime = (value: string | number): string | null => {
    if (!value) return null;
    
    if (typeof value === 'number') {
      const totalMinutes = Math.round(value * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    const strValue = String(value).trim();
    const timeMatch = strValue.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }
    
    const hourMatch = strValue.match(/^(\d{1,2})h?$/i);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1]);
      if (hours >= 0 && hours <= 23) {
        return `${hours.toString().padStart(2, '0')}:00`;
      }
    }
    
    return null;
  };

  const parseReservationType = (value: string): 'fixed' | 'free' | 'regular' => {
    if (!value) return defaultReservationType;
    const lower = String(value).toLowerCase().trim();
    if (lower.includes('fix') || lower.includes('recorrente') || lower.includes('semanal')) return 'fixed';
    if (lower.includes('livr') || lower.includes('extern') || lower.includes('avuls')) return 'free';
    return 'regular';
  };

  const findRoomByCode = (code: string): { id: string; name: string } | null => {
    if (!code || !rooms) return null;
    const normalizedCode = code.trim().toUpperCase();
    const room = rooms.find(r => 
      r.code.toUpperCase() === normalizedCode || 
      r.name.toUpperCase().includes(normalizedCode)
    );
    return room ? { id: room.id, name: room.name } : null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: false });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast({
          title: 'Arquivo vazio',
          description: 'O arquivo não contém dados suficientes.',
          variant: 'destructive',
        });
        resetState();
        return;
      }

      const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
      
      const colMap = {
        title: headers.findIndex((h: string) => h.includes('titulo') || h.includes('título') || h.includes('aula') || h.includes('disciplina') || h.includes('evento')),
        room: headers.findIndex((h: string) => h.includes('sala') || h.includes('room') || h.includes('local')),
        date: headers.findIndex((h: string) => h.includes('data') || h.includes('date')),
        startTime: headers.findIndex((h: string) => h.includes('início') || h.includes('inicio') || h.includes('hora início') || h.includes('start') || h.includes('horário')),
        endTime: headers.findIndex((h: string) => h.includes('fim') || h.includes('término') || h.includes('termino') || h.includes('end') || h.includes('hora fim')),
        requesterName: headers.findIndex((h: string) => h.includes('professor') || h.includes('responsável') || h.includes('solicitante') || h.includes('nome')),
        requesterEmail: headers.findIndex((h: string) => h.includes('email') || h.includes('e-mail')),
        attendees: headers.findIndex((h: string) => h.includes('participantes') || h.includes('alunos') || h.includes('quantidade') || h.includes('pessoas')),
        type: headers.findIndex((h: string) => h.includes('tipo') || h.includes('type') || h.includes('modalidade')),
      };

      const missingColumns: string[] = [];
      if (colMap.title === -1) missingColumns.push('Título/Disciplina');
      if (colMap.room === -1) missingColumns.push('Sala');
      if (colMap.date === -1) missingColumns.push('Data');
      if (colMap.startTime === -1) missingColumns.push('Hora Início');

      if (missingColumns.length > 0) {
        toast({
          title: 'Colunas não encontradas',
          description: `Faltando: ${missingColumns.join(', ')}. Verifique o cabeçalho do arquivo.`,
          variant: 'destructive',
        });
        resetState();
        return;
      }

      const parsed: ParsedReservation[] = [];
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0 || !row[colMap.title]) continue;

        const errors: string[] = [];
        
        const title = String(row[colMap.title] || '').trim();
        const roomCode = String(row[colMap.room] || '').trim();
        const dateValue = row[colMap.date];
        const startTimeValue = row[colMap.startTime];
        const endTimeValue = colMap.endTime !== -1 ? row[colMap.endTime] : null;
        const requesterName = colMap.requesterName !== -1 ? String(row[colMap.requesterName] || 'Professor').trim() : 'Professor';
        const requesterEmail = colMap.requesterEmail !== -1 ? String(row[colMap.requesterEmail] || '').trim() : '';
        const attendeesCount = colMap.attendees !== -1 ? parseInt(row[colMap.attendees]) || 30 : 30;
        const typeValue = colMap.type !== -1 ? String(row[colMap.type] || '').trim() : '';

        const parsedDate = parseDate(dateValue);
        if (!parsedDate) {
          errors.push(`Data inválida: "${dateValue}"`);
        }

        const startTime = parseTime(startTimeValue);
        if (!startTime) {
          errors.push(`Hora início inválida: "${startTimeValue}"`);
        }

        let endTime = endTimeValue ? parseTime(endTimeValue) : null;
        if (!endTime && startTime) {
          const [h, m] = startTime.split(':').map(Number);
          const endHour = h + 2;
          endTime = `${endHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }

        const room = findRoomByCode(roomCode);
        if (!room) {
          errors.push(`Sala não encontrada: "${roomCode}"`);
        }

        if (requesterEmail && !requesterEmail.includes('@')) {
          errors.push(`Email inválido: "${requesterEmail}"`);
        }

        parsed.push({
          row: i + 1,
          title,
          roomCode,
          roomId: room?.id,
          date: parsedDate || '',
          startTime: startTime || '',
          endTime: endTime || '',
          requesterName,
          requesterEmail: requesterEmail || 'sem.email@exemplo.com',
          attendeesCount,
          reservationType: parseReservationType(typeValue),
          status: errors.length > 0 ? 'error' : 'valid',
          errors,
        });
      }

      setParsedData(parsed);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: 'Erro ao processar arquivo',
        description: 'Não foi possível ler o arquivo. Verifique o formato.',
        variant: 'destructive',
      });
      resetState();
    } finally {
      setIsProcessing(false);
    }
  };

  const updateReservationType = (row: number, type: 'fixed' | 'free' | 'regular') => {
    setParsedData(prev => prev.map(item => 
      item.row === row ? { ...item, reservationType: type } : item
    ));
  };

  const applyDefaultTypeToAll = () => {
    setParsedData(prev => prev.map(item => ({ ...item, reservationType: defaultReservationType })));
  };

  const handleImport = async () => {
    const validReservations = parsedData.filter(r => r.status === 'valid');
    if (validReservations.length === 0) {
      toast({
        title: 'Nenhuma reserva válida',
        description: 'Corrija os erros antes de importar.',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    cancelRef.current = false;
    let success = 0;
    let failed = 0;
    let cancelled = 0;

    const updatedData = [...parsedData];

    for (let i = 0; i < validReservations.length; i++) {
      // Check for cancellation
      if (cancelRef.current) {
        cancelled = validReservations.length - i;
        break;
      }

      const reservation = validReservations[i];
      const dataIndex = parsedData.findIndex(r => r.row === reservation.row);

      try {
        const startDatetime = `${reservation.date}T${reservation.startTime}:00`;
        const endDatetime = `${reservation.date}T${reservation.endTime}:00`;

        const { data: hasConflict } = await supabase.rpc('check_reservation_conflict', {
          p_room_id: reservation.roomId,
          p_start_datetime: startDatetime,
          p_end_datetime: endDatetime,
        });

        if (hasConflict) {
          updatedData[dataIndex] = {
            ...updatedData[dataIndex],
            processed: true,
            success: false,
            status: 'error',
            errors: [...updatedData[dataIndex].errors, 'Conflito de horário com outra reserva'],
          };
          failed++;
        } else {
          const { error } = await supabase
            .from('reservations')
            .insert({
              title: reservation.title,
              room_id: reservation.roomId,
              start_datetime: startDatetime,
              end_datetime: endDatetime,
              requester_name: reservation.requesterName,
              requester_email: reservation.requesterEmail,
              attendees_count: reservation.attendeesCount,
              status: 'confirmed',
              is_external: reservation.reservationType === 'free',
              is_fixed: reservation.reservationType === 'fixed',
            });

          if (error) throw error;

          updatedData[dataIndex] = {
            ...updatedData[dataIndex],
            processed: true,
            success: true,
          };
          success++;
        }
      } catch (error: any) {
        console.error('Error creating reservation:', error);
        updatedData[dataIndex] = {
          ...updatedData[dataIndex],
          processed: true,
          success: false,
          status: 'error',
          errors: [...updatedData[dataIndex].errors, error.message || 'Erro ao criar reserva'],
        };
        failed++;
      }

      setImportProgress(Math.round(((i + 1) / validReservations.length) * 100));
      setParsedData([...updatedData]);
    }

    setImportResults({ success, failed, cancelled });
    setIsImporting(false);
    setIsCancelling(false);
    setStep('results');

    if (cancelRef.current) {
      toast({
        title: 'Importação cancelada',
        description: `${success} reservas criadas antes do cancelamento.`,
        variant: 'default',
      });
    } else {
      toast({
        title: 'Importação concluída',
        description: `${success} reservas criadas, ${failed} erros.`,
        variant: success > 0 ? 'default' : 'destructive',
      });
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      ['Título/Disciplina', 'Sala', 'Data', 'Hora Início', 'Hora Fim', 'Professor', 'Email', 'Participantes', 'Tipo'],
      ['Matemática I', 'SALA-101', '15/01/2025', '08:00', '10:00', 'Prof. João Silva', 'joao@email.com', 30, 'Fixa'],
      ['Física II', 'SALA-102', '15/01/2025', '10:00', '12:00', 'Prof. Maria Santos', 'maria@email.com', 25, 'Regular'],
      ['Reunião Externa', 'SALA-103', '16/01/2025', '14:00', '16:00', 'Visitante', 'visitante@email.com', 10, 'Livre'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cronograma');
    XLSX.writeFile(wb, 'modelo_cronograma_reservas.xlsx');
  };

  const validCount = parsedData.filter(r => r.status === 'valid').length;
  const errorCount = parsedData.filter(r => r.status === 'error').length;

  const getTypeLabel = (type: 'fixed' | 'free' | 'regular') => {
    switch (type) {
      case 'fixed': return 'Fixa';
      case 'free': return 'Livre';
      default: return 'Regular';
    }
  };

  const getTypeIcon = (type: 'fixed' | 'free' | 'regular') => {
    switch (type) {
      case 'fixed': return <Pin className="w-3 h-3" />;
      case 'free': return <Calendar className="w-3 h-3" />;
      default: return <Calendar className="w-3 h-3" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar Cronograma de Reservas
          </DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo Excel (.xlsx, .xls) com o cronograma de aulas/reservas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'upload' && (
            <div className="space-y-6 py-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Formato do arquivo</AlertTitle>
                <AlertDescription>
                  Colunas obrigatórias: <strong>Título/Disciplina</strong>, <strong>Sala</strong>, <strong>Data</strong>, <strong>Hora Início</strong>. 
                  Opcionais: Hora Fim, Professor, Email, Participantes, <strong>Tipo</strong> (Fixa/Livre/Regular).
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <Label>Tipo padrão de reserva (caso não especificado no arquivo)</Label>
                <Select value={defaultReservationType} onValueChange={(v: 'fixed' | 'free' | 'regular') => setDefaultReservationType(v)}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">
                      <span className="flex items-center gap-2"><Pin className="w-4 h-4" /> Reserva Fixa (recorrente)</span>
                    </SelectItem>
                    <SelectItem value="free">
                      <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Reserva Livre (externa/avulsa)</span>
                    </SelectItem>
                    <SelectItem value="regular">
                      <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Reserva Regular</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="excel-upload"
                />
                <label htmlFor="excel-upload" className="cursor-pointer">
                  {isProcessing ? (
                    <div className="space-y-3">
                      <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                      <p className="text-muted-foreground">Processando arquivo...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">Arraste o arquivo ou clique para selecionar</p>
                        <p className="text-sm text-muted-foreground">Suporta arquivos .xlsx e .xls</p>
                      </div>
                    </div>
                  )}
                </label>
              </div>

              <Button variant="outline" onClick={downloadTemplate} className="w-full gap-2">
                <Download className="w-4 h-4" />
                Baixar modelo de planilha
              </Button>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 flex-wrap">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {validCount} válidas
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    {errorCount} com erros
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {parsedData.length} linhas encontradas
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Label className="text-sm">Aplicar tipo a todas:</Label>
                  <Select value={defaultReservationType} onValueChange={(v: 'fixed' | 'free' | 'regular') => setDefaultReservationType(v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixa</SelectItem>
                      <SelectItem value="free">Livre</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={applyDefaultTypeToAll}>
                    Aplicar
                  </Button>
                </div>
              </div>

              {isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{isCancelling ? 'Cancelando...' : 'Importando reservas...'}</span>
                    <span className="text-sm text-muted-foreground ml-auto">{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}

              <ScrollArea className="h-[350px] rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Linha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Sala</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((item, idx) => (
                      <TableRow key={idx} className={item.status === 'error' ? 'bg-destructive/10' : ''}>
                        <TableCell className="font-mono text-xs">{item.row}</TableCell>
                        <TableCell>
                          {item.processed ? (
                            item.success ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="w-3 h-3" />OK
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="w-3 h-3" />Falhou
                              </Badge>
                            )
                          ) : item.status === 'valid' ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" />Válida
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="w-3 h-3" />Erro
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate" title={item.title}>
                          {item.title}
                        </TableCell>
                        <TableCell>{item.roomCode}</TableCell>
                        <TableCell>{item.date ? format(new Date(item.date), 'dd/MM/yyyy') : '-'}</TableCell>
                        <TableCell>{item.startTime} - {item.endTime}</TableCell>
                        <TableCell>
                          {!item.processed && item.status === 'valid' ? (
                            <Select
                              value={item.reservationType}
                              onValueChange={(v: 'fixed' | 'free' | 'regular') => updateReservationType(item.row, v)}
                            >
                              <SelectTrigger className="w-24 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fixed">Fixa</SelectItem>
                                <SelectItem value="free">Livre</SelectItem>
                                <SelectItem value="regular">Regular</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              {getTypeIcon(item.reservationType)}
                              {getTypeLabel(item.reservationType)}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {errorCount > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Erros encontrados</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="max-h-32">
                      <ul className="text-xs space-y-1 mt-2">
                        {parsedData.filter(r => r.errors.length > 0).map((r, i) => (
                          <li key={i}>
                            <strong>Linha {r.row}:</strong> {r.errors.join('; ')}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === 'results' && (
            <div className="space-y-6 py-4 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                {importResults.cancelled > 0 ? (
                  <StopCircle className="w-10 h-10 text-yellow-500" />
                ) : importResults.failed === 0 ? (
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                ) : importResults.success > 0 ? (
                  <AlertTriangle className="w-10 h-10 text-yellow-500" />
                ) : (
                  <XCircle className="w-10 h-10 text-destructive" />
                )}
              </div>

              <div>
                <h3 className="text-xl font-bold text-foreground">
                  {importResults.cancelled > 0 ? 'Importação Cancelada' : 'Importação Concluída'}
                </h3>
                <p className="text-muted-foreground mt-1">
                  {importResults.success > 0 
                    ? `${importResults.success} reservas foram criadas com sucesso.`
                    : 'Nenhuma reserva foi criada.'}
                </p>
              </div>

              <div className="flex justify-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{importResults.success}</div>
                  <div className="text-sm text-muted-foreground">Sucesso</div>
                </div>
                {importResults.failed > 0 && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-destructive">{importResults.failed}</div>
                    <div className="text-sm text-muted-foreground">Falhas</div>
                  </div>
                )}
                {importResults.cancelled > 0 && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-500">{importResults.cancelled}</div>
                    <div className="text-sm text-muted-foreground">Canceladas</div>
                  </div>
                )}
              </div>

              {importResults.failed > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Algumas reservas falharam</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="max-h-32">
                      <ul className="text-xs space-y-1 mt-2 text-left">
                        {parsedData.filter(r => r.processed && !r.success).map((r, i) => (
                          <li key={i}>
                            <strong>Linha {r.row} ({r.title}):</strong> {r.errors.join('; ')}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetState} disabled={isImporting}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Recomeçar
              </Button>
              {isImporting ? (
                <Button variant="destructive" onClick={handleCancelImport} disabled={isCancelling}>
                  <StopCircle className="w-4 h-4 mr-2" />
                  {isCancelling ? 'Cancelando...' : 'Cancelar Importação'}
                </Button>
              ) : (
                <Button onClick={handleImport} disabled={validCount === 0}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar {validCount} reservas
                </Button>
              )}
            </>
          )}
          {step === 'results' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}