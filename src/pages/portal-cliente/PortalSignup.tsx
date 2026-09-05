import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, CalendarDays, CheckCircle2, IdCard, Loader2, LockKeyhole, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

export default function PortalSignup() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    cpf: '',
    sector: '',
    password: '',
    confirm: '',
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (form.password !== form.confirm) {
      toast.error('As senhas não conferem.');
      return;
    }
    if (form.password.length < 8) {
      toast.error('A senha deve ter ao menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/portal-cliente/login`,
          data: { full_name: form.full_name },
        },
      });

      if (signUpError) throw signUpError;
      const userId = signUpData.user?.id;
      if (!userId) throw new Error('Falha ao criar usuário.');

      const { error: profileError } = await supabase
        .from('external_users')
        .insert({
          user_id: userId,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          cpf: form.cpf,
          sector: form.sector || null,
          user_type: 'cliente',
        } as never);

      if (profileError) throw profileError;

      await supabase.auth.signOut();
      setSubmitted(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 to-transparent" />
        <Card className="relative w-full max-w-md border-border/60 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
          <CardContent className="p-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">Cadastro enviado</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Recebemos seus dados. Sua conta ficará disponível assim que a equipe responsável concluir a aprovação.
            </p>
            <Button className="mt-6 w-full" onClick={() => navigate('/portal-cliente/login')}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fieldIconClass = 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground';

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />

      <div className="relative mx-auto w-full max-w-2xl">
        <div className="mb-5 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Portal do Cliente</p>
            <p className="text-xs text-muted-foreground">Solicite seu acesso às reservas</p>
          </div>
        </div>

        <Card className="border-border/60 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
          <CardContent className="p-6 sm:p-7">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Criar cadastro</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Preencha seus dados. O acesso será liberado após aprovação da equipe.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="signup-name" className="text-xs text-muted-foreground">Nome completo *</Label>
                <div className="relative">
                  <User className={fieldIconClass} />
                  <Input id="signup-name" required value={form.full_name} onChange={event => setForm(current => ({ ...current, full_name: event.target.value }))} className="pl-9" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email" className="text-xs text-muted-foreground">E-mail *</Label>
                  <div className="relative">
                    <Mail className={fieldIconClass} />
                    <Input id="signup-email" type="email" required value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-phone" className="text-xs text-muted-foreground">Telefone</Label>
                  <div className="relative">
                    <Phone className={fieldIconClass} />
                    <Input id="signup-phone" value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} className="pl-9" />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-cpf" className="text-xs text-muted-foreground">CPF *</Label>
                  <div className="relative">
                    <IdCard className={fieldIconClass} />
                    <Input id="signup-cpf" required value={form.cpf} onChange={event => setForm(current => ({ ...current, cpf: event.target.value }))} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-sector" className="text-xs text-muted-foreground">Empresa / Setor</Label>
                  <div className="relative">
                    <Building2 className={fieldIconClass} />
                    <Input id="signup-sector" value={form.sector} onChange={event => setForm(current => ({ ...current, sector: event.target.value }))} className="pl-9" />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password" className="text-xs text-muted-foreground">Senha *</Label>
                  <div className="relative">
                    <LockKeyhole className={fieldIconClass} />
                    <Input id="signup-password" type="password" required minLength={8} value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} className="pl-9" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Mínimo de 8 caracteres.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-confirm" className="text-xs text-muted-foreground">Confirmar senha *</Label>
                  <div className="relative">
                    <LockKeyhole className={fieldIconClass} />
                    <Input id="signup-confirm" type="password" required value={form.confirm} onChange={event => setForm(current => ({ ...current, confirm: event.target.value }))} className="pl-9" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/25 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                Após o envio, sua conta ficará em análise. Você poderá acessar o portal somente depois da aprovação.
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar cadastro
              </Button>
            </form>

            <div className="mt-5 text-center text-sm">
              <span className="text-muted-foreground">Já tem conta? </span>
              <Link to="/portal-cliente/login" className="font-medium text-primary hover:underline">Entrar</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
