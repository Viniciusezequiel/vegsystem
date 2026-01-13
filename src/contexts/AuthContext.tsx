import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'supervisor' | 'analista' | 'assistente';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  position: string;
  department: string;
  avatar_url: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSupervisor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleChecked, setRoleChecked] = useState(false);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile and role in parallel for better performance
      const [profileResult, roleResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      if (profileResult.error) {
        console.error('Error fetching profile:', profileResult.error);
      } else if (profileResult.data) {
        setProfile(profileResult.data as Profile);
      }

      if (roleResult.error) {
        console.error('Error fetching role:', roleResult.error);
        setRole(null);
      } else if (roleResult.data) {
        setRole(roleResult.data.role as AppRole);
      } else {
        setRole(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setProfile(null);
      setRole(null);
    } finally {
      // Always mark role as checked, even on error
      setRoleChecked(true);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Handle token refresh errors - clear corrupted tokens
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('Token refresh failed, clearing corrupted session...');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setRole(null);
          setRoleChecked(true);
          setIsLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(async () => {
            await fetchUserData(session.user.id);
            setIsLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setRoleChecked(true);
          setIsLoading(false);
        }

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setRole(null);
          setRoleChecked(false);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session - with error handling for corrupted tokens
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      // If there's an error getting session, clear potentially corrupted storage
      if (error) {
        console.warn('Error getting session, clearing corrupted tokens:', error.message);
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        setRole(null);
        setRoleChecked(true);
        setIsLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchUserData(session.user.id);
      } else {
        setRoleChecked(true);
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    role,
    isLoading: isLoading || (!!user && !roleChecked),
    signIn,
    signOut,
    isAdmin: role === 'admin',
    isSupervisor: role === 'supervisor',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
