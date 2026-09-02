import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail, Shield, WifiOff, RefreshCw, Eye, EyeOff, Headphones } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import vegSystemLogo from '@/assets/veg-system-logo.png';
import { useHealthCheck } from '@/hooks/useHealthCheck';
const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'Senha deve ter no mínimo 6 caracteres' }),
});

export default function AdminAuth() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, role } = useAuth();
  const { toast } = useToast();
  const { status: serverStatus, retry: retryHealthCheck, isOnline } = useHealthCheck();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // If user is already logged in with a role, redirect to dashboard
    if (user && !authLoading && role) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, role, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast({
        title: 'Email obrigatório',
        description: 'Informe o email para redefinir a senha.',
        variant: 'destructive',
      });
      return;
    }

    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/change-password`,
    });
    setForgotLoading(false);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Email enviado',
        description: 'Verifique sua caixa de entrada para redefinir a senha.',
      });
      setShowForgotPassword(false);
      setForgotEmail('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    let signInResult: { data: any; error: any };
    try {
      signInResult = await supabase.auth.signInWithPassword({
        email,
        password,
      });
    } catch (err) {
      toast({
        title: 'Falha de conexão',
        description: 'Não foi possível conectar ao servidor de login. Verifique sua internet/rede (VPN, firewall ou bloqueador de anúncios) e tente novamente.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    const { error, data } = signInResult;

    if (error) {
      const raw = String(error.message ?? '');
      const isNetwork = /failed to fetch/i.test(raw) || /network/i.test(raw);

      if (isNetwork) {
        toast({
          title: 'Falha de conexão',
          description:
            'Não foi possível conectar ao servidor de login. Verifique internet/rede (VPN, firewall ou bloqueador de anúncios) e tente novamente.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      let message = 'Erro ao fazer login. Verifique suas credenciais.';
      if (raw.includes('Invalid login credentials')) {
        message = 'Email ou senha incorretos.';
      } else if (raw.includes('Email not confirmed')) {
        message = 'Email não confirmado. Contate o administrador.';
      } else if (raw.includes('User not found')) {
        message = 'Usuário não encontrado.';
      }

      toast({
        title: 'Falha no login',
        description: message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }


    if (data.user) {
      // Não bloqueie o login validando permissões aqui.
      // A validação de papel/perfil acontece no AuthContext/ProtectedRoute.
      // Isso evita loops quando o backend está instável ou a consulta de roles falha.
      toast({
        title: 'Login realizado',
        description: 'Validando permissões...',
      });
      navigate('/', { replace: true });
    }


    setIsLoading(false);
  };

  // Server status is informational; do not block the login UI.
  // (The /auth/v1/health endpoint can be slow or blocked by network policies even when login works.)
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
          <Loader2 className="w-12 h-12 animate-spin text-primary relative" />
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#070918] px-4 py-7 text-white sm:px-6 sm:py-12 lg:py-[7.6vh]">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(89,42,179,0.18),transparent_35%),radial-gradient(circle_at_10%_20%,rgba(80,38,159,0.11),transparent_27%),linear-gradient(145deg,#080a1c_0%,#080a18_50%,#050713_100%)]" />
        <div className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:4px_4px]" />
      </div>

      <Card className="relative z-10 mx-auto w-full max-w-[806px] overflow-hidden rounded-[27px] border border-[#756292]/45 bg-[linear-gradient(145deg,rgba(24,24,50,.94),rgba(9,12,29,.97)_58%,rgba(18,16,42,.95))] text-white shadow-[0_0_0_1px_rgba(183,112,255,.07),0_0_38px_rgba(126,48,218,.22),0_35px_100px_rgba(0,0,0,.42)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[27px] before:bg-[radial-gradient(circle_at_7%_2%,rgba(231,128,255,.2),transparent_12%),radial-gradient(circle_at_100%_100%,rgba(194,80,255,.10),transparent_15%)] animate-fade-in">
        <div className="pointer-events-none absolute left-0 top-0 h-24 w-24 rounded-tl-[27px] border-l-2 border-t-2 border-fuchsia-300/70 opacity-90 shadow-[-5px_-4px_16px_rgba(215,110,255,.35)] [mask-image:linear-gradient(135deg,#000,transparent_62%)]" />

        <CardHeader className="relative px-6 pb-0 pt-8 text-center sm:px-12 sm:pt-12 lg:px-[74px] lg:pt-[58px]">
          <div className="relative mx-auto mb-3 flex h-[150px] w-full max-w-[340px] items-center justify-center sm:mb-5 sm:h-[190px]">
            <div className="absolute h-28 w-64 rounded-full bg-violet-600/20 blur-[45px]" />
            <img
              src={vegSystemLogo}
              alt="VEG System"
              className="absolute h-auto w-[360px] max-w-none sm:w-[460px]"
              style={{ filter: 'drop-shadow(0 0 10px rgba(185,82,255,.75)) drop-shadow(0 0 28px rgba(112,38,221,.42))' }}
            />
          </div>

          <div className="mb-2 flex items-center justify-center gap-3 sm:gap-5">
            <Shield className="h-9 w-9 shrink-0 stroke-[1.8] text-[#b54cff] sm:h-12 sm:w-12" />
            <CardTitle className="text-[29px] font-bold tracking-[-0.025em] text-[#f6f4fb] sm:text-[42px]">
              Área Administrativa
            </CardTitle>
          </div>
          <CardDescription className="text-base font-normal tracking-[0.01em] text-[#aca9c1] sm:text-[23px]">
            Acesso exclusivo para colaboradores autorizados
          </CardDescription>

          <div className="mx-auto mt-4 inline-flex min-h-10 items-center justify-center gap-3 rounded-full border border-[#9e4ace]/50 bg-[#17152d]/80 px-5 text-sm text-[#ded9e9] sm:text-base">
            {serverStatus === 'checking' ? (
              <><RefreshCw className="h-4 w-4 animate-spin text-[#aa52f4]" /><span>Verificando sistema…</span></>
            ) : serverStatus === 'online' ? (
              <><span className="h-3 w-3 rounded-full bg-[#aa52f4] shadow-[0_0_0_5px_rgba(168,82,244,.15),0_0_12px_rgba(168,82,244,.8)]" /><span>Sistema operacional</span></>
            ) : (
              <><WifiOff className="h-4 w-4 text-[#d783ff]" /><span>{isOnline ? 'Sistema indisponível' : 'Sem internet'}</span><button type="button" onClick={retryHealthCheck} className="text-[#cb6cff] hover:underline">Tentar novamente</button></>
            )}
          </div>
        </CardHeader>

        <CardContent className="relative px-6 pb-7 pt-7 sm:px-12 sm:pb-9 sm:pt-9 lg:px-[74px]">
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="forgot-email" className="text-base font-semibold text-[#f5f2fa] sm:text-lg">Email corporativo</Label>
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#bd5dff] transition-colors group-focus-within:text-[#db9bff]" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu.email@empresa.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="h-[66px] rounded-2xl border-[#685484]/75 bg-[#121426]/80 pl-14 text-base text-white shadow-inner placeholder:text-[#767389] focus-visible:border-[#b75dff] focus-visible:ring-2 focus-visible:ring-[#9d42e8]/25 sm:text-lg"
                    disabled={forgotLoading}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="h-[68px] w-full rounded-2xl border-0 bg-[linear-gradient(100deg,#7629f5_0%,#b528f2_50%,#f11bc9_100%)] text-lg font-bold text-white shadow-[0_10px_28px_rgba(157,36,238,.28)] transition hover:brightness-110 sm:text-xl"
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar link de redefinição'
                )}
              </Button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-base text-[#c45cff] hover:underline"
              >
                Voltar ao login
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-base font-semibold text-[#f5f2fa] sm:text-lg">Email corporativo</Label>
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#bd5dff] transition-colors group-focus-within:text-[#db9bff]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`h-[66px] rounded-2xl border-[#685484]/75 bg-[#121426]/80 pl-14 text-base text-white shadow-inner placeholder:text-[#767389] focus-visible:border-[#b75dff] focus-visible:ring-2 focus-visible:ring-[#9d42e8]/25 sm:text-lg ${errors.email ? 'border-red-500' : ''}`}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive animate-fade-in">{errors.email}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="password" className="text-base font-semibold text-[#f5f2fa] sm:text-lg">Senha</Label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#bd5dff] transition-colors group-focus-within:text-[#db9bff]" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`h-[66px] rounded-2xl border-[#685484]/75 bg-[#121426]/80 px-14 text-base text-white shadow-inner placeholder:text-[#b8b4c8] focus-visible:border-[#b75dff] focus-visible:ring-2 focus-visible:ring-[#9d42e8]/25 sm:text-lg ${errors.password ? 'border-red-500' : ''}`}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#a968e6] transition hover:text-[#d193ff]" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                    {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive animate-fade-in">{errors.password}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="mt-1 h-[68px] w-full rounded-2xl border-0 bg-[linear-gradient(100deg,#7629f5_0%,#b528f2_50%,#f11bc9_100%)] text-lg font-bold text-white shadow-[0_10px_28px_rgba(157,36,238,.28)] transition hover:brightness-110 sm:text-xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="w-full pt-0 text-base font-medium text-[#c45cff] transition hover:text-[#df91ff] hover:underline sm:text-lg"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          <div className="mt-5 border-t border-[#615c76]/45 py-5 sm:mt-6 sm:py-6">
            <div className="flex items-center justify-center gap-4 text-center text-sm leading-relaxed text-[#aaa6bd] sm:text-left sm:text-base">
              <Headphones className="h-7 w-7 shrink-0 text-[#bd58ff]" />
              <span>Problemas para acessar?<br /><a href="https://wa.me/5531992931686" target="_blank" rel="noopener noreferrer" className="font-medium text-[#c75fff] transition hover:text-[#e097ff] hover:underline">Fale com o administrador pelo WhatsApp.</a></span>
            </div>
          </div>

          <footer className="flex items-center gap-4 border-t border-[#615c76]/55 pt-5 text-[#aaa6bd] sm:gap-5">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden sm:h-14 sm:w-14" aria-hidden="true">
              <img src={vegSystemLogo} alt="" className="absolute -left-[12px] -top-[53px] h-auto w-[150px] max-w-none sm:-left-[14px] sm:-top-[61px] sm:w-[175px]" style={{ filter: 'drop-shadow(0 0 6px rgba(180,76,255,.55))' }} />
            </div>
            <div className="min-w-0 text-xs leading-relaxed sm:text-sm">
              <p><span className="font-semibold text-[#d4d0df]">VEG System</span> — idealizado, projetado e desenvolvido por <span className="font-semibold text-[#d85dff]">Vinicius Ezequiel</span>.</p>
              <p className="mt-1">© {new Date().getFullYear()} • Todos os direitos reservados.</p>
            </div>
          </footer>
        </CardContent>
      </Card>
    </main>
  );
}
