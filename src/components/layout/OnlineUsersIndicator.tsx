import { usePresence } from '@/hooks/usePresence';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';

export function OnlineUsersIndicator() {
  const { onlineUsers } = usePresence();

  if (onlineUsers.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-default items-center gap-2 rounded-lg border border-border/50 bg-card/55 px-2.5 py-1.5 shadow-sm">
            <div className="relative">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-success ring-2 ring-background" />
            </div>
            <span className="text-xs font-medium text-foreground/75">{onlineUsers.length} online</span>
            <div className="flex -space-x-1.5">
              {onlineUsers.slice(0, 3).map((user) => (
                <Avatar key={user.id} className="h-5 w-5 border border-background">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="bg-muted text-[8px] text-muted-foreground">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {onlineUsers.length > 3 && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full border border-background bg-muted">
                  <span className="text-[8px] text-muted-foreground">+{onlineUsers.length - 3}</span>
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-semibold mb-2">Colaboradores online:</p>
          <div className="space-y-1">
            {onlineUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-success rounded-full" />
                <span>{user.name}</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
