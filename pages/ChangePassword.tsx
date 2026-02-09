import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Shield, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import vegSystemLogo from '@/assets/veg-system-logo.png';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const passwordSchema = z.object({
  password: z.string().min(6, { message: 'Senha deve ter no mínimo 6 caracteres' }),
  confirmPassword: z.string().min(6, { message: 'Confirmação de senha obrigatória' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: { password?: string; confirmPassword?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'password') fieldErrors.password = err.message;
        if (err.path[0] === 'confirmPassword') fieldErrors.confirmPassword = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      // Clear the force_password_change flag
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ force_password_change: false })
          .eq('user_id', user.id);

        if (profileError) {
          console.error('Error clearing force_password_change flag:', profileError);
        }
      }

      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Você será redirecionado para o sistema.',
      });

      // Navigate to home
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar senha',
        description: error.message || 'Ocorreu um erro ao alterar a senha.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Animated Background Orbs */}
      <div className="floating-orb w-96 h-96 bg-primary/40 -top-48 -left-48 animate-float" style={{ animationDelay: '0s' }} />
      <div className="floating-orb w-80 h-80 bg-warning/20 -bottom-40 -right-40 animate-float" style={{ animationDelay: '2s' }} />
      
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
            <div className="w-24 h-24 relative flex items-center justify-center">
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
            <CardTitle className="text-2xl font-bold gradient-text">
              Alteração de Senha
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            {profile?.full_name ? (
              <>Olá, <span className="font-medium text-foreground">{profile.full_name}</span>! Por favor, defina uma nova senha para continuar.</>
            ) : (
              'Por favor, defina uma nova senha para continuar.'
            )}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">Nova Senha</Label>
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
                  autoComplete="new-password"
                />
              </div>
              {errors.password && (
                <p className="text-xs text-destructive animate-fade-in">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground font-medium">Confirmar Nova Senha</Label>
              <div className="relative group">
                <CheckCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all ${errors.confirmPassword ? 'border-destructive' : ''}`}
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive animate-fade-in">{errors.confirmPassword}</p>
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
                  Alterando...
                </>
              ) : (
                'Alterar Senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
