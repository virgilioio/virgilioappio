import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, MapPin, Link2, Briefcase, Building2 } from 'lucide-react'

export function SmartFieldsGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Smart Fields</CardTitle>
        <p className="text-sm text-muted-foreground">
          Fields that automatically sync submitted data to the candidate's profile for filtering and automation.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Context note */}
        <div className="bg-muted/50 border border-border/40 rounded-lg p-4 space-y-1.5">
          <p className="text-sm font-medium">Context-Aware Behavior</p>
          <p className="text-xs text-muted-foreground">
            <strong>Job Posting fields:</strong> Smart fields sync submitted data to the candidate's profile (salary, location, phone).
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Offer Form fields:</strong> Smart fields provide the same structured UI (currency picker, location sub-fields, etc.) but do <em>not</em> sync to the candidate profile — enabling multiple salary fields (Base, Variable, OTE) per offer.
          </p>
        </div>

        {/* Builder View Mode Badges */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Builder View Mode — Badge Patterns</h4>
          <div className="space-y-3 border border-border/40 rounded-lg p-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Salary</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-300 gap-1">
                  <DollarSign className="h-3 w-3" />
                  Salary
                </Badge>
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-300 gap-1">
                  <Link2 className="h-3 w-3" />
                  Syncs to Profile
                </Badge>
                <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                  USD / annually
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Location</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 border-orange-300 gap-1">
                  <MapPin className="h-3 w-3" />
                  Location
                </Badge>
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-300 gap-1">
                  <Link2 className="h-3 w-3" />
                  Syncs to Profile
                </Badge>
                <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                  City, State, Country
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Employment Type</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-700 border-indigo-300 gap-1">
                  <Briefcase className="h-3 w-3" />
                  Employment Type
                </Badge>
                <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                  Full-time, Part-time, Temporary, Internship
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Work Location</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-700 border-cyan-300 gap-1">
                  <Building2 className="h-3 w-3" />
                  Work Location
                </Badge>
                <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                  Remote, Hybrid, On-site
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Purple Config Container */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Builder Config — Purple Container</h4>
          <div className="bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-virgilio-purple">
              <Link2 className="h-4 w-4" />
              <span className="text-sm font-medium">Syncs to Candidate Profile</span>
            </div>
            <div className="bg-white border border-border/40 rounded-md p-3">
              <p className="text-xs text-muted-foreground">
                The value entered by the applicant will automatically update their candidate profile.
              </p>
            </div>
          </div>
        </div>

        {/* Public Form Rendering */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Public Form — Green Help Text</h4>
          <div className="space-y-4 border border-border/40 rounded-lg p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Salary Expectations</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0">$</Badge>
                <Input type="number" placeholder="Enter amount" disabled className="max-w-[200px]" />
                <Badge variant="secondary" className="shrink-0 capitalize">annually</Badge>
              </div>
              <p className="text-xs text-green-600">This will be added to your candidate profile.</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Location
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="City" disabled />
                <Input placeholder="State / Province" disabled />
                <Input placeholder="Country" disabled />
              </div>
              <p className="text-xs text-green-600">This will be added to your candidate profile.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
