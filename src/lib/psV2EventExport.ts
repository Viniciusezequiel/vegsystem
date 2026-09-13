import * as XLSX from 'xlsx';

const text = (value: unknown) => String(value ?? '').trim();
const slug = (value: unknown) => text(value).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const yesNo = (value: unknown) => value ? 'Sim' : 'Não';
const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString('pt-BR') : '';

export function exportPsV2EventWorkbook(event: any, candidates: any[], data: any) {
  const metrics = data?.metrics || {};
  const summaryRows = [
    { Indicador: 'Evento', Valor: event?.name || '' },
    { Indicador: 'Data', Valor: event?.date || '' },
    { Indicador: 'Local', Valor: event?.location || '' },
    { Indicador: 'Status', Valor: event?.status || '' },
    { Indicador: 'Candidatos', Valor: candidates.length },
    { Indicador: 'Equipe ativa', Valor: Number(metrics.team || 0) },
    { Indicador: 'Confirmados', Valor: Number(metrics.confirmed || 0) },
    { Indicador: 'Confirmações pendentes', Valor: Number(metrics.pendingConfirmation || 0) },
    { Indicador: 'Presentes', Valor: Number(metrics.present || 0) },
    { Indicador: 'Ausentes', Valor: Number(metrics.absent || 0) },
    { Indicador: 'Comunicações enviadas', Valor: Number(metrics.communicationSent || 0) },
    { Indicador: 'Falhas de comunicação', Valor: Number(metrics.communicationFailed || 0) },
    { Indicador: 'Avaliações', Valor: Number(metrics.evaluations || 0) },
    { Indicador: 'Autoavaliações', Valor: Number(metrics.selfEvaluations || 0) },
    { Indicador: 'Previsão financeira', Valor: Number(metrics.forecastTotal || 0) },
    { Indicador: 'Total com presença', Valor: Number(metrics.payableTotal || 0) },
  ];

  const teamRows = (data?.team || []).map((member: any) => ({
    Nome: member.collaborator_name || '',
    Email: member.email || '',
    Funcao: member.assigned_role || member.role_name || '',
    Unidade: member.unit || '',
    Andar: member.floor || '',
    Sala: member.room || '',
    Confirmacao: member.participation_status || '',
    Presente: yesNo(member.present || member.signed_at),
    Ausente: yesNo(member.absent),
    Avaliado: yesNo(member.evaluated),
    Valor_base: Number(member.pay_value || 0),
  }));

  const communicationRows = (data?.communications || []).map((item: any) => ({
    Tipo: item.communication_type || '',
    Status: item.status || '',
    Tentativas: Number(item.attempt_count || 0),
    Solicitado_em: dateTime(item.requested_at),
    Enviado_em: dateTime(item.sent_at),
    Falhou_em: dateTime(item.failed_at),
    Erro: item.last_error || '',
  }));

  const trainingRows = (data?.trainingGroups || []).flatMap((group: any) => {
    const sessions = (data?.trainingSessions || []).filter((session: any) => session.training_group_id === group.id);
    if (!sessions.length) return [{ Grupo: group.name || '', Obrigatorio: yesNo(group.required), Sessao: '', Local: '', Capacidade: '' }];
    return sessions.map((session: any) => ({
      Grupo: group.name || '',
      Obrigatorio: yesNo(group.required),
      Sessao: dateTime(session.starts_at),
      Local: session.location || '',
      Capacidade: session.capacity ?? '',
    }));
  });

  const financialRows = (data?.financialRows || []).map((row: any) => ({
    Nome: row.collaborator_name || '',
    Funcao: row.assigned_role || row.role_name || '',
    Presenca: yesNo(row.present || row.signed_at),
    Valor_total: Number(row.total || 0),
  }));

  const candidateRows = candidates.map((candidate: any) => ({
    Nome: candidate.full_name || '',
    CPF: candidate.cpf || '',
    Inscricao: candidate.registration_number || '',
    Campus: candidate.campus || '',
    Sala: candidate.room || '',
    Assento: candidate.seat_number || candidate.seat || '',
    PCD_Atendimento: candidate.pcd_type || '',
  }));

  const evaluationRows = (data?.evaluations || []).map((item: any) => ({
    ID: item.id || '',
    Nota_final: item.final_score ?? '',
    Criado_em: dateTime(item.created_at),
  }));
  const selfEvaluationRows = (data?.selfEvaluations || []).map((item: any) => ({
    ID: item.id || '',
    Criado_em: dateTime(item.created_at),
  }));

  const workbook = XLSX.utils.book_new();
  const append = (rows: any[], name: string) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Informacao: 'Sem registros' }]), name);
  append(summaryRows, 'Resumo');
  append(teamRows, 'Equipe');
  append(candidateRows, 'Candidatos');
  append(communicationRows, 'Comunicacoes');
  append(trainingRows, 'Treinamentos');
  append(evaluationRows, 'Avaliacoes');
  append(selfEvaluationRows, 'Autoavaliacoes');
  append(financialRows, 'Financeiro');

  XLSX.writeFile(workbook, `relatorio-evento-${slug(event?.name) || 'processo-seletivo'}.xlsx`);
}
