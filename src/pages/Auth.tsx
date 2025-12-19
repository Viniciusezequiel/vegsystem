import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail, Sparkles, User, Phone, CreditCard, Shield } from 'lucide-react';
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
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
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
        // Check if external user - redirect to booking
        const { data: externalUser } = await supabase
          .from('external_users')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (externalUser) {
          navigate('/booking', { replace: true });
          return;
        }

        // Check if user is internal (has role) - redirect to admin area
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (roleData) {
          // Internal user logged in client area - redirect to admin
          navigate('/', { replace: true });
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
      setIsLoading(false);
      return;
    }

    if (data.user) {
      // Check role and external_user in parallel for faster login
      const [roleResult, externalResult] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', data.user.id).maybeSingle(),
        supabase.from('external_users').select('id').eq('user_id', data.user.id).maybeSingle(),
      ]);

      if (roleResult.data) {
        // Internal user - block from client area
        await supabase.auth.signOut();
        toast({
          title: 'Acesso negado',
          description: 'Colaboradores devem usar a Área Administrativa.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      if (externalResult.data) {
        toast({
          title: 'Login realizado',
          description: 'Bem-vindo! Redirecionando para reservas...',
        });
        navigate('/booking', { replace: true });
      } else {
        await supabase.auth.signOut();
        toast({
          title: 'Conta não configurada',
          description: 'Complete seu cadastro para continuar.',
          variant: 'destructive',
        });
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
    setActiveTab('login');
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
          
          <CardTitle className="text-3xl font-bold gradient-text">
            VEG System
          </CardTitle>
          <CardDescription className="text-muted-foreground flex items-center justify-center gap-2 mt-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Sistema de Gestão e Reservas
            <Sparkles className="w-4 h-4 text-primary" />
          </CardDescription>
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
                    placeholder="seu.email@exemplo.com"
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
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu.email@exemplo.com"
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
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Cadastro para usuários externos que desejam solicitar reservas de ambientes ou equipamentos.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="text-foreground font-medium">Nome Completo</Label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="full_name"
                        type="text"
                        placeholder="Seu nome completo"
                        value={signupData.full_name}
                        onChange={(e) => setSignupData({ ...signupData, full_name: e.target.value })}
                        className={`pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all ${signupErrors.full_name ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                      />
                    </div>
                    {signupErrors.full_name && (
                      <p className="text-xs text-destructive">{signupErrors.full_name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup_email" className="text-foreground font-medium">Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="signup_email"
                        type="email"
                        placeholder="seu.email@exemplo.com"
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        className={`pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all ${signupErrors.email ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                      />
                    </div>
                    {signupErrors.email && (
                      <p className="text-xs text-destructive">{signupErrors.email}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cpf" className="text-foreground font-medium">CPF</Label>
                      <div className="relative group">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="cpf"
                          type="text"
                          placeholder="000.000.000-00"
                          value={signupData.cpf}
                          onChange={(e) => setSignupData({ ...signupData, cpf: formatCPF(e.target.value) })}
                          className={`pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all ${signupErrors.cpf ? 'border-destructive' : ''}`}
                          disabled={isLoading}
                        />
                      </div>
                      {signupErrors.cpf && (
                        <p className="text-xs text-destructive">{signupErrors.cpf}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-foreground font-medium">Telefone</Label>
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="(00) 00000-0000"
                          value={signupData.phone}
                          onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                          className={`pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all ${signupErrors.phone ? 'border-destructive' : ''}`}
                          disabled={isLoading}
                        />
                      </div>
                      {signupErrors.phone && (
                        <p className="text-xs text-destructive">{signupErrors.phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup_password" className="text-foreground font-medium">Senha</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="signup_password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={signupData.password}
                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                        className={`pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all ${signupErrors.password ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                      />
                    </div>
                    {signupErrors.password && (
                      <p className="text-xs text-destructive">{signupErrors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-foreground font-medium">Confirmar Senha</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirme sua senha"
                        value={signupData.confirmPassword}
                        onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                        className={`pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all ${signupErrors.confirmPassword ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                      />
                    </div>
                    {signupErrors.confirmPassword && (
                      <p className="text-xs text-destructive">{signupErrors.confirmPassword}</p>
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
                        Cadastrando...
                      </>
                    ) : (
                      'Criar conta'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}

          {/* Admin area link */}
          <div className="mt-6 pt-4 border-t border-border/50">
            <Link 
              to="/admin-auth" 
              className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium text-muted-foreground hover:text-primary transition-colors border border-border/50 rounded-lg hover:border-primary/30 hover:bg-primary/5"
            >
              <Shield className="w-4 h-4" />
              Área de Colaboradores (ADM)
            </Link>
          </div>

          {/* Contact info */}
          <div className="mt-4 pt-4 border-t border-border/50 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Precisa de ajuda? <a href="mailto:viniciusezequiel@outlook.com.br" className="text-primary hover:underline">viniciusezequiel@outlook.com.br</a>
            </p>
            <p className="text-xs text-muted-foreground/70">
              Criado e desenvolvido por{' '}
              <a 
                href="https://vegsystem.com.br" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                VEG System
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
