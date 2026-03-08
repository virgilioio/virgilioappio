import { MetricCard } from '@/components/ui/metric-card'
import { MetricCardGroup } from '@/components/ui/metric-card-group'
import { Users, Clock, DollarSign, TrendingUp, Briefcase, Sparkles } from 'lucide-react'

export function MetricCardGuide() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-heading font-semibold">
        Metric Cards<span className="text-primary">.</span>
      </h3>
      <p className="text-sm text-muted-foreground">
        Three variants for different visual weights: <strong>hero</strong> for primary KPIs,
        <strong> grouped</strong> strips for related metrics, and <strong>default</strong> for compact grids.
      </p>

      {/* Hero */}
      <div className="space-y-2">
        <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">Hero</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard variant="hero" title="Applications" value={142} icon={Users} tooltip="Total applications" />
          <MetricCard variant="hero" title="Hires" value={12} icon={Briefcase} trend={{ value: 15, direction: 'up' }} />
          <MetricCard variant="hero" title="Time to Hire" value={28} suffix="d" icon={Clock} trend={{ value: 8, direction: 'down', positiveDirection: 'down' }} />
        </div>
      </div>

      {/* Grouped strip */}
      <div className="space-y-2">
        <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">Grouped Strip</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MetricCardGroup title="Pipeline">
            <MetricCard variant="inline" title="Active" value={38} />
            <MetricCard variant="inline" title="Offers" value={7} />
            <MetricCard variant="inline" title="Rejected" value={23} />
          </MetricCardGroup>
          <MetricCardGroup title="Interviews">
            <MetricCard variant="inline" title="Scheduled" value={14} />
            <MetricCard variant="inline" title="Completed" value={11} />
          </MetricCardGroup>
        </div>
      </div>

      {/* Default compact */}
      <div className="space-y-2">
        <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">Default (Compact)</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard variant="hero" title="Applications" value={0} icon={Users} isLoading />
          <MetricCardGroup title="Pipeline">
            <MetricCard variant="inline" title="Active" value={0} isLoading />
            <MetricCard variant="inline" title="Offers" value={0} isLoading />
          </MetricCardGroup>
          <MetricCard title="Hires" value={0} icon={Briefcase} isLoading />
        </div>
      </div>
    </div>
  )
}
