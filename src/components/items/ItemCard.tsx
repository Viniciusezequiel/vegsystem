import { LostItem } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MapPin, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ItemCardProps {
  item: LostItem;
  onClick: (item: LostItem) => void;
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  return (
    <div
      className="item-card animate-fade-in"
      onClick={() => onClick(item)}
    >
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
          <img
            src={item.imageUrl}
            alt={item.description}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-mono text-muted-foreground">{item.code}</p>
              <h3 className="font-medium text-foreground mt-1 line-clamp-2">
                {item.description}
              </h3>
            </div>
            <StatusBadge status={item.status} />
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{item.foundLocation}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(item.foundDate), "dd 'de' MMMM", { locale: ptBR })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
