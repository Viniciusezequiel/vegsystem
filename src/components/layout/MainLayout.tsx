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
        <div className="absolute -right-64 -top-72 h-[560px] w-[560px] rounded-full bg-primary/[0.045] blur-3xl" />
        <div className="absolute inset-0 mesh-gradient opacity-[0.12]" />
      </div>

      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 xl:hidden"
          onClick={closeMobileMenu}
        />
      )}
      
      {/* Sidebar - hidden on mobile/tablet unless menu is open */}
      <div className={cn(
        'xl:block',
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
        'min-h-screen relative z-10 transition-all duration-300 min-w-0',
        !isMobile && (sidebarCollapsed ? 'xl:ml-[68px]' : 'xl:ml-60'),
        'ml-0'
      )}>
        {/* Top Bar */}
        <div
          ref={topBarRef}
          className={cn(
            'fixed left-0 right-0 top-0 z-20 h-[60px] border-b border-border/35 bg-background/90 px-3 backdrop-blur-md transition-all duration-200 sm:px-4 xl:px-6',
            !isMobile && (sidebarCollapsed ? 'xl:left-[68px]' : 'xl:left-60')
          )}
        >
          <div className="mx-auto flex h-full max-w-[1560px] items-center justify-between">
            {/* Mobile/Tablet Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="xl:hidden"
              onClick={handleToggleSidebar}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>

            {/* Spacer for desktop */}
            <div className="hidden xl:block" />

            <OnlineUsersIndicator />
          </div>
        </div>
        <div
          className="mx-auto min-w-0 max-w-[1560px] overflow-x-hidden p-3 sm:p-4 xl:px-6 xl:pb-6"
          style={{ paddingTop: 'calc(var(--app-topbar-height, 60px) + 1rem)' }}
        >
          {children}
        </div>
        
        {/* Image prefetch progress indicator */}
        <ImagePrefetchIndicator />
      </main>
    </div>
  );
}
