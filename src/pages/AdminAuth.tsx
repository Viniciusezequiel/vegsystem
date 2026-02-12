import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail, Shield, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';
import vegSystemLogo from '@/assets/veg-system-logo.png';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
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
      redirectTo: `${window.location.origin}/admin-auth`,
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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Animated Background Orbs */}
      <div className="floating-orb w-96 h-96 bg-primary/40 -top-48 -left-48 animate-float" style={{ animationDelay: '0s' }} />
      <div className="floating-orb w-80 h-80 bg-destructive/20 -bottom-40 -right-40 animate-float" style={{ animationDelay: '2s' }} />
      <div className="floating-orb w-64 h-64 bg-warning/20 top-1/3 right-1/4 animate-float" style={{ animationDelay: '4s' }} />
      
      {/* Mesh Gradient Overlay */}
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle collapsed />
      </div>
      
      <Card className="w-full max-w-md relative z-10 glass-morphism border-primary/20 shadow-glow animate-fade-in">
        <CardHeader className="text-center pb-4">
          {/* Logo with Glow Effect */}
          <div className="mx-auto mb-6 relative">
            <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl scale-150 animate-pulse" />
            <div className="w-28 h-28 relative flex items-center justify-center">
              <img 
                src={vegSystemLogo} 
                alt="VEG System Logo" 
                className="w-full h-full object-contain"
                style={{ filter: 'drop-shadow(0 0 20px hsl(265 85% 65% / 0.5))' }}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-primary" />
            <CardTitle className="text-3xl font-bold gradient-text">
              Área Administrativa
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Acesso restrito a colaboradores
          </CardDescription>
          {/* Server status indicator */}
          <div className="mt-3 flex items-center justify-center gap-2 text-xs">
            {serverStatus === 'checking' ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                <span className="text-muted-foreground">Verificando servidor…</span>
              </>
            ) : serverStatus === 'online' ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-primary" />
                <span className="text-muted-foreground">Servidor online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-destructive" />
                <span className="text-muted-foreground">
                  {isOnline ? 'Servidor indisponível' : 'Sem internet'}
                </span>
                <button
                  type="button"
                  onClick={retryHealthCheck}
                  className="text-primary hover:underline"
                >
                  Tentar novamente
                </button>
              </>
            )}
          </div>

        </CardHeader>
        
        <CardContent>
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-foreground font-medium">Email</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu.email@empresa.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={forgotLoading}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 btn-gradient text-primary-foreground font-semibold rounded-xl text-base"
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
                className="w-full text-sm text-primary hover:underline"
              >
                Voltar ao login
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">Email corporativo</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all ${errors.email ? 'border-destructive' : ''}`}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive animate-fade-in">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">Senha</Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all ${errors.password ? 'border-destructive' : ''}`}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive animate-fade-in">{errors.password}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 btn-gradient text-primary-foreground font-semibold rounded-xl text-base"
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
                className="w-full text-sm text-primary hover:underline mt-2"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
