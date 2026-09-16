import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.2';
import { configuredEmailProvider } from '../_shared/emailProvider.ts';
import { renderConfirmationEmailHtml, renderEventMessageEmailHtml, renderTrainingReselectionEmailHtml } from '../_shared/emailTemplates.ts';
import { selectJobsForProcessing } from '../_shared/testModeBatch.ts';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-cron-secret',
  'Content-Type':'application/json',
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedTypes=new Set(['confirmation_request','event_message','training_reselection']);
const allowedActions=new Set(['enqueue','retry','config','process_queue','process_queue_worker','cancel_training_session','resend_training_reselection']);
const PS_VARIABLE_KEYS=['nome','evento','cargo','unidade','campus','instituicao','setor','predio','andar','sala','horario','data_evento','local_evento','descricao_evento','coordenador_evento','link_confirmacao','link_treinamento','motivo_cancelamento'];
const render=(template:string,values:Record<string,string>)=>PS_VARIABLE_KEYS.reduce((text,key)=>text.replaceAll(`{{${key}}}`,values[key]||''),template);
const formatDateBR=(value?:string|null)=>{const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return match?`${match[3]}/${match[2]}/${match[1]}`:'';};
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const limit=(name:string,fallback:number,max:number)=>{const parsed=Number(Deno.env.get(name)||fallback);return Number.isInteger(parsed)&&parsed>0?Math.min(parsed,max):fallback;};

async function selectQueuedJobs(admin:any,eventId:string,batchLimit:number,quotaDate:string){
  const {data:pending,error:pendingError}=await admin
    .from('ps_event_communications')
    .select('*')
    .eq('event_id',eventId)
    .eq('status','pending')
    .order('requested_at',{ascending:true})
    .limit(batchLimit);
  if(pendingError) throw pendingError;

  const jobs=[...(pending||[])];
  const remaining=batchLimit-jobs.length;
  if(remaining<=0) return jobs;

  const {data:waiting,error:waitingError}=await admin
    .from('ps_event_communications')
    .select('*')
    .eq('event_id',eventId)
    .eq('status','waiting_provider_quota')
    .lt('provider_quota_date',quotaDate)
    .order('requested_at',{ascending:true})
    .limit(remaining);
  if(waitingError) throw waitingError;

  jobs.push(...(waiting||[]));
  return jobs;
}

async function hasEligibleQueue(admin:any,eventId:string,quotaDate:string){
  const {count:pendingCount,error:pendingError}=await admin
    .from('ps_event_communications')
    .select('id',{count:'exact',head:true})
    .eq('event_id',eventId)
    .eq('status','pending');
  if(pendingError) throw pendingError;
  if((pendingCount||0)>0) return true;

  const {count:waitingCount,error:waitingError}=await admin
    .from('ps_event_communications')
    .select('id',{count:'exact',head:true})
    .eq('event_id',eventId)
    .eq('status','waiting_provider_quota')
    .lt('provider_quota_date',quotaDate);
  if(waitingError) throw waitingError;
  return (waitingCount||0)>0;
}

function scheduleWorker(url:string,serviceRoleKey:string,cronSecret:string,eventId:string){
  const request=fetch(`${url}/functions/v1/ps-event-communications`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${serviceRoleKey}`,
      'apikey':serviceRoleKey,
      'x-cron-secret':cronSecret,
    },
    body:JSON.stringify({action:'process_queue_worker',eventId}),
  }).then(async(response)=>{
    if(!response.ok){
      console.error('ps-event-communications worker chaining failed',{status:response.status});
    }
  }).catch(()=>{
    console.error('ps-event-communications worker chaining failed',{status:'network_error'});
  });

  const edgeRuntime=(globalThis as any).EdgeRuntime;
  if(edgeRuntime?.waitUntil) edgeRuntime.waitUntil(request);
  else void request;
}

serve(async req=>{
  if(req.method==='OPTIONS') return new Response(null,{headers:cors});
  if(req.method!=='POST') return json({error:'method_not_allowed'},405);

  try {
    const auth=req.headers.get('authorization');
    if(!auth?.startsWith('Bearer ')) return json({error:'unauthorized'},401);

    const url=Deno.env.get('SUPABASE_URL')!;
    const anonKey=Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin=createClient(url,serviceRoleKey);
    const input=await req.json().catch(()=>({}));
    const requestedAction=String(input.action||'enqueue');
    const action=allowedActions.has(requestedAction)?requestedAction:'enqueue';

    const cronSecret=Deno.env.get('RECURRING_TASKS_CRON_SECRET')||'';
    const providedCronSecret=req.headers.get('x-cron-secret')||'';
    const cronAuthorized=!!cronSecret&&providedCronSecret===cronSecret;
    let userId:string|undefined;

    if(cronAuthorized){
      if(action!=='process_queue_worker') return json({error:'forbidden'},403);
    }else{
      const userClient=createClient(url,anonKey,{global:{headers:{Authorization:auth}}});
      const {data:claims,error:claimsError}=await userClient.auth.getClaims(auth.slice(7));
      userId=claims?.claims?.sub as string|undefined;
      if(claimsError||!userId) return json({error:'unauthorized'},401);
      const {data:isInternal}=await admin.rpc('is_internal_user',{_user_id:userId});
      if(!isInternal) return json({error:'forbidden'},403);
      if(action==='process_queue_worker') return json({error:'forbidden'},403);
    }

    const eventId=String(input.eventId||'');
    if(!uuid.test(eventId)) return json({error:'invalid_event_id'},400);

    const testMode=Deno.env.get('PS_EMAIL_TEST_MODE')==='true';
    const productionEnabled=Deno.env.get('PS_EMAIL_PRODUCTION_ENABLED')==='true';
    const testRecipient=(Deno.env.get('PS_EMAIL_TEST_RECIPIENT')||'').trim();
    const providerName=(Deno.env.get('PS_EMAIL_PROVIDER')||'brevo').toLowerCase();
    const providerConfigured=providerName==='fake'||(providerName==='brevo'&&!!Deno.env.get('BREVO_API_KEY')&&!!Deno.env.get('PS_EMAIL_FROM'))||(providerName==='resend'&&!!Deno.env.get('RESEND_API_KEY')&&!!Deno.env.get('PS_EMAIL_FROM'));
    const batchLimit=limit('PS_EMAIL_BATCH_LIMIT',5,100);
    const dailyLimit=limit('PS_EMAIL_DAILY_LIMIT',providerName==='brevo'?300:100,10000);
    const testBatchLimit=limit('PS_EMAIL_TEST_BATCH_LIMIT',1,10);

    if(action==='config') return json({mode:testMode?'test':'production',provider:providerName,providerConfigured,testRecipientConfigured:!!testRecipient,productionEnabled,batchLimit,dailyLimit,testBatchLimit,quotaTimezone:'UTC',automaticQueue:true});
    if(!testMode&&!productionEnabled) return json({error:'production_email_disabled'},503);
    if(testMode&&!testRecipient) return json({error:'test_recipient_required'},503);

    const provider=configuredEmailProvider();
    const quotaDate=new Date().toISOString().slice(0,10);
    let jobs:any[]=[];
    let reselectionAffected=0;
    const {data:event}=await admin.from('ps_events').select('id,name,date,location,description,coordinator_name').eq('id',eventId).maybeSingle();
    if(!event) return json({error:'event_not_found'},404);

    if(action==='cancel_training_session'||action==='resend_training_reselection'){
      const sessionId=String(input.sessionId||'');
      const subject=String(input.subject||'').trim();
      const template=String(input.template||'');
      const requestKey=String(input.requestKey||'');
      if(!uuid.test(sessionId)||!subject||subject.length>200||!template||template.length>10000||!uuid.test(requestKey)) return json({error:'invalid_training_reselection'},400);

      let requests:any[]=[];
      if(action==='cancel_training_session'){
        const reason=String(input.reason||'').trim();
        if(!reason||reason.length>500) return json({error:'invalid_cancellation_reason'},400);
        const {data,error}=await admin.rpc('ps_cancel_training_session',{p_session_id:sessionId,p_reason:reason,p_created_by:userId||null});
        if(error){
          if(String(error.message||'').includes('no_alternative_training_session')) return json({error:'no_alternative_training_session'},400);
          throw error;
        }
        requests=data||[];
      }else{
        const {data,error}=await admin.from('ps_training_reselection_requests')
          .select('id,event_id,event_collaborator_id,training_group_id')
          .eq('event_id',eventId)
          .eq('cancelled_session_id',sessionId)
          .eq('status','pending');
        if(error) throw error;
        requests=data||[];
      }

      reselectionAffected=requests.length;
      if(requests.length){
        const linkIds=[...new Set(requests.map(request=>String(request.event_collaborator_id)))];
        const {data:links,error:linksError}=await admin.from('ps_event_collaborators')
          .select('id,event_id,email,participation_status')
          .eq('event_id',eventId)
          .in('id',linkIds);
        if(linksError||links?.length!==linkIds.length) return json({error:'recipient_scope_mismatch'},400);
        const linkById=new Map((links||[]).map(link=>[String(link.id),link]));
        const batchId=crypto.randomUUID();
        const rows=[];
        for(const request of requests){
          const link=linkById.get(String(request.event_collaborator_id));
          const logical=String(link?.email||'').trim()||null;
          const key=await hash(`${eventId}:${request.id}:training_reselection:${requestKey}`);
          rows.push({
            batch_id:batchId,
            event_id:eventId,
            event_collaborator_id:request.event_collaborator_id,
            communication_type:'training_reselection',
            training_reselection_request_id:request.id,
            logical_recipient:logical,
            actual_recipient:logical?(testMode?testRecipient:logical):null,
            subject:testMode?`[TESTE VEG SYSTEM] ${subject}`:subject,
            body_template:template,
            status:logical?'pending':'failed_missing_recipient',
            provider:providerName,
            test_mode:testMode,
            idempotency_key:key,
            created_by:userId,
            failed_at:logical?null:new Date().toISOString(),
            last_error:logical?null:'missing_recipient',
          });
        }
        const {error:insertError}=await admin.from('ps_event_communications').upsert(rows,{onConflict:'idempotency_key',ignoreDuplicates:true});
        if(insertError) throw insertError;
        const keys=rows.map(row=>row.idempotency_key);
        const {data}=await admin.from('ps_event_communications').select('*').in('idempotency_key',keys);
        jobs=data||[];
      }
    }else if(action==='enqueue'){
      const ids=Array.isArray(input.eventCollaboratorIds)?[...new Set(input.eventCollaboratorIds.map(String))]:[];
      if(!ids.length||ids.length>1000||ids.some(id=>!uuid.test(id))) return json({error:'invalid_recipients'},400);
      const type=String(input.communicationType||'');
      const subject=String(input.subject||'').trim();
      const template=String(input.template||'');
      const requestKey=String(input.requestKey||'');
      if(!allowedTypes.has(type)||!subject||subject.length>200||!template||template.length>10000||!uuid.test(requestKey)) return json({error:'invalid_message'},400);

      const {data:links,error:linksError}=await admin.from('ps_event_collaborators').select('id,event_id,collaborator_name,email,role_name,assigned_role,unit,building,floor,room,work_schedule,participation_status').eq('event_id',eventId).in('id',ids);
      if(linksError||links?.length!==ids.length) return json({error:'recipient_scope_mismatch'},400);

      const inactiveLinks=(links||[]).filter(link=>!['pending_confirmation','confirmed'].includes(String(link.participation_status||'')));
      if(inactiveLinks.length) return json({error:'inactive_recipients',recipientIds:inactiveLinks.map(link=>link.id)},400);

      if(type==='confirmation_request'&&(links||[]).some(link=>link.participation_status!=='pending_confirmation')){
        return json({error:'confirmation_recipient_not_pending'},400);
      }

      const batchId=crypto.randomUUID();
      const rows=[];
      for(const link of links||[]){
        const logical=String(link.email||'').trim()||null;
        const key=await hash(`${eventId}:${link.id}:${type}:${requestKey}`);
        rows.push({
          batch_id:batchId,
          event_id:eventId,
          event_collaborator_id:link.id,
          communication_type:type,
          logical_recipient:logical,
          actual_recipient:logical?(testMode?testRecipient:logical):null,
          subject:testMode?`[TESTE VEG SYSTEM] ${subject}`:subject,
          body_template:template,
          status:logical?'pending':'failed_missing_recipient',
          provider:providerName,
          test_mode:testMode,
          idempotency_key:key,
          created_by:userId,
          failed_at:logical?null:new Date().toISOString(),
          last_error:logical?null:'missing_recipient',
        });
      }

      const {error:insertError}=await admin.from('ps_event_communications').upsert(rows,{onConflict:'idempotency_key',ignoreDuplicates:true});
      if(insertError) throw insertError;
      const keys=rows.map(row=>row.idempotency_key);
      const {data}=await admin.from('ps_event_communications').select('*').in('idempotency_key',keys);
      jobs=data||[];
    }else if(action==='retry'){
      const ids=Array.isArray(input.jobIds)?[...new Set(input.jobIds.map(String))]:[];
      if(!ids.length||ids.length>100||ids.some(id=>!uuid.test(id))) return json({error:'invalid_jobs'},400);
      const {data,error}=await admin.from('ps_event_communications').select('*').eq('event_id',eventId).in('id',ids).in('status',['failed','failed_missing_recipient']);
      if(error) throw error;
      jobs=data||[];
    }else{
      jobs=await selectQueuedJobs(admin,eventId,batchLimit,quotaDate);
    }

    const processingJobs=jobs.slice(0,batchLimit);
    const result={
      total:jobs.length,
      sent:0,
      failed:0,
      missingRecipient:0,
      pending:Math.max(0,jobs.length-processingJobs.length),
      quotaWaiting:0,
      details:[] as Array<Record<string,unknown>>,
    };

    const eligibleJobs:{job:any;link:any;logical:string;reselection:any|null}[]=[];
    for(const job of processingJobs){
      if(!['pending','waiting_provider_quota','failed','failed_missing_recipient'].includes(job.status)){
        result.details.push({id:job.id,status:job.status});
        continue;
      }

      const {data:link}=await admin.from('ps_event_collaborators').select('id,event_id,collaborator_name,email,role_name,assigned_role,unit,campus,institution,sector,building,floor,room,work_schedule,participation_status').eq('id',job.event_collaborator_id).eq('event_id',eventId).maybeSingle();
      if(!link){
        result.failed++;
        result.details.push({id:job.id,status:'failed'});
        continue;
      }

      if(!['pending_confirmation','confirmed'].includes(String(link.participation_status||''))){
        await admin.from('ps_event_communications').update({status:'cancelled',last_error:'inactive_participant',updated_at:new Date().toISOString()}).eq('id',job.id);
        result.details.push({id:job.id,status:'cancelled'});
        continue;
      }

      if(job.communication_type==='confirmation_request'&&link.participation_status!=='pending_confirmation'){
        await admin.from('ps_event_communications').update({status:'cancelled',last_error:'confirmation_recipient_not_pending',updated_at:new Date().toISOString()}).eq('id',job.id);
        result.details.push({id:job.id,status:'cancelled'});
        continue;
      }

      let reselection=null;
      if(job.communication_type==='training_reselection'){
        const {data:request}=await admin.from('ps_training_reselection_requests')
          .select('id,status,reason')
          .eq('id',job.training_reselection_request_id)
          .eq('event_id',eventId)
          .maybeSingle();
        if(!request||request.status!=='pending'){
          await admin.from('ps_event_communications').update({status:'cancelled',last_error:'training_reselection_not_pending',updated_at:new Date().toISOString()}).eq('id',job.id);
          result.details.push({id:job.id,status:'cancelled'});
          continue;
        }
        reselection=request;
      }

      const logical=String(link.email||'').trim();
      if(!logical){
        await admin.from('ps_event_communications').update({status:'failed_missing_recipient',failed_at:new Date().toISOString(),last_error:'missing_recipient',updated_at:new Date().toISOString()}).eq('id',job.id);
        result.missingRecipient++;
        result.details.push({id:job.id,status:'failed_missing_recipient'});
        continue;
      }

      eligibleJobs.push({job,link,logical,reselection});
    }

    const {selected:selectedForProcessing,deferred:deferredJobs}=selectJobsForProcessing(eligibleJobs,{testMode,testBatchLimit});
    for(const {job} of deferredJobs){
      result.pending++;
      result.details.push({id:job.id,status:job.status});
    }

    for(const {job,link,logical,reselection} of selectedForProcessing){
      let quotaReserved=false;
      if(!testMode){
        const {data:quota,error:quotaError}=await admin.rpc('ps_reserve_email_daily_quota',{p_provider:provider.name,p_quota_date:quotaDate,p_daily_limit:dailyLimit});
        if(quotaError) throw quotaError;
        if(!quota?.[0]?.allowed){
          await admin.from('ps_event_communications').update({status:'waiting_provider_quota',provider:provider.name,provider_quota_date:quotaDate,updated_at:new Date().toISOString()}).eq('id',job.id).in('status',['pending','waiting_provider_quota','failed','failed_missing_recipient']);
          result.quotaWaiting++;
          result.details.push({id:job.id,status:'waiting_provider_quota'});
          continue;
        }
        quotaReserved=true;
      }

      const expected=job.status;
      const {data:claimed}=await admin.from('ps_event_communications').update({
        status:'processing',
        processing_at:new Date().toISOString(),
        attempt_count:Number(job.attempt_count||0)+1,
        last_error:null,
        logical_recipient:logical,
        actual_recipient:testMode?testRecipient:logical,
        updated_at:new Date().toISOString(),
      }).eq('id',job.id).eq('status',expected).select('id').maybeSingle();

      if(!claimed){
        if(quotaReserved) await admin.rpc('ps_release_email_daily_quota',{p_provider:provider.name,p_quota_date:quotaDate});
        result.pending++;
        continue;
      }

      try{
        let confirmationUrl='';
        let trainingReselectionUrl='';
        let version=null;
        if(job.communication_type==='confirmation_request'){
          const {data:prepared,error}=await admin.rpc('ps_prepare_confirmation_communication',{p_link_id:link.id});
          if(error||!prepared?.[0]?.token) throw new Error('confirmation_token_failed');
          version=prepared[0].token_version;
          confirmationUrl=`https://www.vegsystem.site/ps/confirmacao/${eventId}/${prepared[0].token}`;
          const {error:updateVersionError}=await admin.from('ps_event_communications').update({confirmation_token_version:version}).eq('id',job.id);
          if(updateVersionError) throw updateVersionError;
        }else if(job.communication_type==='training_reselection'){
          const {data:prepared,error}=await admin.rpc('ps_prepare_training_reselection_communication',{p_request_id:reselection.id});
          if(error||!prepared?.[0]?.token) throw new Error('training_reselection_token_failed');
          version=prepared[0].token_version;
          trainingReselectionUrl=`https://www.vegsystem.site/ps/treinamento/${eventId}/${prepared[0].token}`;
          const {error:updateVersionError}=await admin.from('ps_event_communications').update({confirmation_token_version:version}).eq('id',job.id);
          if(updateVersionError) throw updateVersionError;
        }

        const values={
          nome:link.collaborator_name,
          evento:event.name,
          cargo:link.role_name||link.assigned_role||'',
          unidade:link.unit||'',
          campus:link.campus||'',
          instituicao:link.institution||'',
          setor:link.sector||'',
          predio:link.building||'',
          andar:link.floor||'',
          sala:link.room||'',
          horario:link.work_schedule||'',
          data_evento:formatDateBR(event.date),
          local_evento:event.location||'',
          descricao_evento:event.description||'',
          coordenador_evento:event.coordinator_name||'',
          link_confirmacao:confirmationUrl,
          link_treinamento:trainingReselectionUrl,
          motivo_cancelamento:reselection?.reason||'',
        };
        const text=render(job.body_template,values);
        const renderedSubject=render(job.subject,values);
        const infoFields={evento:values.evento,data_evento:values.data_evento,cargo:values.cargo,campus:values.campus,unidade:values.unidade,predio:values.predio,andar:values.andar,sala:values.sala,horario:values.horario};
        const html=job.communication_type==='confirmation_request'
          ?renderConfirmationEmailHtml(text,infoFields,confirmationUrl)
          :job.communication_type==='training_reselection'
            ?renderTrainingReselectionEmailHtml(text,infoFields,trainingReselectionUrl)
            :renderEventMessageEmailHtml(text,infoFields);
        const delivered=await provider.send({to:testMode?testRecipient:logical,subject:renderedSubject,text,html,metadata:{module:'process-selection',event_id:eventId,type:job.communication_type}});

        await admin.from('ps_event_communications').update({
          status:'sent',
          provider:provider.name,
          provider_message_id:delivered.id,
          provider_quota_date:testMode?null:quotaDate,
          sent_at:new Date().toISOString(),
          failed_at:null,
          last_error:null,
          updated_at:new Date().toISOString(),
        }).eq('id',job.id);
        result.sent++;
        result.details.push({id:job.id,status:'sent'});
      }catch(error){
        if(quotaReserved) await admin.rpc('ps_release_email_daily_quota',{p_provider:provider.name,p_quota_date:quotaDate});
        const safe=error instanceof Error?error.message.slice(0,200):'send_failed';
        await admin.from('ps_event_communications').update({status:'failed',failed_at:new Date().toISOString(),last_error:safe,updated_at:new Date().toISOString()}).eq('id',job.id);
        result.failed++;
        result.details.push({id:job.id,status:'failed'});
      }
    }

    if(!testMode&&cronSecret&&['enqueue','cancel_training_session','resend_training_reselection','process_queue_worker'].includes(action)&&await hasEligibleQueue(admin,eventId,quotaDate)){
      scheduleWorker(url,serviceRoleKey,cronSecret,eventId);
    }

    const diagnostics=testMode?{testBatchLimit,eligibleCount:eligibleJobs.length,selectedForProcessing:selectedForProcessing.length}:{};
    return json({mode:testMode?'test':'production',provider:provider.name,reselectionAffected,...result,...diagnostics});
  }catch(error){
    console.error('ps-event-communications failed',{message:error instanceof Error?error.message:'internal_error'});
    return json({error:'internal_error'},500);
  }
});
