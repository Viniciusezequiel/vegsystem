import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, User, Mail, Lock, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
const vegSystemLogo = '/veg-system-logo.png';

export default function Setup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    setup_key: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('setup-first-admin', {
        body: formData,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Admin criado!',
        description: 'Primeiro administrador criado com sucesso. Faça login para continuar.',
      });

      navigate('/auth');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao criar admin';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDIwMjAiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
      
      <Card className="w-full max-w-md relative z-10 border-border/50 bg-card/95 backdrop-blur-sm shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 relative">
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
            <Shield className="w-6 h-6 text-amber-500" />
            <CardTitle className="text-2xl font-bold text-foreground">
              Configuração Inicial
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Crie o primeiro administrador do sistema
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="full_name"
                  type="text"
                  placeholder="Nome do Administrador"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@empresa.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="pl-10"
                  disabled={isLoading}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup_key">Chave de Setup</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="setup_key"
                  type="password"
                  placeholder="Chave de configuração"
                  value={formData.setup_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, setup_key: e.target.value }))}
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Administrador'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button 
              variant="link" 
              className="text-muted-foreground"
              onClick={() => navigate('/auth')}
            >
              Já tem uma conta? Fazer login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
