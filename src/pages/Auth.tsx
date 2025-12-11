import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail, Sparkles } from 'lucide-react';
import { z } from 'zod';
import batmanLogo from '@/assets/batman-logo.png';

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'Senha deve ter no mínimo 6 caracteres' }),
});

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

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
                src={batmanLogo} 
                alt="Logo" 
                className="w-full h-full object-contain filter drop-shadow-2xl"
                style={{ filter: 'drop-shadow(0 0 20px hsl(265 85% 65% / 0.5))' }}
              />
            </div>
          </div>
          
          <CardTitle className="text-3xl font-bold gradient-text">
            Vinicius Corp
          </CardTitle>
          <CardDescription className="text-muted-foreground flex items-center justify-center gap-2 mt-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Sistema Integrado de Gestão
            <Sparkles className="w-4 h-4 text-primary" />
          </CardDescription>
        </CardHeader>
        
        <CardContent>
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
          </form>

          <div className="mt-8 text-center space-y-4">
            <p className="text-xs text-muted-foreground">
              Acesso restrito a usuários autorizados.
            </p>
            <div className="border-t border-border/30 pt-4">
              <p className="text-xs text-muted-foreground mb-3">
                Não tem cadastro?
              </p>
              <a
                href="https://wa.me/5531992931686"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-success/10 text-success hover:bg-success/20 font-medium transition-all duration-300 text-sm border border-success/30 hover:border-success/50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Fale conosco no WhatsApp
              </a>
            </div>
          </div>

          {/* Created By Footer */}
          <div className="mt-8 pt-4 border-t border-border/20 text-center">
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
