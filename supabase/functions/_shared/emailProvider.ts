export type EmailMessage = { to: string; subject: string; text: string; html: string; metadata: Record<string,string> };
export type EmailResult = { id: string };
export interface EmailProvider { readonly name: string; send(message: EmailMessage): Promise<EmailResult>; }

export class ResendEmailProvider implements EmailProvider {
  readonly name='resend';
  constructor(private apiKey:string,private from:string) {}
  async send(message:EmailMessage):Promise<EmailResult>{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${this.apiKey}`},body:JSON.stringify({from:this.from,to:[message.to],subject:message.subject,text:message.text,html:message.html,tags:Object.entries(message.metadata).slice(0,10).map(([name,value])=>({name,value}))})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(`provider_http_${response.status}`);
    if(!data?.id) throw new Error('provider_message_id_missing');
    return {id:String(data.id)};
  }
}

export class BrevoEmailProvider implements EmailProvider {
  readonly name='brevo';
  constructor(private apiKey:string,private from:string) {}
  async send(message:EmailMessage):Promise<EmailResult>{
    const match=this.from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/); const sender=match?{name:match[1],email:match[2]}:{email:this.from.trim()};
    const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'content-type':'application/json','api-key':this.apiKey},body:JSON.stringify({sender,to:[{email:message.to}],subject:message.subject,textContent:message.text,htmlContent:message.html,params:message.metadata})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(`provider_http_${response.status}`);
    if(!data?.messageId) throw new Error('provider_message_id_missing');
    return {id:String(data.messageId)};
  }
}

export class FakeEmailProvider implements EmailProvider {
  readonly name='fake'; sent:EmailMessage[]=[];
  async send(message:EmailMessage):Promise<EmailResult>{this.sent.push(message);return {id:`fake-${crypto.randomUUID()}`};}
}

export function configuredEmailProvider():EmailProvider {
  const provider=(Deno.env.get('PS_EMAIL_PROVIDER')||'brevo').toLowerCase();
  if(provider==='fake') return new FakeEmailProvider();
  const from=Deno.env.get('PS_EMAIL_FROM');
  if(provider==='brevo') { const key=Deno.env.get('BREVO_API_KEY'); if(!key||!from) throw new Error('email_provider_not_configured'); return new BrevoEmailProvider(key,from); }
  if(provider!=='resend') throw new Error('unsupported_email_provider');
  const key=Deno.env.get('RESEND_API_KEY');
  if(!key||!from) throw new Error('email_provider_not_configured');
  return new ResendEmailProvider(key,from);
}
