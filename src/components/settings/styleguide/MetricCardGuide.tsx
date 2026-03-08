import { MetricCard } from '@/components/ui/metric-card'
import { MetricCardGroup } from '@/components/ui/metric-card-group'
import { MiniSparkline } from '@/components/ui/mini-sparkline'
import { Users, Clock, DollarSign, TrendingUp, Briefcase, Sparkles } from 'lucide-react'

const sampleUp = [3, 5, 4, 8, 6, 9, 11, 10, 14, 12, 15]
const sampleDown = [14, 12, 13, 10, 11, 8, 9, 7, 6, 5, 4]
const sampleFlat = [6, 7, 5, 6, 8, 7, 6, 7, 5, 6, 7]

export function MetricCardGuide() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-heading font-semibold">
        Metric Cards<span className="text-primary">.</span>
      </h3>
      <p className="text-sm text-muted-foreground">
        Horizontal pill-style cards with three zones: icon circle, label + value, and optional sparkline.
        Three variants: <strong>hero</strong>, <strong>default</strong>, and <strong>grouped</strong> strips.
      </p>

      {/* Hero */}
      <div className="space-y-2">
        <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">Hero</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard variant="hero" title="Applications" value={142} icon={Users} tooltip="Total applications" sparkline={<MiniSparkline data={sampleUp} color="hsl(267 100% 62%)" />} />
          <MetricCard variant="hero" title="Hires" value={12} icon={Briefcase} trend={{ value: 15, direction: 'up' }} iconColor="text-virgilio-success" sparkline={<MiniSparkline data={sampleUp} color="hsl(152 69% 41%)" />} />
          <MetricCard variant="hero" title="Time to Hire" value={28} suffix="d" icon={Clock} trend={{ value: 8, direction: 'down', positiveDirection: 'down' }} iconColor="text-warning" sparkline={<MiniSparkline data={sampleDown} color="hsl(38 92% 50%)" />} />
        </div>
      </div>

      {/* Default (horizontal pill) */}
      <div className="space-y-2">
        <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">Default (Horizontal Pill)</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard title="Applications" value={142} icon={Users} tooltip="Total applications received" sparkline={<MiniSparkline data={sampleUp} color="hsl(267 100% 62%)" />} />
          <MetricCard title="Active" value={38} icon={Briefcase} iconColor="text-virgilio-success" sparkline={<MiniSparkline data={sampleFlat} color="hsl(152 69% 41%)" />} />
          <MetricCard title="Avg. Experience" value={5.2} suffix=" yrs" icon={Clock} iconColor="text-warning" />
          <MetricCard title="Enriched" value={87} suffix="%" icon={Sparkles} iconColor="text-destructive" />
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
            <MetricCard variant="inline" title="Scheduled" value={14} sparkline={<MiniSparkline data={sampleUp} color="hsl(267 100% 62%)" height={32} />} />
            <MetricCard variant="inline" title="Completed" value={11} sparkline={<MiniSparkline data={sampleFlat} color="hsl(152 69% 41%)" height={32} />} />
          </MetricCardGroup>
        </div>
      </div>

      {/* With trend */}
      <div className="space-y-2">
        <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">With Trend</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <MetricCard title="Hires" value={12} icon={Users} trend={{ value: 15, direction: 'up' }} sparkline={<MiniSparkline data={sampleUp} color="hsl(267 100% 62%)" />} />
          <MetricCard title="Time to Hire" value={28} suffix="d" icon={Clock} trend={{ value: 8, direction: 'down', positiveDirection: 'down' }} iconColor="text-warning" sparkline={<MiniSparkline data={sampleDown} color="hsl(38 92% 50%)" />} />
          <MetricCard title="Rejected" value={23} icon={Users} trend={{ value: 5, direction: 'up', positiveDirection: 'down' }} iconColor="text-destructive" />
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
            iconColor="text-virgilio-success"
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
