import { cn } from '@/lib/utils';
import { ItemStatus } from '@/types';

interface StatusBadgeProps {
  status: ItemStatus;
  className?: string;
}

const statusConfig: Record<ItemStatus, { label: string; className: string }> = {
  available: {
    label: 'Disponível',
    className: 'status-available',
  },
  pending: {
    label: 'Pendente',
    className: 'status-pending',
  },
  delivered: {
    label: 'Entregue',
    className: 'status-delivered',
  },
  expired: {
    label: 'Expirado',
    className: 'status-expired',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={cn('status-badge', config.className, className)}>
      {config.label}
    </span>
  );
}
