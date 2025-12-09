import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

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
        <div className="p-8 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
