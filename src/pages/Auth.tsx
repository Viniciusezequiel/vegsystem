import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail, Sparkles, Users, Building2, User, Phone, CreditCard } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import vegSystemLogo from '@/assets/veg-system-logo.png';

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

type AccessMode = 'admin' | 'external';

// CPF mask function
const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [accessMode, setAccessMode] = useState<AccessMode>('external');
  const [externalTab, setExternalTab] = useState<'login' | 'signup'>('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  
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

  useEffect(() => {
    const checkUserType = async () => {
      if (user && !authLoading) {
        // Check if user is internal (has profile) or external
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          // Internal user - redirect to admin dashboard
          navigate('/', { replace: true });
        } else {
          // Check if external user
          const { data: externalUser } = await supabase
            .from('external_users')
            .select('id')
            .eq('user_id', user.id)
            .single();
          
          if (externalUser) {
            // External user - redirect to booking
            navigate('/booking', { replace: true });
          }
        }
      }
    };
    
    checkUserType();
  }, [user, authLoading, navigate]);

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
      redirectTo: `${window.location.origin}/auth`,
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

    if (accessMode === 'admin') {
      const { error } = await signIn(email, password);

      if (error) {
        let message = 'Erro ao fazer login. Verifique suas credenciais.';
        if (error.message.includes('Invalid login credentials')) {
          message = 'Email ou senha incorretos.';
        } else if (error.message.includes('Email not confirmed')) {
          message = 'Email não confirmado. Contate o administrador.';
        } else if (error.message.includes('User not found')) {
          message = 'Usuário não encontrado.';
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
        navigate('/', { replace: true });
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let message = 'Erro ao fazer login. Verifique suas credenciais.';
        if (error.message.includes('Invalid login credentials')) {
          message = 'Email ou senha incorretos.';
        }
        toast({
          title: 'Falha no login',
          description: message,
          variant: 'destructive',
        });
      } else if (data.user) {
        const { data: externalUser } = await supabase
          .from('external_users')
          .select('id')
          .eq('user_id', data.user.id)
          .single();

        if (externalUser) {
          toast({
            title: 'Login realizado',
            description: 'Bem-vindo! Redirecionando para reservas...',
          });
          navigate('/booking', { replace: true });
        } else {
          await supabase.auth.signOut();
          toast({
            title: 'Acesso negado',
            description: 'Este acesso é apenas para usuários externos. Use o Painel ADM.',
            variant: 'destructive',
          });
        }
      }
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

    if (authData.user) {
      const { error: profileError } = await supabase
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
    setExternalTab('login');
    setEmail(signupData.email);
    setPassword('');
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
      <div className="floating-orb w-80 h-80 bg-accent/30 -bottom-40 -right-40 animate-float" style={{ animationDelay: '2s' }} />
      <div className="floating-orb w-64 h-64 bg-success/20 top-1/3 right-1/4 animate-float" style={{ animationDelay: '4s' }} />
      
      {/* Mesh Gradient Overlay */}
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />
      
      <Card className="w-full max-w-md relative z-10 glass-morphism border-primary/20 shadow-glow animate-fade-in">
        <CardHeader className="text-center pb-4">
          {/* Access Mode Switch */}
          <div className="flex items-center justify-center mb-6 p-1 bg-secondary/50 rounded-xl border border-border/30">
            <button
              type="button"
              onClick={() => setAccessMode('admin')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-300 ${
                accessMode === 'admin'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Painel ADM
            </button>
            <button
              type="button"
              onClick={() => setAccessMode('external')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-300 ${
                accessMode === 'external'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              }`}
            >
              <Users className="w-4 h-4" />
              Externo
            </button>
          </div>

          {/* Logo with Glow Effect */}
          <div className="mx-auto mb-6 relative">
            <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl scale-150 animate-pulse" />
            <div className="w-28 h-28 relative flex items-center justify-center">
              <img 
                src={vegSystemLogo} 
                alt="VEG System Logo" 
                className="w-full h-full object-contain filter drop-shadow-2xl"
                style={{ filter: 'drop-shadow(0 0 20px hsl(265 85% 65% / 0.5))' }}
              />
            </div>
          </div>
          
          <CardTitle className="text-3xl font-bold gradient-text">
            VEG System
          </CardTitle>
          <CardDescription className="text-muted-foreground flex items-center justify-center gap-2 mt-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {accessMode === 'admin' ? 'Painel Administrativo' : 'Acesso Externo - Reservas'}
            <Sparkles className="w-4 h-4 text-primary" />
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {accessMode === 'admin' ? (
            // Admin Login Form
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
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
          ) : (
            // External Login/Signup Tabs
            <Tabs value={externalTab} onValueChange={(v) => setExternalTab(v as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Cadastro</TabsTrigger>
              </TabsList>

              {/* External Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="ext-email" className="text-foreground font-medium">Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="ext-email"
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
                    <Label htmlFor="ext-password" className="text-foreground font-medium">Senha</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="ext-password"
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
                </form>
              </TabsContent>

              {/* External Signup Tab */}
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

                  <div className="grid grid-cols-2 gap-3">
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
                      <Label>Confirmar</Label>
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
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 btn-gradient text-primary-foreground font-semibold rounded-xl text-base"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Cadastrando...
                      </>
                    ) : (
                      'Criar Conta'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}

          {/* Forgot Password Dialog */}
          {showForgotPassword && (
            <div className="mt-6 p-4 border border-border rounded-xl bg-secondary/30">
              <h3 className="font-medium mb-3">Redefinir Senha</h3>
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="seu.email@empresa.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="mt-1.5 bg-secondary/50"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={forgotLoading} className="flex-1">
                    {forgotLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Enviar
                  </Button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-8 text-center space-y-4">
            <p className="text-xs text-muted-foreground">
              {accessMode === 'admin' 
                ? 'Acesso restrito a usuários autorizados do sistema.'
                : 'Acesse para solicitar reservas de salas.'}
            </p>
            <div className="border-t border-border/30 pt-4">
              <p className="text-xs text-muted-foreground mb-3">
                Precisa de ajuda?
              </p>
              <a
                href="mailto:viniciusezequiel@outlook.com.br"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-all duration-300 text-sm border border-primary/30 hover:border-primary/50"
              >
                <Mail className="w-5 h-5" />
                viniciusezequiel@outlook.com.br
              </a>
            </div>
          </div>

          {/* Created By Footer */}
          <div className="mt-8 pt-4 border-t border-border/20 text-center">
            <p className="text-xs text-muted-foreground/60">
              Criado e Desenvolvido por{' '}
              <span className="font-medium gradient-text">VEG System</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
