import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { TalentInsightEmptyState } from './TalentInsightEmptyState'
import { Progress } from '@/components/ui/progress'
import { MapPin, Users } from 'lucide-react'
import type { CountEntry } from '@/hooks/useTalentInsightsData'

interface GeographyInsightsProps {
  countryCounts: CountEntry[]
  cityCounts: CountEntry[]
  totalCandidates: number
}

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Country name → [longitude, latitude] centroids
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'United States': [-98, 39], 'Canada': [-106, 56], 'Mexico': [-102, 23],
  'Brazil': [-51, -14], 'Argentina': [-64, -34], 'Colombia': [-74, 4],
  'Chile': [-71, -35], 'Peru': [-76, -10], 'Venezuela': [-66, 7],
  'Ecuador': [-78, -2], 'Uruguay': [-56, -33], 'Paraguay': [-58, -23],
  'Bolivia': [-65, -17], 'Costa Rica': [-84, 10], 'Panama': [-80, 9],
  'United Kingdom': [-2, 54], 'Germany': [10, 51], 'France': [2, 47],
  'Spain': [-4, 40], 'Italy': [12, 43], 'Netherlands': [5, 52],
  'Belgium': [4, 51], 'Switzerland': [8, 47], 'Austria': [14, 47],
  'Sweden': [15, 62], 'Norway': [8, 62], 'Denmark': [10, 56],
  'Finland': [26, 64], 'Poland': [20, 52], 'Portugal': [-8, 39],
  'Ireland': [-8, 53], 'Czech Republic': [15, 50], 'Romania': [25, 46],
  'Greece': [22, 39], 'Hungary': [19, 47], 'Ukraine': [32, 49],
  'Turkey': [35, 39], 'Russia': [105, 60],
  'India': [79, 21], 'China': [104, 35], 'Japan': [138, 36],
  'South Korea': [128, 36], 'Korea (South)': [128, 36],
  'Indonesia': [120, -5], 'Philippines': [122, 13],
  'Vietnam': [108, 14], 'Thailand': [101, 15], 'Malaysia': [102, 4],
  'Singapore': [104, 1], 'Pakistan': [69, 30], 'Bangladesh': [90, 24],
  'Sri Lanka': [81, 7], 'Nepal': [84, 28],
  'Australia': [133, -27], 'New Zealand': [174, -41],
  'South Africa': [24, -29], 'Nigeria': [8, 10], 'Kenya': [38, 0],
  'Egypt': [30, 27], 'Morocco': [-6, 32], 'Ghana': [-2, 8],
  'Ethiopia': [40, 9], 'Tanzania': [35, -6],
  'Israel': [35, 31], 'United Arab Emirates': [54, 24],
  'Saudi Arabia': [45, 24], 'Qatar': [51, 25],
  'Taiwan': [121, 24], 'Hong Kong': [114, 22],
}

// Also map ISO codes to coords using the COUNTRIES constant
import { COUNTRIES } from '@/constants/countries'

function getCoords(name: string): [number, number] | null {
  // Direct name match
  if (COUNTRY_COORDS[name]) return COUNTRY_COORDS[name]
  // Try matching ISO code → label → coords
  const country = COUNTRIES.find(c => c.value === name || c.label === name)
  if (country && COUNTRY_COORDS[country.label]) return COUNTRY_COORDS[country.label]
  return null
}

const PURPLE = 'hsl(267, 100%, 62%)'

export function GeographyInsights({ countryCounts, cityCounts, totalCandidates }: GeographyInsightsProps) {
  const [tooltip, setTooltip] = useState<{ name: string; count: number } | null>(null)

  if (countryCounts.length === 0 && cityCounts.length === 0) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Candidate Geography
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TalentInsightEmptyState message="No location data available yet" />
        </CardContent>
      </Card>
    )
  }

  const maxCount = countryCounts.length > 0 ? countryCounts[0].count : 1
  const topCountries = countryCounts.slice(0, 5)

  // Build markers
  const markers = countryCounts
    .map(entry => {
      const coords = getCoords(entry.name)
      if (!coords) return null
      return { name: entry.name, coordinates: coords as [number, number], count: entry.count }
    })
    .filter(Boolean) as { name: string; coordinates: [number, number]; count: number }[]

  const minR = 4
  const maxR = 18
  const getRadius = (count: number) => {
    if (maxCount <= 1) return minR
    return minR + ((count / maxCount) * (maxR - minR))
  }

  // Resolve display name (ISO code → full name)
  const displayName = (name: string) => {
    const country = COUNTRIES.find(c => c.value === name)
    return country ? country.label : name
  }

  return (
    <Card className="border-virgilio-border">
      <CardHeader>
        <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
          Candidate Geography
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Map — 3/5 width */}
          <div className="lg:col-span-3 relative">
            <div className="bg-muted/30 rounded-lg overflow-hidden" style={{ minHeight: 320 }}>
              <ComposableMap
                projectionConfig={{ rotate: [-10, 0, 0], scale: 140 }}
                width={600}
                height={320}
                style={{ width: '100%', height: 'auto' }}
              >
                <ZoomableGroup>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill="hsl(var(--muted))"
                          stroke="hsl(var(--border))"
                          strokeWidth={0.5}
                          style={{
                            default: { outline: 'none' },
                            hover: { outline: 'none', fill: 'hsl(var(--muted-foreground) / 0.3)' },
                            pressed: { outline: 'none' },
                          }}
                        />
                      ))
                    }
                  </Geographies>
                  {markers.map((marker) => (
                    <Marker
                      key={marker.name}
                      coordinates={marker.coordinates}
                      onMouseEnter={() => setTooltip({ name: displayName(marker.name), count: marker.count })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <circle
                        r={getRadius(marker.count)}
                        fill={PURPLE}
                        fillOpacity={0.65}
                        stroke={PURPLE}
                        strokeWidth={1}
                        strokeOpacity={0.3}
                        style={{ cursor: 'pointer' }}
                      />
                    </Marker>
                  ))}
                </ZoomableGroup>
              </ComposableMap>
            </div>
            {tooltip && (
              <div className="absolute top-2 left-2 bg-popover border border-border rounded-lg px-3 py-2 shadow-md pointer-events-none">
                <p className="text-sm font-poppins font-semibold text-foreground">{tooltip.name}</p>
                <p className="text-xs font-poppins text-muted-foreground">{tooltip.count} candidates</p>
              </div>
            )}
          </div>

          {/* Right panel — 2/5 width */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Total count */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-virgilio-purple/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-virgilio-purple" />
              </div>
              <div>
                <p className="text-2xl font-poppins font-bold text-foreground">{totalCandidates.toLocaleString()}</p>
                <p className="text-xs font-poppins text-muted-foreground">Global candidates</p>
              </div>
            </div>

            {/* Top countries with progress bars */}
            <div className="space-y-3">
              <p className="text-xs font-poppins font-medium text-muted-foreground uppercase tracking-wide">Top Countries</p>
              {topCountries.map((country) => {
                const pct = Math.round((country.count / totalCandidates) * 100)
                return (
                  <div key={country.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-poppins text-foreground">{displayName(country.name)}</span>
                      <span className="text-xs font-poppins font-semibold text-muted-foreground">{country.count} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                )
              })}
            </div>

            {/* Top cities */}
            {cityCounts.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-poppins font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Top Cities
                </p>
                {cityCounts.slice(0, 5).map((city, i) => (
                  <div key={city.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-poppins font-semibold text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-sm font-poppins text-foreground">{city.name}</span>
                    </div>
                    <span className="text-sm font-poppins font-semibold text-virgilio-purple">{city.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
