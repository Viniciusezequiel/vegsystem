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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 cursor-default">
            <div className="relative">
              <Users className="w-4 h-4 text-success" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
            </div>
            <span className="text-xs font-medium text-success">{onlineUsers.length} online</span>
            <div className="flex -space-x-2">
              {onlineUsers.slice(0, 3).map((user) => (
                <Avatar key={user.id} className="w-6 h-6 border-2 border-background">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px] bg-success/20 text-success">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {onlineUsers.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">+{onlineUsers.length - 3}</span>
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
