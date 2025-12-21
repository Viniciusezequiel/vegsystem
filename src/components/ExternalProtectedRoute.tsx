import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ExternalProtectedRouteProps {
  children: ReactNode;
}

export function ExternalProtectedRoute({ children }: ExternalProtectedRouteProps) {
  const { user, isLoading, role } = useAuth();
  const location = useLocation();

  // Wait for auth + role resolution (prevents redirect flicker)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
          <Loader2 className="w-12 h-12 animate-spin text-primary relative" />
        </div>
      </div>
    );
  }

  // Must be logged in to access client area
  if (!user) {
    return <Navigate to="/booking-auth" state={{ from: location }} replace />;
  }

  // If internal user (has role), keep them in the admin area
  if (role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

