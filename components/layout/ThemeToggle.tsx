import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size={collapsed ? 'icon' : 'sm'}
      onClick={toggleTheme}
      className={cn(
        'justify-start gap-2',
        collapsed && 'w-10 h-10 p-0 justify-center'
      )}
      title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
      {!collapsed && (
        <span className="text-sm">
          {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
        </span>
      )}
    </Button>
  );
}
