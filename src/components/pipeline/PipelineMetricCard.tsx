import { MetricCard } from '@/components/ui/metric-card';
import { LucideIcon } from 'lucide-react';

interface PipelineMetricCardProps {
  title: string;
  value: string | number | React.ReactNode;
  icon?: LucideIcon;
  tooltip?: string;
}

export function PipelineMetricCard({ title, value, icon: Icon, tooltip }: PipelineMetricCardProps) {
  return (
    <MetricCard
      title={title}
      value={value}
      icon={Icon ? <Icon /> : undefined}
      tooltip={tooltip}
    />
  );
}
