import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading, isAdmin, profile, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // User must be logged in
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // SECURITY: User must have a role (be an internal user) to access protected routes
  // This prevents external users from accessing admin panel
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-2">Acesso Não Autorizado</h1>
          <p className="text-muted-foreground mb-4">
            Você não tem permissão para acessar o painel administrativo.
            Este acesso é restrito a colaboradores internos.
          </p>
          <a href="/auth" className="text-primary hover:underline">
            Voltar para login
          </a>
        </div>
      </div>
    );
  }

  // Check if user profile is active
  if (profile && !profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-2">Acesso Desativado</h1>
          <p className="text-muted-foreground">
            Sua conta foi desativada. Contate o administrador para mais informações.
          </p>
        </div>
      </div>
    );
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
