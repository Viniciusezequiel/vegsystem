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
  force_password_change: boolean | null;
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

const AUTH_BOOT_TIMEOUT_MS = 8000;
const USERDATA_TIMEOUT_MS = 8000;
const CACHED_USER_DATA_KEY = 'auth-cached-user-data:v1';

type CachedUserData = {
  userId: string;
  role: AppRole | null;
  profile: Profile | null;
  savedAt: number;
};

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
}

function loadCachedUserData(userId: string): CachedUserData | null {
  const cached = safeJsonParse<CachedUserData>(localStorage.getItem(CACHED_USER_DATA_KEY));
  if (!cached) return null;
  if (cached.userId !== userId) return null;
  return cached;
}

function saveCachedUserData(data: CachedUserData) {
  try {
    localStorage.setItem(CACHED_USER_DATA_KEY, JSON.stringify(data));
  } catch {
    // ignore quota / blocked storage
  }
}

function clearCachedUserData() {
  try {
    localStorage.removeItem(CACHED_USER_DATA_KEY);
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleChecked, setRoleChecked] = useState(false);

  const applyCachedUserData = (userId: string) => {
    const cached = loadCachedUserData(userId);
    if (!cached) return false;

    setProfile(cached.profile);
    setRole(cached.role);
    setRoleChecked(true);
    setIsLoading(false);
    return true;
  };

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile and role in parallel for better performance (bounded by timeout)
      const [profileResult, roleResult] = await withTimeout(
        Promise.all([
          supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        ]),
        USERDATA_TIMEOUT_MS,
        'fetchUserData'
      );

      const nextProfile = profileResult?.data ? (profileResult.data as Profile) : null;
      const nextRole = roleResult?.data?.role ? (roleResult.data.role as AppRole) : null;

      if (profileResult?.error) {
        console.error('Error fetching profile:', profileResult.error);
      }
      if (roleResult?.error) {
        console.error('Error fetching role:', roleResult.error);
      }

      setProfile(nextProfile);
      setRole(nextRole);

      saveCachedUserData({
        userId,
        profile: nextProfile,
        role: nextRole,
        savedAt: Date.now(),
      });
    } catch (error) {
      // Important: do NOT wipe cached data on transient network failures
      console.error('Error fetching user data:', error);
    } finally {
      // Always mark role as checked, even on error/timeout
      setRoleChecked(true);
    }
  };

  useEffect(() => {
    let mounted = true;

    const resetUserState = () => {
      setSession(null);
      setUser(null);
      setProfile(null);
      setRole(null);
      setRoleChecked(false);
    };

    const handleSignedOut = () => {
      // Force clear localStorage on signout
      localStorage.removeItem('sb-ugzrewnbpljswwboctfh-auth-token');
      clearCachedUserData();
      resetUserState();
      setRoleChecked(true);
      setIsLoading(false);
    };

    const handleAuthenticatedSession = async (nextSession: Session) => {
      setSession(nextSession);
      setUser(nextSession.user);

      // Try cached data first to avoid app lock when backend is unstable
      const hasCached = applyCachedUserData(nextSession.user.id);

      // If no cached, we must resolve role before rendering protected routes
      if (!hasCached) {
        setIsLoading(true);
      }

      await fetchUserData(nextSession.user.id);
      setIsLoading(false);
    };

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      // Handle token refresh errors - clear corrupted tokens
      if (event === 'TOKEN_REFRESHED' && !nextSession) {
        console.warn('Token refresh failed, clearing corrupted session...');
        localStorage.removeItem('sb-ugzrewnbpljswwboctfh-auth-token');
        clearCachedUserData();
        await supabase.auth.signOut();
        resetUserState();
        setRoleChecked(true);
        setIsLoading(false);
        return;
      }

      if (event === 'SIGNED_OUT') {
        handleSignedOut();
        return;
      }

      if (nextSession?.user) {
        // Resolve using cached data quickly, then refresh with bounded fetch
        // Defer Supabase calls with setTimeout to prevent deadlock
        setTimeout(async () => {
          if (!mounted) return;
          try {
            await handleAuthenticatedSession(nextSession);
          } catch (err) {
            console.error('Failed handling auth session:', err);
            setRoleChecked(true);
            setIsLoading(false);
          }
        }, 0);
        return;
      }

      // No session
      resetUserState();
      setRoleChecked(true);
      setIsLoading(false);
    });

    // THEN check for existing session - bounded by timeout to avoid infinite loading
    withTimeout(supabase.auth.getSession(), AUTH_BOOT_TIMEOUT_MS, 'getSession')
      .then(async ({ data: { session: initialSession }, error }) => {
        if (!mounted) return;

        // If there's an error getting session, clear potentially corrupted storage
        if (error) {
          console.warn('Error getting session, clearing corrupted tokens:', error.message);
          localStorage.removeItem('sb-ugzrewnbpljswwboctfh-auth-token');
          clearCachedUserData();
          await supabase.auth.signOut();
          resetUserState();
          setRoleChecked(true);
          setIsLoading(false);
          return;
        }

        if (initialSession?.user) {
          await handleAuthenticatedSession(initialSession);
          return;
        }

        // No session
        resetUserState();
        setRoleChecked(true);
        setIsLoading(false);
      })
      .catch(async (err) => {
        // Catch any network errors / timeouts on initial load
        console.error('Failed to get session on mount:', err);
        if (!mounted) return;

        // Don't block the app forever: allow routes to decide (redirect to /admin-auth)
        setRoleChecked(true);
        setIsLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
    clearCachedUserData();
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
