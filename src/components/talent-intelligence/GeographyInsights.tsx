import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TalentIntelligenceEmptyState } from './TalentIntelligenceEmptyState'
import { Progress } from '@/components/ui/progress'
import { MapPin, Users } from 'lucide-react'
import type { CountEntry } from '@/hooks/useTalentIntelligenceData'
import { COUNTRIES } from '@/constants/countries'
import DottedMap from 'dotted-map'

interface GeographyInsightsProps {
  countryCounts: CountEntry[]
  cityCounts: CountEntry[]
  totalCandidates: number
  onCountryClick?: (country: string) => void
}

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

function getCoords(name: string): [number, number] | null {
  if (COUNTRY_COORDS[name]) return COUNTRY_COORDS[name]
  const country = COUNTRIES.find(c => c.value === name || c.label === name)
  if (country && COUNTRY_COORDS[country.label]) return COUNTRY_COORDS[country.label]
  return null
}

function displayName(name: string) {
  const country = COUNTRIES.find(c => c.value === name)
  return country ? country.label : name
}

export function GeographyInsights({ countryCounts, cityCounts, totalCandidates, onCountryClick }: GeographyInsightsProps) {
  const maxCount = countryCounts.length > 0 ? countryCounts[0].count : 1
  const topCountries = countryCounts.slice(0, 5)

  const svgString = useMemo(() => {
    const map = new DottedMap({ height: 60, grid: 'diagonal' })

    countryCounts.forEach(entry => {
      const coords = getCoords(entry.name)
      if (!coords) return

      const minR = 0.4
      const maxR = 1.2
      const r = maxCount <= 1 ? minR : minR + ((entry.count / maxCount) * (maxR - minR))

      map.addPin({
        lat: coords[1],
        lng: coords[0],
        svgOptions: { color: 'hsl(267, 100%, 62%)', radius: r },
      })
    })

    return map.getSVG({
      radius: 0.22,
      color: 'hsl(267, 80%, 85%)',
      shape: 'circle',
      backgroundColor: 'transparent',
    })
  }, [countryCounts, maxCount])

  if (countryCounts.length === 0 && cityCounts.length === 0) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Candidate Geography
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TalentIntelligenceEmptyState message="No location data available yet" />
        </CardContent>
      </Card>
    )
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
          <div className="lg:col-span-3">
            <div
              className="bg-muted/30 rounded-lg overflow-hidden p-4"
              style={{ minHeight: 320 }}
              dangerouslySetInnerHTML={{ __html: svgString }}
            />
          </div>

          <div className="lg:col-span-2 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-virgilio-purple/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-virgilio-purple" />
              </div>
              <div>
                <p className="text-2xl font-poppins font-bold text-foreground">{totalCandidates.toLocaleString()}</p>
                <p className="text-xs font-poppins text-muted-foreground">Global candidates</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-poppins font-medium text-muted-foreground uppercase tracking-wide">Top Countries</p>
              {topCountries.map((country) => {
                const pct = Math.round((country.count / totalCandidates) * 100)
                return (
                  <div
                    key={country.name}
                    className={`space-y-1 ${onCountryClick ? 'cursor-pointer hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors' : ''}`}
                    onClick={() => onCountryClick?.(country.name)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-poppins text-foreground">{displayName(country.name)}</span>
                      <span className="text-xs font-poppins font-semibold text-muted-foreground">{country.count} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                )
              })}
            </div>

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
