import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

interface ConfirmationBadgeProps {
  status: 'pending' | 'confirmed' | 'declined';
}

export function ConfirmationBadge({ status }: ConfirmationBadgeProps) {
  const configs = {
    pending: {
      label: 'Pending',
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    },
    confirmed: {
      label: 'Confirmed',
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    },
    declined: {
      label: 'Declined',
      icon: XCircle,
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline"
      className={`gap-1 text-xs ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
