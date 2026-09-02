import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DEFAULT_CONFIRMATION_TEMPLATE, canRetryPsCommunication, filterPsCommunicationRecipients, isPsQuotaDayEligible, planPsDailyQuota, renderPsCommunicationTemplate, resolvePsEmailRecipient, testModeSubject } from '../../src/lib/psCommunicationCore.mjs';
import { FakeEmailProvider, simulateEmailJob } from '../e2e/helpers/fake-email-provider.mjs';

const sql=fs.readFileSync(new URL('../../supabase/migrations/20260902100000_ps_event_communications.sql',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../../supabase/functions/ps-event-communications/index.ts',import.meta.url),'utf8');
const provider=fs.readFileSync(new URL('../../supabase/functions/_shared/emailProvider.ts',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../../src/components/processo-seletivo/PsEventCommunicationTab.tsx',import.meta.url),'utf8');

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
  const rendered=renderPsCommunicationTemplate(DEFAULT_CONFIRMATION_TEMPLATE,{nome:'Ana',evento:'Evento',cargo:'Fiscal',link_confirmacao:'https://www.vegsystem.site/ps/confirmacao/e/t'});
  assert.match(rendered,/Olá, Ana/); assert.match(rendered,/https:\/\/www\.vegsystem\.site\/ps\/confirmacao/); assert.doesNotMatch(rendered,/undefined|null/);
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
