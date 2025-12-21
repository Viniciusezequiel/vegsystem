import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Mail, Phone, CreditCard, Building2, ArrowLeft, Save, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useExternalUserProfile, useUpdateExternalUser } from '@/hooks/useExternalUsers';
import vegSystemLogo from '@/assets/veg-system-logo.png';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

// CPF mask function
const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

// Phone mask function
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export default function ExternalProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: profile, isLoading: profileLoading } = useExternalUserProfile();
  const updateProfile = useUpdateExternalUser();
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    cpf: '',
    user_type: 'professor' as 'professor' | 'colaborador',
    sector: '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone ? formatPhone(profile.phone) : '',
        cpf: profile.cpf ? formatCPF(profile.cpf) : '',
        user_type: (profile.user_type as 'professor' | 'colaborador') || 'professor',
        sector: profile.sector || '',
      });
    }
  }, [profile]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.id) {
      toast({
        title: 'Erro',
        description: 'Perfil não encontrado.',
        variant: 'destructive',
      });
      return;
    }

    await updateProfile.mutateAsync({
      id: profile.id,
      full_name: formData.full_name,
      phone: formData.phone.replace(/\D/g, ''),
      cpf: formData.cpf.replace(/\D/g, ''),
      user_type: formData.user_type,
      sector: formData.sector || undefined,
    });

    setHasChanges(false);
  };

  if (profileLoading) {
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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="floating-orb w-96 h-96 bg-primary/30 -top-48 -left-48" />
      <div className="floating-orb w-80 h-80 bg-accent/20 -bottom-40 -right-40" />
      <div className="absolute inset-0 mesh-gradient opacity-30" />

      <div className="relative z-10 container max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Top bar */}
          <div className="flex justify-between items-center mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/booking')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <ThemeToggle collapsed />
          </div>
          
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl scale-150 animate-pulse" />
              <img src={vegSystemLogo} alt="VEG System Logo" className="w-16 h-16 relative" style={{ filter: 'drop-shadow(0 0 15px hsl(265 85% 65% / 0.5))' }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold gradient-text mb-2">Meu Perfil</h1>
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Gerencie suas informações cadastrais
            <Sparkles className="w-4 h-4 text-primary" />
          </p>
        </div>

        <Card className="glass-morphism border-primary/20 shadow-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Dados Cadastrais
            </CardTitle>
            <CardDescription>
              Atualize suas informações pessoais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="pl-11 h-12 bg-muted/50 border-border/50"
                  />
                </div>
                <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-foreground font-medium">Nome Completo</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="full_name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={formData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    className="pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* CPF */}
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-foreground font-medium">CPF</Label>
                <div className="relative group">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => handleChange('cpf', formatCPF(e.target.value))}
                    className="pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground font-medium">Telefone</Label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="phone"
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
                    className="pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* User Type */}
              <div className="space-y-2">
                <Label htmlFor="user_type" className="text-foreground font-medium">Tipo de Usuário</Label>
                <Select 
                  value={formData.user_type} 
                  onValueChange={(v) => handleChange('user_type', v as 'professor' | 'colaborador')}
                >
                  <SelectTrigger className="h-12 bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professor">Professor</SelectItem>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sector */}
              <div className="space-y-2">
                <Label htmlFor="sector" className="text-foreground font-medium">Setor / Departamento</Label>
                <div className="relative group">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="sector"
                    type="text"
                    placeholder="Ex: Departamento de Física"
                    value={formData.sector}
                    onChange={(e) => handleChange('sector', e.target.value)}
                    className="pl-11 h-12 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 btn-gradient text-primary-foreground font-semibold rounded-xl text-base"
                disabled={!hasChanges || updateProfile.isPending}
              >
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
