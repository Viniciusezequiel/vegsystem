import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { usePsImportEventTeam, type PsTeamImportRow } from '@/hooks/useProcessoSeletivo';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

/** Colunas da planilha oficial "CandidatosPagamento" */
export const PS_TEAM_COLUMNS = [
  'NOME', 'IDENTIDADE', 'CPF', 'EMAIL', 'TELEFONE', 'CELULAR', 'UNIDADE', 'SETOR',
  'INSTITUICAO', 'FUNCAO', 'PREDIO', 'ANDAR', 'SALA', 'VALOR', 'DEPOSITO', 'PIX',
];

const pick = (row: any, ...names: string[]) => {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((k) => k.trim().toLowerCase() === n.toLowerCase());
    if (k != null) {
      const v = row[k];
      if (v == null) return '';
      return String(v).replace(/\s+/g, ' ').trim();
    }
  }
  return '';
};

export function downloadTeamTemplate() {
  const example: Record<string, string> = {
    NOME: 'Maria Silva Souza',
    IDENTIDADE: 'MG-15.930.225',
    CPF: '125.404.086-21',
    EMAIL: 'maria.souza@empresa.org.br',
    TELEFONE: '(31)3450-6660',
    CELULAR: '(31)99367-6945',
    UNIDADE: 'FUNDAÇÃO EDUCACIONAL LUCAS MACHADO - FCMMG',
    SETOR: 'RECURSOS DIDATICOS',
    INSTITUICAO: 'Faculdade Ciências Médicas-MG',
    FUNCAO: 'Fiscal de Sala (Vestibular)',
    PREDIO: 'FCM-MG (Campus I)',
    ANDAR: '4º Andar',
    SALA: '401',
    VALOR: '170',
    DEPOSITO: 'Bco: 237 Ag.: 3435-5 Conta: 0561108-3 Tipo: CORRENTE',
    PIX: '12540408621',
  };
  const ws = XLSX.utils.json_to_sheet([example], { header: PS_TEAM_COLUMNS });
  ws['!cols'] = PS_TEAM_COLUMNS.map(() => ({ wch: 26 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
  XLSX.writeFile(wb, 'modelo-importacao-colaboradores.xlsx');
}

export function PsEventTeamImportDialog({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const importTeam = usePsImportEventTeam();
  const [preview, setPreview] = useState<PsTeamImportRow[]>([]);
  const [fileName, setFileName] = useState('');

  const readFile = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const raw: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const rows: PsTeamImportRow[] = raw
        .map((r) => ({
          full_name: pick(r, 'NOME', 'Nome', 'NOME COMPLETO'),
          identity_doc: pick(r, 'IDENTIDADE', 'RG') || null,
          cpf: pick(r, 'CPF') || null,
          email: pick(r, 'EMAIL', 'E-MAIL') || null,
          phone: pick(r, 'TELEFONE') || null,
          mobile: pick(r, 'CELULAR') || null,
          unit: pick(r, 'UNIDADE') || null,
          sector: pick(r, 'SETOR') || null,
          institution: pick(r, 'INSTITUICAO', 'INSTITUIÇÃO') || null,
          role_name: pick(r, 'FUNCAO', 'FUNÇÃO') || null,
          building: pick(r, 'PREDIO', 'PRÉDIO') || null,
          floor: pick(r, 'ANDAR') || null,
          room: (pick(r, 'SALA') || '').replace(/^-$/, '') || null,
          pay_value: Number(String(pick(r, 'VALOR')).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0,
          deposit_info: pick(r, 'DEPOSITO', 'DEPÓSITO') || null,
          pix: pick(r, 'PIX') || null,
        }))
        .filter((r) => r.full_name);
      if (!rows.length) {
        toast.error('Nenhuma linha válida encontrada. Verifique a coluna NOME.');
        return;
      }
      setFileName(file.name);
      setPreview(rows);
    } catch (e: any) {
      toast.error(`Não foi possível ler a planilha: ${e.message}`);
    }
  };

  const confirm = async () => {
    await importTeam.mutateAsync({ eventId, rows: preview });
    setPreview([]);
    setFileName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setPreview([]); setFileName(''); } }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Importar colaboradores do evento</DialogTitle>
          <DialogDescription>
            Use a planilha oficial de pagamento (CandidatosPagamento). Colunas aceitas:{' '}
            {PS_TEAM_COLUMNS.join(', ')}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTeamTemplate}>
              <Download className="mr-2 h-4 w-4" />Baixar modelo da planilha
            </Button>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />Selecionar planilha
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
                />
              </label>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Pessoas já cadastradas (mesmo CPF ou mesmo nome) são reaproveitadas — não é criado um colaborador
            duplicado. As avaliações continuam separadas por evento e a nota média considera todos os eventos.
          </p>

          {preview.length > 0 && (
            <Card className="rounded-xl">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 border-b p-3 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="font-medium">{fileName}</span>
                  <span className="text-muted-foreground">· {preview.length} colaboradores</span>
                </div>
                <div className="max-h-72 divide-y overflow-y-auto">
                  {preview.map((r, i) => (
                    <div key={i} className="p-3 text-sm">
                      <p className="font-medium">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[r.role_name, r.sector, r.building, r.floor, r.room && `Sala ${r.room}`,
                          r.pay_value ? `R$ ${Number(r.pay_value).toFixed(2)}` : null]
                          .filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={!preview.length || importTeam.isPending}>
            Importar {preview.length || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
