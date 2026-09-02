import { FormEvent, useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { evaluatorLogin, normalizeEvaluatorUsername, storeEvaluatorToken } from '@/lib/psEvaluatorSession';

type Props = {
  eventId?: string;
  onAuthenticated?: () => void;
};

export default function PsEvaluatorLogin({ eventId, onAuthenticated }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!eventId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070918] px-5 text-white">
        <Card className="w-full max-w-md border-white/10 bg-white/[0.06] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Portal de Avaliação de Fiscais</CardTitle>
            <CardDescription className="text-white/60">Utilize o link de acesso fornecido pela organização.</CardDescription>
          </CardHeader>
          <CardContent><Button variant="outline" className="w-full" onClick={() => window.history.back()}><ArrowLeft />Voltar</Button></CardContent>
        </Card>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await evaluatorLogin(eventId, username, password);
      if (!result?.success) {
        setError(result?.expires_at ? 'Acesso temporariamente bloqueado. Tente novamente mais tarde.' : 'CPF ou senha inválidos.');
        return;
      }
      if (result.session_token) storeEvaluatorToken(eventId, result.session_token);
      onAuthenticated?.();
    } catch {
      setError('CPF ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070918] px-5 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(116,74,218,.2),transparent_32%),radial-gradient(circle_at_90%_85%,rgba(28,164,177,.12),transparent_28%)]" />
      <Card className="relative w-full max-w-[430px] border-white/10 bg-[#111426]/95 text-white shadow-[0_25px_90px_rgba(0,0,0,.45)]">
        <CardHeader className="space-y-4 px-7 pb-3 pt-8 sm:px-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary"><ShieldCheck className="h-6 w-6" /></div>
          <div>
            <CardTitle className="text-2xl">Portal de Avaliação de Fiscais</CardTitle>
            <CardDescription className="mt-2 text-white/60">Acesso exclusivo para coordenadores e subcoordenadores.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-7 pb-8 sm:px-9">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="evaluator-username" className="text-white/85">CPF</Label><Input id="evaluator-username" value={username} onChange={(e) => setUsername(normalizeEvaluatorUsername(e.target.value))} autoComplete="username" inputMode="numeric" placeholder="123.456.789-00" className="h-12 border-white/10 bg-white/[0.06] text-white" disabled={loading} /></div>
            <div className="space-y-2"><Label htmlFor="evaluator-password" className="text-white/85">Senha</Label><div className="relative"><Input id="evaluator-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-12 border-white/10 bg-white/[0.06] pr-12 text-white" disabled={loading} /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/55 hover:text-white">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></div>
            {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
            <Button type="submit" className="h-12 w-full" disabled={loading || !username || !password}>{loading ? <><Loader2 className="animate-spin" />Entrando...</> : 'Entrar no portal'}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}