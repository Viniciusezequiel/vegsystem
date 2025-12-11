import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail, User, Phone, Sparkles, ArrowLeft, CreditCard } from 'lucide-react';
import { z } from 'zod';
import batmanLogo from '@/assets/batman-logo.png';

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'Senha deve ter no mínimo 6 caracteres' }),
});

const signupSchema = z.object({
  full_name: z.string().min(3, { message: 'Nome deve ter no mínimo 3 caracteres' }),
  email: z.string().trim().email({ message: 'Email inválido' }),
  cpf: z.string().min(11, { message: 'CPF deve ter 11 dígitos' }).max(14, { message: 'CPF inválido' }),
  phone: z.string().min(8, { message: 'Telefone deve ter no mínimo 8 caracteres' }),
  password: z.string().min(6, { message: 'Senha deve ter no mínimo 6 caracteres' }),
  confirmPassword: z.string().min(6, { message: 'Confirmação de senha obrigatória' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

const resetSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }),
});

// CPF mask function
const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export default function ExternalAuth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'reset'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Login state
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
  
  // Signup state
  const [signupData, setSignupData] = useState({
    full_name: '',
    email: '',
    cpf: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});
  
  // Reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/booking', { replace: true });
      }
      setIsCheckingAuth(false);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/booking', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});

    const result = loginSchema.safeParse(loginData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setLoginErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: loginData.email,
      password: loginData.password,
    });

    if (error) {
      let message = 'Erro ao fazer login. Verifique suas credenciais.';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Email ou senha incorretos.';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Email não confirmado. Verifique sua caixa de entrada.';
      }
      toast({
        title: 'Falha no login',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Login realizado',
        description: 'Bem-vindo ao sistema!',
      });
      navigate('/booking', { replace: true });
    }

    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErrors({});

    const result = signupSchema.safeParse(signupData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setSignupErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    const redirectUrl = `${window.location.origin}/booking`;
    const cpfDigits = signupData.cpf.replace(/\D/g, '');

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: signupData.email,
      password: signupData.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: signupData.full_name,
          phone: signupData.phone,
          cpf: cpfDigits,
          is_external: true,
        },
      },
    });

    if (authError) {
      let message = 'Erro ao criar conta.';
      if (authError.message.includes('already registered')) {
        message = 'Este email já está cadastrado.';
      }
      toast({
        title: 'Falha no cadastro',
        description: message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // Create external_users record
    if (authData.user) {
      const { error: profileError } = await (supabase as any)
        .from('external_users')
        .insert({
          user_id: authData.user.id,
          full_name: signupData.full_name,
          email: signupData.email,
          cpf: cpfDigits,
          phone: signupData.phone,
        });

      if (profileError) {
        console.error('Error creating external user profile:', profileError);
      }
    }

    toast({
      title: 'Cadastro realizado!',
      description: 'Você já pode fazer login.',
    });
    setActiveTab('login');
    setLoginData({ email: signupData.email, password: '' });
    setSignupData({
      full_name: '',
      email: '',
      cpf: '',
      phone: '',
      password: '',
      confirmPassword: '',
    });

    setIsLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    const result = resetSchema.safeParse({ email: resetEmail });
    if (!result.success) {
      setResetError(result.error.errors[0]?.message || 'Email inválido');
      return;
    }

    setIsLoading(true);

    const redirectUrl = `${window.location.origin}/booking-auth`;

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: redirectUrl,
    });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao enviar email de redefinição.',
        variant: 'destructive',
      });
    } else {
      setResetSent(true);
      toast({
        title: 'Email enviado',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });
    }

    setIsLoading(false);
  };

  if (isCheckingAuth) {
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
      {/* Animated Background */}
      <div className="floating-orb w-96 h-96 bg-primary/40 -top-48 -left-48 animate-float" />
      <div className="floating-orb w-80 h-80 bg-accent/30 -bottom-40 -right-40 animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute inset-0 mesh-gradient opacity-50" />

      <Card className="w-full max-w-md relative z-10 glass-morphism border-primary/20 shadow-glow animate-fade-in">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-6 relative">
            <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl scale-150 animate-pulse" />
            <div className="w-24 h-24 relative flex items-center justify-center">
              <img 
                src={batmanLogo} 
                alt="Logo" 
                className="w-full h-full object-contain"
                style={{ filter: 'drop-shadow(0 0 20px hsl(265 85% 65% / 0.5))' }}
              />
            </div>
          </div>
          
          <CardTitle className="text-2xl font-bold gradient-text">
            Portal de Solicitações
          </CardTitle>
          <CardDescription className="text-muted-foreground flex items-center justify-center gap-2 mt-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Acesso para clientes externos
            <Sparkles className="w-4 h-4 text-primary" />
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Cadastro</TabsTrigger>
              <TabsTrigger value="reset">Redefinir</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      type="email"
                      placeholder="seu.email@empresa.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className={`pl-11 h-11 bg-secondary/50 ${loginErrors.email ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {loginErrors.email && <p className="text-xs text-destructive">{loginErrors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className={`pl-11 h-11 bg-secondary/50 ${loginErrors.password ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {loginErrors.password && <p className="text-xs text-destructive">{loginErrors.password}</p>}
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 btn-gradient"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Entrar
                </Button>
              </form>
            </TabsContent>

            {/* Signup Tab */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      type="text"
                      placeholder="Seu nome completo"
                      value={signupData.full_name}
                      onChange={(e) => setSignupData({ ...signupData, full_name: e.target.value })}
                      className={`pl-11 h-11 bg-secondary/50 ${signupErrors.full_name ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {signupErrors.full_name && <p className="text-xs text-destructive">{signupErrors.full_name}</p>}
                </div>

                <div className="space-y-2">
                  <Label>CPF</Label>
                  <div className="relative group">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      type="text"
                      placeholder="000.000.000-00"
                      value={signupData.cpf}
                      onChange={(e) => setSignupData({ ...signupData, cpf: formatCPF(e.target.value) })}
                      className={`pl-11 h-11 bg-secondary/50 ${signupErrors.cpf ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                      maxLength={14}
                    />
                  </div>
                  {signupErrors.cpf && <p className="text-xs text-destructive">{signupErrors.cpf}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      type="email"
                      placeholder="seu.email@empresa.com"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      className={`pl-11 h-11 bg-secondary/50 ${signupErrors.email ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {signupErrors.email && <p className="text-xs text-destructive">{signupErrors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={signupData.phone}
                      onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                      className={`pl-11 h-11 bg-secondary/50 ${signupErrors.phone ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {signupErrors.phone && <p className="text-xs text-destructive">{signupErrors.phone}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      className={`pl-11 h-11 bg-secondary/50 ${signupErrors.password ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {signupErrors.password && <p className="text-xs text-destructive">{signupErrors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Confirmar senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                      className={`pl-11 h-11 bg-secondary/50 ${signupErrors.confirmPassword ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {signupErrors.confirmPassword && <p className="text-xs text-destructive">{signupErrors.confirmPassword}</p>}
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 btn-gradient"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Criar conta
                </Button>
              </form>
            </TabsContent>

            {/* Reset Tab */}
            <TabsContent value="reset">
              {resetSent ? (
                <div className="text-center py-6">
                  <Mail className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Email enviado!</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setResetSent(false);
                      setResetEmail('');
                      setActiveTab('login');
                    }}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Digite seu email para receber um link de redefinição de senha.
                  </p>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        type="email"
                        placeholder="seu.email@empresa.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className={`pl-11 h-11 bg-secondary/50 ${resetError ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                      />
                    </div>
                    {resetError && <p className="text-xs text-destructive">{resetError}</p>}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 btn-gradient"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Enviar link de redefinição
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-4 border-t border-border/20 text-center">
            <p className="text-xs text-muted-foreground/60">
              Criado e Desenvolvido por{' '}
              <span className="font-medium gradient-text">Vinicius Ezequiel</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
