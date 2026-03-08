import { MetricCard } from '@/components/ui/metric-card'
import { Users, Clock, DollarSign, TrendingUp, Briefcase, Sparkles } from 'lucide-react'

export function MetricCardGuide() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-heading font-semibold">
        Metric Cards<span className="text-primary">.</span>
      </h3>
      <p className="text-sm text-muted-foreground">
        Standardized metric card used across all pages — Pipeline, Analytics, Jobs, Talent Intelligence, and SaaS admin.
        All cards use a consistent compact layout with a purple-tinted icon circle.
      </p>

      {/* Basic */}
      <div className="space-y-2">
        <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">Basic</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard title="Applications" value={142} icon={Users} tooltip="Total applications received" />
          <MetricCard title="Active" value={38} icon={Briefcase} />
          <MetricCard title="Avg. Experience" value={5.2} suffix=" yrs" icon={Clock} />
          <MetricCard title="Enriched" value={87} suffix="%" icon={Sparkles} />
        </div>
      </div>

      {/* With trend */}
      <div className="space-y-2">
        <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">With Trend</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <MetricCard
            title="Hires"
            value={12}
            icon={Users}
            trend={{ value: 15, direction: 'up' }}
          />
          <MetricCard
            title="Time to Hire"
            value={28}
            suffix="d"
            icon={Clock}
            trend={{ value: 8, direction: 'down', positiveDirection: 'down' }}
          />
          <MetricCard
            title="Rejected"
            value={23}
            icon={Users}
            trend={{ value: 5, direction: 'up', positiveDirection: 'down' }}
          />
        </div>
      </div>

      {/* With footer */}
      <div className="space-y-2">
        <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">With Footer</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <MetricCard
            title="Total Jobs"
            value={24}
            icon={Briefcase}
            footer={
              <div className="flex items-center gap-1 text-xs text-virgilio-success">
                <TrendingUp className="h-3 w-3" />
                <span>+3 this month</span>
              </div>
            }
          />
          <MetricCard
            title="Salary"
            value="$85k"
            icon={DollarSign}
            tooltip="Median annual salary"
            footer={<span className="text-xs text-muted-foreground">Normalized USD</span>}
          />
        </div>
      </div>

      {/* Loading state */}
      <div className="space-y-2">
        <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">Loading</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard title="Applications" value={0} icon={Users} isLoading />
          <MetricCard title="Hires" value={0} icon={Briefcase} isLoading />
        </div>
      </div>
    </div>
  )
}
