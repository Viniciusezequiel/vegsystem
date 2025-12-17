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

  // Show loading while checking authentication or loading user data
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

  // User must be logged in - redirect to admin auth
  if (!user) {
    return <Navigate to="/admin-auth" state={{ from: location }} replace />;
  }

  // SECURITY: User must have a role (be an internal user) to access protected routes
  // This prevents external users from accessing admin panel
  if (!role) {
    // If user exists but no role, they might be an external user
    // Redirect them to the booking page instead of showing error
    return <Navigate to="/booking" replace />;
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
