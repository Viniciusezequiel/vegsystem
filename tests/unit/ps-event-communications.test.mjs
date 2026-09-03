import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as esbuild from 'esbuild';
import { DEFAULT_CONFIRMATION_SUBJECT, DEFAULT_CONFIRMATION_TEMPLATE, DEFAULT_EVENT_MESSAGE_SUBJECT, DEFAULT_EVENT_MESSAGE_TEMPLATE, canRetryPsCommunication, filterPsCommunicationRecipients, formatPsEventDateBR, isPsQuotaDayEligible, planPsDailyQuota, renderPsCommunicationTemplate, resolvePsEmailRecipient, testModeSubject } from '../../src/lib/psCommunicationCore.mjs';
import { FakeEmailProvider, simulateEmailJob } from '../e2e/helpers/fake-email-provider.mjs';

const sql=fs.readFileSync(new URL('../../supabase/migrations/20260902100000_ps_event_communications.sql',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../../supabase/functions/ps-event-communications/index.ts',import.meta.url),'utf8');
const provider=fs.readFileSync(new URL('../../supabase/functions/_shared/emailProvider.ts',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../../src/components/processo-seletivo/PsEventCommunicationTab.tsx',import.meta.url),'utf8');

// Transpiles a Deno-targeted TS module (no external deps) so the exact same
// functions imported by the Edge Function can be exercised with real inputs,
// not a separately re-implemented mimic.
async function importDenoModule(relativePath){
  const src=fs.readFileSync(new URL(relativePath,import.meta.url),'utf8');
  const { code } = esbuild.transformSync(src, { loader: 'ts', format: 'esm' });
  const tmpFile = path.join(os.tmpdir(), `ps-module-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmpFile, code);
  try { return await import(`file://${tmpFile}`); } finally { fs.unlinkSync(tmpFile); }
}

const { renderConfirmationEmailHtml, renderEventMessageEmailHtml, escapeHtml, linkifyEscapedText } = await importDenoModule('../../supabase/functions/_shared/emailTemplates.ts');
const { selectJobsForProcessing } = await importDenoModule('../../supabase/functions/_shared/testModeBatch.ts');


const rows=[
  {id:'1',collaborator_name:'Ana',role_name:'Fiscal',unit:'Centro',room:'1',participation_status:'pending_confirmation'},
  {id:'2',collaborator_name:'Bruno',role_name:'Coordenador',unit:'Norte',room:'2',participation_status:'confirmed'},
  {id:'3',collaborator_name:'Carla',role_name:'Fiscal',unit:'Centro',room:'3',participation_status:'declined'},
];

test('seleção suporta individual, múltiplos, todos filtrados e filtros combinados',()=>{
  assert.deepEqual(filterPsCommunicationRecipients(rows,{search:'ana'}).map(r=>r.id),['1']);
  assert.deepEqual(filterPsCommunicationRecipients(rows,{role:'Fiscal',unit:'Centro'}).map(r=>r.id),['1','3']);
  assert.deepEqual(filterPsCommunicationRecipients(rows,{status:'confirmed',room:'2'}).map(r=>r.id),['2']);
  assert.match(ui,/Selecionar todos filtrados/); assert.match(ui,/destinatários selecionados/);
});

test('template resolve variáveis, URL correta e campos opcionais vazios',()=>{
  const rendered=renderPsCommunicationTemplate(DEFAULT_CONFIRMATION_TEMPLATE,{nome:'Ana',evento:'Evento',cargo:'Fiscal',data_evento:'02/09/2026',horario:'08h-12h',campus:'Centro',unidade:'Bloco A',predio:'A',andar:'2',sala:'201',link_confirmacao:'https://www.vegsystem.site/ps/confirmacao/e/t'});
  assert.match(rendered,/Olá, Ana/); assert.match(rendered,/https:\/\/www\.vegsystem\.site\/ps\/confirmacao/); assert.doesNotMatch(rendered,/undefined|null/);
  assert.match(rendered,/02\/09\/2026/); assert.match(rendered,/Centro \/ Bloco A/);
});

test('novo template padrão de mensagem geral usa as informações operacionais e assunto com {{evento}}',()=>{
  assert.match(DEFAULT_EVENT_MESSAGE_SUBJECT,/^Orientações para atuação no Processo Seletivo — \{\{evento\}\}$/);
  assert.match(DEFAULT_EVENT_MESSAGE_TEMPLATE,/Cargo\/Função: \{\{cargo\}\}/); assert.match(DEFAULT_EVENT_MESSAGE_TEMPLATE,/Data: \{\{data_evento\}\}/);
  assert.match(DEFAULT_EVENT_MESSAGE_TEMPLATE,/Campus\/Unidade: \{\{campus\}\} \/ \{\{unidade\}\}/);
  assert.doesNotMatch(DEFAULT_EVENT_MESSAGE_TEMPLATE,/cpf|CPF|pix|PIX|valor|banc[aá]rio|telefone pessoal/i);
});

test('novo template padrão de confirmação usa as informações operacionais, assunto com {{evento}} e o link',()=>{
  assert.match(DEFAULT_CONFIRMATION_SUBJECT,/^Confirmação de participação — \{\{evento\}\}$/);
  assert.match(DEFAULT_CONFIRMATION_TEMPLATE,/Cargo\/Função: \{\{cargo\}\}/); assert.match(DEFAULT_CONFIRMATION_TEMPLATE,/\{\{link_confirmacao\}\}/);
  assert.doesNotMatch(DEFAULT_CONFIRMATION_TEMPLATE,/cpf|CPF|pix|PIX|valor|banc[aá]rio|telefone pessoal/i);
});

test('formatPsEventDateBR converte YYYY-MM-DD para pt-BR e ignora valores vazios',()=>{
  assert.equal(formatPsEventDateBR('2026-09-02'),'02/09/2026');
  assert.equal(formatPsEventDateBR(''),''); assert.equal(formatPsEventDateBR(null),'');
});

test('test mode redireciona destinatário e prefixa assunto',()=>{
  assert.deepEqual(resolvePsEmailRecipient({logicalRecipient:'real@example.test',testMode:true,testRecipient:'test@example.test'}),{status:'pending',logicalRecipient:'real@example.test',actualRecipient:'test@example.test'});
  assert.equal(testModeSubject('Assunto',true),'[TESTE VEG SYSTEM] Assunto');
  assert.throws(()=>resolvePsEmailRecipient({logicalRecipient:'real@example.test',testMode:true,testRecipient:''}),/test_recipient_required/);
});

test('destinatário ausente não quebra lote',()=>assert.equal(resolvePsEmailRecipient({logicalRecipient:'',testMode:true,testRecipient:'test@example.test'}).status,'failed_missing_recipient'));

test('fila fake percorre pending-processing-sent e retry failed-sent',async()=>{
  const fake=new FakeEmailProvider({failOnce:true}); const job={status:'pending',attempt_count:0};
  await simulateEmailJob(fake,job,{to:'test@example.test'}); assert.equal(job.status,'failed'); assert.equal(job.attempt_count,1);
  await simulateEmailJob(fake,job,{to:'test@example.test'}); assert.equal(job.status,'sent'); assert.equal(job.attempt_count,2);
  assert.equal(canRetryPsCommunication({status:'sent'},{}),false); assert.equal(canRetryPsCommunication({status:'failed',communication_type:'confirmation_request'},{participation_status:'confirmed'}),false);
});

test('quota diária separa elegíveis sem classificar espera como falha',()=>{
  assert.deepEqual(planPsDailyQuota(['a','b'],299,300),{eligible:['a'],waiting:['b'],available:1});
  assert.deepEqual(planPsDailyQuota(['a'],300,300),{eligible:[],waiting:['a'],available:0});
  const batch=Array.from({length:500},(_,index)=>index);const plan=planPsDailyQuota(batch,0,300);
  assert.equal(plan.eligible.length,300);assert.equal(plan.waiting.length,200);
  assert.equal(isPsQuotaDayEligible('2026-09-02','2026-09-02'),false);assert.equal(isPsQuotaDayEligible('2026-09-02','2026-09-03'),true);
  assert.match(sql,/waiting_provider_quota/);assert.doesNotMatch("waiting_provider_quota",/failed/);
});

test('migration define histórico, estados, idempotência, versão e RLS interna',()=>{
  assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.ps_event_communications/); assert.match(sql,/UNIQUE \(idempotency_key\)/);
  assert.match(sql,/confirmation_token_version/); assert.match(sql,/ps_event_communications_confirmation_version_uidx/);
  assert.match(sql,/ps_email_daily_quota/);assert.match(sql,/ps_reserve_email_daily_quota/);assert.match(sql,/FOR UPDATE/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/); assert.match(sql,/is_internal_user\(auth\.uid\(\)\)/);
  assert.doesNotMatch(sql,/GRANT .* ON public\.ps_event_communications TO anon/);
});

test('duplo clique/job repetido não reprocessa sent e retry é sempre explícito',()=>{
  assert.match(edge,/upsert\(rows,\{onConflict:'idempotency_key',ignoreDuplicates:true\}\)/);
  assert.match(edge,/!\['pending','waiting_provider_quota','failed','failed_missing_recipient'\]\.includes\(job\.status\)/);
  assert.match(edge,/\.eq\('status',expected\)/);
  assert.match(edge,/action==='retry'/);assert.match(edge,/process_queue/);
  assert.match(edge,/waiting_provider_quota/);assert.match(edge,/ps_reserve_email_daily_quota/);
  assert.match(edge,/if\(!testMode\)/);assert.match(edge,/attempt_count:Number\(job\.attempt_count\|\|0\)\+1/);
});

test('backend exige autenticação/permissão, limita lote e não aceita provider key do frontend',()=>{
  assert.match(edge,/getClaims/); assert.match(edge,/is_internal_user/); assert.match(edge,/batchLimit=100/);assert.match(edge,/jobs\.slice\(0,batchLimit\)/);
  assert.match(edge,/PS_EMAIL_TEST_MODE/); assert.match(edge,/PS_EMAIL_TEST_RECIPIENT/); assert.match(edge,/PS_EMAIL_TEST_BATCH_LIMIT/); assert.match(edge,/production_email_disabled/);
  assert.match(edge,/dailyLimit=limit\('PS_EMAIL_DAILY_LIMIT',providerName==='brevo'\?300:100/);
  assert.doesNotMatch(`${ui}\n${edge}`,/VITE_.*(RESEND|EMAIL.*KEY|SMTP|SENDGRID|BREVO)/i);
});

test('Brevo é padrão; Resend continua selecionável; fake e provider inválido são tratados',()=>{
  assert.match(provider,/interface EmailProvider/); assert.match(provider,/class BrevoEmailProvider/); assert.match(provider,/class ResendEmailProvider/); assert.match(provider,/class FakeEmailProvider/);
  assert.match(provider,/BREVO_API_KEY/);assert.match(provider,/RESEND_API_KEY/);assert.match(provider,/\|\|'brevo'/);assert.match(provider,/unsupported_email_provider/);
  assert.match(provider,/https:\/\/api\.brevo\.com\/v3\/smtp\/email/);
});

test('token usa RPC existente, não é persistido em body/log e requested_at é atualizado',()=>{
  assert.match(sql,/public_confirmation_token_hash=encode\(extensions\.digest/); assert.match(sql,/confirmation_requested_at=now\(\)/);
  assert.match(edge,/ps_prepare_confirmation_communication/); assert.match(edge,/https:\/\/www\.vegsystem\.site\/ps\/confirmacao/);
  assert.doesNotMatch(sql,/public_confirmation_token\s+text/); assert.doesNotMatch(edge,/console\.(log|error)\([^\n]*token/i);
  assert.doesNotMatch(sql,/rendered_body|confirmation_url/);
  assert.match(edge,/if\(!testMode\)[\s\S]*ps_reserve_email_daily_quota[\s\S]*ps_prepare_confirmation_communication/);
});

test('Realtime usa event_id e payload mínimo sem conteúdo',()=>{
  assert.match(sql,/'communications_changed'/); assert.match(sql,/'ps:event:'\|\|NEW\.event_id/);
  const payload=sql.match(/jsonb_build_object\([\s\S]*?\),'communications_changed'/)?.[0]||'';
  assert.doesNotMatch(payload,/body_template|subject|recipient|token/);
  assert.match(ui,/usePsEventCommunications/);
});

test('e-mail de confirmação usa confirmationUrl direto no href, título e botão "Confirmar participação"',()=>{
  const url='https://www.vegsystem.site/ps/confirmacao/11111111-1111-1111-1111-111111111111/deadbeef';
  const fields={evento:'Vestibular',data_evento:'02/09/2026',cargo:'Fiscal de Sala',campus:'Centro',unidade:'Bloco A',predio:'Prédio 1',andar:'2',sala:'201',horario:'08h-12h'};
  const html=renderConfirmationEmailHtml('Olá, Ana.\n\nConfirme sua participação.',fields,url);
  assert.match(html,new RegExp(`href="${url}"`));
  assert.match(html,/Confirmação de participação/);
  assert.match(html,/Confirmar participação/);
  assert.match(html,/Este link é individual e destinado exclusivamente à sua confirmação\./);
  assert.match(html,/Se o botão não funcionar, copie e cole o endereço abaixo:/);
  assert.match(html,/Informações da atuação/);
  assert.match(html,/Vestibular/); assert.match(html,/02\/09\/2026/); assert.match(html,/Centro \/ Bloco A/);
  assert.match(html,/VEG System/);
  assert.match(html,/Processo Seletivo/);
  assert.match(html,/Mensagem automática enviada pelo sistema de gestão do processo seletivo\./);
  assert.match(html,/max-width:600px/);
});

test('card "Informações da atuação" some por completo quando não há nenhum campo preenchido; linhas vazias nunca aparecem',()=>{
  const html=renderConfirmationEmailHtml('Olá.',{},'https://www.vegsystem.site/ps/confirmacao/e/t');
  assert.doesNotMatch(html,/Informações da atuação/);
  const partial=renderEventMessageEmailHtml('Olá.',{evento:'Vestibular',horario:''});
  assert.match(partial,/Informações da atuação/); assert.match(partial,/Vestibular/);
  assert.doesNotMatch(partial,/Horário/); assert.doesNotMatch(partial,/Prédio/); assert.doesNotMatch(partial,/Andar/); assert.doesNotMatch(partial,/Sala/);
});

test('conteúdo dinâmico (texto e card) continua escapado contra HTML injection; somente confirmationUrl vai para o href',()=>{
  const malicious='<img src=x onerror=alert(1)>&"\'';
  const html=renderConfirmationEmailHtml(malicious,{evento:malicious,cargo:malicious,campus:malicious,unidade:malicious,predio:malicious,andar:malicious,sala:malicious,horario:malicious},'https://www.vegsystem.site/ps/confirmacao/e/t');
  assert.doesNotMatch(html,/<img\s/); assert.doesNotMatch(html,/<script/);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;&amp;&quot;&#39;/);
});

test('event_message preserva texto livre editável, transforma apenas URLs http/https em links e mostra o card de informações',()=>{
  const text='Olá <b>equipe</b>! Acesse https://www.vegsystem.site/ps/confirmacao/e/t, obrigado.';
  const html=renderEventMessageEmailHtml(text,{evento:'Vestibular',cargo:'Fiscal',data_evento:'02/09/2026'});
  assert.match(html,/Convocação para Processo Seletivo/);
  assert.doesNotMatch(html,/<b>equipe<\/b>/);
  assert.match(html,/&lt;b&gt;equipe&lt;\/b&gt;/);
  assert.match(html,/<a href="https:\/\/www\.vegsystem\.site\/ps\/confirmacao\/e\/t"[^>]*>https:\/\/www\.vegsystem\.site\/ps\/confirmacao\/e\/t<\/a>/);
  assert.match(html,/Informações da atuação/); assert.match(html,/Vestibular/);
  assert.doesNotMatch(html,/Confirmar participação/);
});

test('escapeHtml/linkifyEscapedText não interpretam HTML fornecido pelo usuário',()=>{
  assert.equal(escapeHtml('<script>alert(1)</script>'),'&lt;script&gt;alert(1)&lt;/script&gt;');
  const linked=linkifyEscapedText(escapeHtml('veja http://a.b/c?x=1&y=2.'));
  assert.match(linked,/<a href="http:\/\/a\.b\/c\?x=1&amp;y=2"[^>]*>http:\/\/a\.b\/c\?x=1&amp;y=2<\/a>\.$/);
});

test('edge function gera HTML dedicado por tipo, renderiza o assunto e mantém text/plain como fallback',()=>{
  assert.match(edge,/import \{ renderConfirmationEmailHtml, renderEventMessageEmailHtml \} from '\.\.\/_shared\/emailTemplates\.ts'/);
  assert.match(edge,/job\.communication_type==='confirmation_request'\s*\?\s*renderConfirmationEmailHtml\(text,infoFields,confirmationUrl\)/);
  assert.match(edge,/:\s*renderEventMessageEmailHtml\(text,infoFields\)/);
  assert.match(edge,/const renderedSubject=render\(job\.subject,values\);/);
  assert.match(edge,/provider\.send\(\{to:testMode\?testRecipient:logical,subject:renderedSubject,text,html,/);
  assert.doesNotMatch(edge,/white-space:pre-wrap;font-family:Arial,sans-serif/);
});

test('edge function busca os novos campos de ps_events/ps_event_collaborators e expõe as 16 variáveis novas',()=>{
  assert.match(edge,/PS_VARIABLE_KEYS=\['nome','evento','cargo','unidade','campus','instituicao','setor','predio','andar','sala','horario','data_evento','local_evento','descricao_evento','coordenador_evento','link_confirmacao'\]/);
  assert.match(edge,/from\('ps_events'\)\.select\('id,name,date,location,description,coordinator_name'\)/);
  assert.match(edge,/select\('id,event_id,collaborator_name,email,role_name,assigned_role,unit,campus,institution,sector,building,floor,room,work_schedule,participation_status'\)/);
  assert.match(edge,/formatDateBR=\(value\?:string\|null\)=>\{const match=String\(value\|\|''\)\.match/);
  assert.doesNotMatch(edge,/\bcpf\b|identity_doc|\bpix\b|deposit_info|pay_value|phone\b/);
});

test('TEST MODE: 4 jobs elegíveis com testBatchLimit=1 produz total=4, sent<=1, pending>=3 (mesma função do edge function)',()=>{
  const eligibleJobs=[{job:{id:'1'}},{job:{id:'2'}},{job:{id:'3'}},{job:{id:'4'}}];
  const {selected,deferred}=selectJobsForProcessing(eligibleJobs,{testMode:true,testBatchLimit:1});
  assert.equal(selected.length,1); assert.equal(deferred.length,3);
  assert.equal(selected.length+deferred.length,eligibleJobs.length);
  const total=eligibleJobs.length, sent=selected.length /* <=1: só chega ao provider.send() se o claim/envio tiver sucesso */, pending=deferred.length;
  assert.equal(total,4); assert.ok(sent<=1); assert.ok(pending>=3);
});

test('TEST MODE: o teto é por execução, não acumulado por evento — a próxima chamada recebe orçamento cheio novamente',()=>{
  const execA=selectJobsForProcessing([{job:{id:'1'}},{job:{id:'2'}},{job:{id:'3'}},{job:{id:'4'}}],{testMode:true,testBatchLimit:1});
  assert.deepEqual(execA.selected.map(x=>x.job.id),['1']); assert.deepEqual(execA.deferred.map(x=>x.job.id),['2','3','4']);
  // execução B, posterior e independente, processando os 3 que ficaram pending: recebe orçamento cheio de novo.
  const execB=selectJobsForProcessing(execA.deferred,{testMode:true,testBatchLimit:1});
  assert.equal(execB.selected.length,1); assert.equal(execB.deferred.length,2);
});

test('produção (testMode=false) não é limitada pelo corte estrutural de TEST MODE',()=>{
  const eligibleJobs=[{job:{id:'1'}},{job:{id:'2'}},{job:{id:'3'}},{job:{id:'4'}}];
  const {selected,deferred}=selectJobsForProcessing(eligibleJobs,{testMode:false,testBatchLimit:1});
  assert.equal(selected.length,4); assert.equal(deferred.length,0);
});

test('edge function usa exatamente selectJobsForProcessing (mesma lógica, não um contador solto) e não chama provider.send() para jobs adiados',()=>{
  assert.match(edge,/import \{ selectJobsForProcessing \} from '\.\.\/_shared\/testModeBatch\.ts'/);
  assert.match(edge,/const eligibleJobs:\{job:any;link:any;logical:string\}\[\]=\[\];/);
  assert.match(edge,/const \{selected:selectedForProcessing,deferred:deferredJobs\}=selectJobsForProcessing\(eligibleJobs,\{testMode,testBatchLimit\}\);/);
  assert.match(edge,/for\(const \{job\} of deferredJobs\)\{result\.pending\+\+;result\.details\.push\(\{id:job\.id,status:job\.status\}\);\}/);
  assert.match(edge,/for\(const \{job,link,logical\} of selectedForProcessing\)\{/);
  // provider.send só pode existir dentro do loop de selectedForProcessing.
  const sendCallCount=(edge.match(/=await provider\.send\(/g)||[]).length; assert.equal(sendCallCount,1);
  assert.doesNotMatch(edge,/let testProcessed/); assert.doesNotMatch(edge,/alreadySentTestCount/);
});

test('diagnóstico de TEST MODE exposto sem segredos: testBatchLimit, eligibleCount, selectedForProcessing',()=>{
  assert.match(edge,/const diagnostics=testMode\?\{testBatchLimit,eligibleCount:eligibleJobs\.length,selectedForProcessing:selectedForProcessing\.length\}:\{\};/);
  assert.match(edge,/\.\.\.result,\.\.\.diagnostics/);
  assert.doesNotMatch(edge,/diagnostics=testMode\?\{[^}]*(BREVO|RESEND|SERVICE_ROLE|API_KEY)/i);
});
