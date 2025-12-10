import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { OnlineUsersIndicator } from './OnlineUsersIndicator';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="floating-orb w-[600px] h-[600px] bg-primary/10 -top-64 -right-64" />
        <div className="floating-orb w-[400px] h-[400px] bg-accent/10 bottom-0 left-1/4" />
        <div className="absolute inset-0 mesh-gradient opacity-30" />
      </div>
      
      <Sidebar />
      <main className="ml-64 min-h-screen relative z-10">
        {/* Top Bar with Online Users */}
        <div className="fixed top-0 right-0 left-64 z-20 px-8 py-3 bg-background/80 backdrop-blur-sm border-b border-border/50">
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
