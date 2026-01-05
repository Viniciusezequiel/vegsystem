import { ReactNode, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { OnlineUsersIndicator } from './OnlineUsersIndicator';
import { ImagePrefetchIndicator } from './ImagePrefetchIndicator';
import { cn } from '@/lib/utils';
import { useGlobalRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // Enable global realtime subscriptions
  useGlobalRealtimeSubscription();
  const isMobile = useIsMobile();

  const topBarRef = useRef<HTMLDivElement | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored === 'true';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useLayoutEffect(() => {
    const el = topBarRef.current;
    if (!el) return;

    const setTopbarHeightVar = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--app-topbar-height', `${h}px`);
    };

    setTopbarHeightVar();

    const ro = new ResizeObserver(() => setTopbarHeightVar());
    ro.observe(el);
    window.addEventListener('resize', setTopbarHeightVar);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', setTopbarHeightVar);
    };
  }, []);


  // Close mobile menu when switching to desktop
  useEffect(() => {
    if (!isMobile && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleToggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(prev => !prev);
    } else {
      setSidebarCollapsed(prev => {
        const newValue = !prev;
        localStorage.setItem('sidebar-collapsed', String(newValue));
        return newValue;
      });
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="floating-orb w-[600px] h-[600px] bg-primary/10 -top-64 -right-64" />
        <div className="floating-orb w-[400px] h-[400px] bg-accent/10 bottom-0 left-1/4" />
        <div className="absolute inset-0 mesh-gradient opacity-30" />
      </div>

      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}
      
      {/* Sidebar - hidden on mobile unless menu is open */}
      <div className={cn(
        'lg:block',
        isMobile && !mobileMenuOpen && 'hidden',
        isMobile && mobileMenuOpen && 'block'
      )}>
        <Sidebar 
          collapsed={isMobile ? false : sidebarCollapsed} 
          onToggle={handleToggleSidebar}
          isMobile={isMobile}
          onCloseMobile={closeMobileMenu}
        />
      </div>
      
      <main className={cn(
        'min-h-screen relative z-10 transition-all duration-300',
        !isMobile && (sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'),
        'ml-0'
      )}>
        {/* Top Bar */}
        <div
          ref={topBarRef}
          className={cn(
            'fixed top-0 right-0 z-20 px-4 lg:px-8 py-3 bg-background/80 backdrop-blur-sm border-b border-border/50 transition-all duration-300 left-0',
            !isMobile && (sidebarCollapsed ? 'lg:left-16' : 'lg:left-64')
          )}
        >
          <div className="flex items-center justify-between max-w-[1600px] mx-auto">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={handleToggleSidebar}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>

            {/* Spacer for desktop */}
            <div className="hidden lg:block" />

            <OnlineUsersIndicator />
          </div>
        </div>
        <div
          className="p-4 lg:p-8 max-w-[1600px] mx-auto"
          style={{ paddingTop: 'calc(var(--app-topbar-height, 96px) + 1rem)' }}
        >
          {children}
        </div>
        
        {/* Image prefetch progress indicator */}
        <ImagePrefetchIndicator />
      </main>
    </div>
  );
}
