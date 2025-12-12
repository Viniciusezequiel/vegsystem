import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { OnlineUsersIndicator } from './OnlineUsersIndicator';
import { cn } from '@/lib/utils';
import { useGlobalRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // Enable global realtime subscriptions
  useGlobalRealtimeSubscription();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored === 'true';
  });

  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('sidebar-collapsed', String(newValue));
      return newValue;
    });
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="floating-orb w-[600px] h-[600px] bg-primary/10 -top-64 -right-64" />
        <div className="floating-orb w-[400px] h-[400px] bg-accent/10 bottom-0 left-1/4" />
        <div className="absolute inset-0 mesh-gradient opacity-30" />
      </div>
      
      <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />
      
      <main className={cn(
        'min-h-screen relative z-10 transition-all duration-300',
        sidebarCollapsed ? 'ml-16' : 'ml-64'
      )}>
        {/* Top Bar with Online Users */}
        <div className={cn(
          'fixed top-0 right-0 z-20 px-8 py-3 bg-background/80 backdrop-blur-sm border-b border-border/50 transition-all duration-300',
          sidebarCollapsed ? 'left-16' : 'left-64'
        )}>
          <div className="flex justify-end max-w-[1600px] mx-auto">
            <OnlineUsersIndicator />
          </div>
        </div>
        <div className="p-8 pt-20 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
