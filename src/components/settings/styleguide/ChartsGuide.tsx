import { Card, CardContent } from '@/components/ui/card'

export function ChartsGuide() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-heading font-semibold">
        Charts<span className="text-primary">.</span>
      </h3>
      <p className="text-sm text-muted-foreground">
        All charts follow the Pulse Card design language — gradient fills, rounded surfaces, Virgilio palette, and zero visual noise.
        Three patterns are used across the platform.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Area Gradient */}
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">
              Area Gradient
            </p>
            <div className="h-24 rounded-xl bg-gradient-to-b from-primary/20 to-transparent flex items-end px-3 pb-2">
              <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sg-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(267 100% 62%)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="hsl(267 100% 62%)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,50 Q30,30 60,35 T120,20 T200,25 V60 H0Z" fill="url(#sg-area)" />
                <path d="M0,50 Q30,30 60,35 T120,20 T200,25" fill="none" stroke="hsl(267 100% 62%)" strokeWidth="2" />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground">
              Used for time-series data. <code className="text-[10px] bg-muted px-1 rounded">Area</code> with linear gradient fill, no grid lines, hover-only active dots. Legend rendered as header chips.
            </p>
          </CardContent>
        </Card>

        {/* Donut */}
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">
              Donut
            </p>
            <div className="h-24 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-20 h-20">
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(267 100% 62%)" strokeWidth="12" strokeDasharray="125.6 251.2" strokeDashoffset="0" strokeLinecap="round" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(152 69% 41%)" strokeWidth="12" strokeDasharray="75.4 251.2" strokeDashoffset="-125.6" strokeLinecap="round" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(38 92% 50%)" strokeWidth="12" strokeDasharray="50.2 251.2" strokeDashoffset="-201" strokeLinecap="round" />
                <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[11px] font-bold font-poppins">142</text>
              </svg>
            </div>
            <p className="text-xs text-muted-foreground">
              Used for distribution data. <code className="text-[10px] bg-muted px-1 rounded">PieChart</code> with 55% inner radius, center total stat, clean legend below.
            </p>
          </CardContent>
        </Card>

        {/* Funnel */}
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">
              Funnel
            </p>
            <div className="h-24 flex flex-col justify-center gap-1.5 px-2">
              <div className="h-4 rounded-xl bg-gradient-to-r from-primary/30 to-primary/5 w-full" />
              <div className="h-4 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 w-[75%]" />
              <div className="h-4 rounded-xl bg-gradient-to-r from-warning/30 to-warning/5 w-[45%]" />
              <div className="h-4 rounded-xl bg-gradient-to-r from-virgilio-success/30 to-virgilio-success/5 w-[25%] shadow-[0_0_8px_hsl(152_69%_41%/0.3)]" />
            </div>
            <p className="text-xs text-muted-foreground">
              Used for conversion data. Horizontal bars with gradient fills, rounded-xl corners, chevron conversion arrows, and a glow on the outcome bar.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Design rules */}
      <div className="rounded-xl border border-border/60 p-4 bg-muted/30">
        <p className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider mb-2">Design Rules</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
          <li>No <code className="bg-muted px-1 rounded">CartesianGrid</code> — clean canvas only</li>
          <li>Tooltips styled as floating pills: <code className="bg-muted px-1 rounded">rounded-2xl shadow-md</code> with <code className="bg-muted px-1 rounded">font-poppins</code></li>
          <li>Virgilio palette only — purple, green, amber, blue, destructive</li>
          <li>Gradient fills fade to transparent, never to white</li>
          <li>Legends as inline chips in the card header, not below the chart</li>
        </ul>
      </div>
    </div>
  )
}
