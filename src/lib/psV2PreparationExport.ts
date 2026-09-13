import * as XLSX from 'xlsx';

const text = (value: unknown) => String(value ?? '').trim();
const slug = (value: unknown) => text(value).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function exportPsV2PreparationWorkbook(event: any, candidates: any[], team: any[]) {
  const candidateRows = candidates.map((candidate: any) => ({
    Nome: candidate.full_name || '',
    CPF: candidate.cpf || '',
    Inscricao: candidate.registration_number || '',
    Campus: candidate.campus || '',
    Sala: candidate.room || '',
    Assento: candidate.seat_number || candidate.seat || '',
    PCD_Atendimento: candidate.pcd_type || '',
  }));

  const roomMap = new Map<string, { Campus: string; Sala: string; Candidatos: number; PCD: number; Sem_assento: number }>();
  for (const candidate of candidates) {
    const campus = text(candidate.campus) || 'Sem campus';
    const room = text(candidate.room) || 'Sem sala';
    const key = `${campus}|${room}`.toLocaleLowerCase('pt-BR');
    const current = roomMap.get(key) || { Campus: campus, Sala: room, Candidatos: 0, PCD: 0, Sem_assento: 0 };
    current.Candidatos += 1;
    if (text(candidate.pcd_type)) current.PCD += 1;
    if (!text(candidate.seat_number || candidate.seat)) current.Sem_assento += 1;
    roomMap.set(key, current);
  }

  const activeTeam = team.filter((member: any) => member.participation_status !== 'replaced');
  const teamRows = activeTeam.map((member: any) => ({
    Nome: member.collaborator_name || '',
    Funcao: member.role_name || member.assigned_role || '',
    Unidade: member.unit || '',
    Andar: member.floor || '',
    Sala: member.room || '',
    Confirmacao: member.participation_status || '',
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(candidateRows), 'Candidatos');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([...roomMap.values()]), 'Salas');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(teamRows), 'Equipe');

  const eventName = slug(event?.name) || 'evento';
  XLSX.writeFile(workbook, `preparacao-${eventName}.xlsx`);
}
