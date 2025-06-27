
import { Building, Lock, User, Mail, Phone, Globe, Calendar, Shield, FileText, Download, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCountryFields } from '@/hooks/useCountryFields'
import { useOrganizationCustomData } from '@/hooks/useOrganizationCustomData'
import { useBillingPOCMembers } from '@/hooks/useBillingPOCMembers'

interface Organization {
  id: string
  name: string
  country: string
  status: 'active' | 'inactive'
  created_at: string
  billing_poc_user_id?: string | null
  billing_poc_additional_email?: string | null
  billing_poc_phone?: string | null
  billing_poc_user_email?: string | null
  billing_poc_user_name?: string | null
}

interface OrganizationDisplayProps {
  organization: Organization
}

// Enhanced Security Header Component
function SecurityHeader({ title, icon: Icon, subtitle }: { title: string; icon: any; subtitle?: string }) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-medium text-text-primary">{title}</h3>
        </div>
        {subtitle && (
          <p className="text-xs text-text-secondary">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Protected
        </Badge>
        <Lock className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  )
}

// Enhanced Info Row Component
function InfoRow({ label, value, icon: Icon, isLast = false }: { 
  label: string; 
  value: React.ReactNode; 
  icon?: any; 
  isLast?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-3 ${!isLast ? 'border-b border-border/30' : ''}`}>
      <div className="space-y-1 flex-1">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {Icon && <Icon className="h-3 w-3" />}
          {label}
        </p>
        <div className="text-sm font-medium text-text-primary">{value}</div>
      </div>
    </div>
  )
}

export function OrganizationDisplay({ organization }: OrganizationDisplayProps) {
  const { fields, isLoading: fieldsLoading } = useCountryFields(organization.country)
  const { customData, isLoading: customDataLoading } = useOrganizationCustomData(organization.id)
  const { members } = useBillingPOCMembers(organization.id)

  // Get billing POC member details from the members hook
  const billingPOCMember = members.find(m => m.user_id === organization.billing_poc_user_id)

  const getCustomFieldValue = (fieldId: string) => {
    const data = customData.find(data => data.country_field_id === fieldId)
    return data?.field_value || ''
  }

  const getCustomFieldFileData = (fieldId: string) => {
    const data = customData.find(data => data.country_field_id === fieldId)
    if (data?.file_url) {
      return {
        url: data.file_url,
        name: data.file_name || 'File',
        size: data.file_size_bytes || 0
      }
    }
    return undefined
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Security Notice */}
      <div className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-brand p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <Shield className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-accent-foreground">Protected Organization Information</p>
            <p className="text-xs text-accent-foreground/80 mt-0.5">
              All organization data is securely stored and encrypted. Only authorized users can view this information.
            </p>
          </div>
          <CheckCircle className="h-4 w-4 text-success ml-auto flex-shrink-0" />
        </div>
      </div>

      {/* Enhanced Basic Organization Information */}
      <Card className="border-l-4 border-l-primary bg-gradient-to-br from-surface-primary to-surface-secondary/20 shadow-neumorphic hover:shadow-neumorphic-hover transition-all duration-200">
        <CardHeader className="pb-4 bg-gradient-to-r from-surface-primary/50 to-transparent">
          <SecurityHeader 
            title="Organization Information" 
            icon={Building}
            subtitle="Core organizational details and registration information"
          />
        </CardHeader>
        <CardContent className="space-y-0 bg-surface-primary/30">
          <InfoRow 
            label="Organization Name" 
            value={organization.name}
          />
          
          <InfoRow 
            label="Country" 
            value={organization.country}
            icon={Globe}
          />
          
          <InfoRow 
            label="Status" 
            value={
              <Badge 
                variant={organization.status === 'active' ? 'success' : 'secondary'}
                className="text-xs flex items-center gap-1"
              >
                <CheckCircle className="h-3 w-3" />
                {organization.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            }
          />
          
          <InfoRow 
            label="Created" 
            value={new Date(organization.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
            icon={Calendar}
            isLast={true}
          />
        </CardContent>
      </Card>

      {/* Enhanced Country-Specific Information */}
      <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-surface-primary to-blue-50/10 shadow-neumorphic hover:shadow-neumorphic-hover transition-all duration-200">
        <CardHeader className="pb-4 bg-gradient-to-r from-blue-50/20 to-transparent">
          <SecurityHeader 
            title="Country-Specific Information" 
            icon={FileText}
            subtitle={`Additional information required for ${organization.country}`}
          />
        </CardHeader>
        <CardContent className="bg-surface-primary/30">
          {fieldsLoading || customDataLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-muted/40 rounded w-1/4 mb-2"></div>
                  <div className="h-4 bg-muted/40 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : fields.length > 0 ? (
            <div className="space-y-0">
              {fields.map((field, index) => {
                const value = getCustomFieldValue(field.id)
                const fileData = getCustomFieldFileData(field.id)
                const isLast = index === fields.length - 1
                
                return (
                  <InfoRow 
                    key={field.id}
                    label={`${field.field_label}${field.is_required ? ' *' : ''}`}
                    value={
                      field.field_type === 'file' ? (
                        fileData ? (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{fileData.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatFileSize(fileData.size)}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-auto"
                              onClick={() => window.open(fileData.url, '_blank')}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No file uploaded</span>
                        )
                      ) : field.field_type === 'select' ? (
                        value ? (
                          field.select_options?.find(opt => opt.option_value === value)?.option_label || value
                        ) : (
                          <span className="text-muted-foreground">Not specified</span>
                        )
                      ) : (
                        value || <span className="text-muted-foreground">Not provided</span>
                      )
                    }
                    isLast={isLast}
                  />
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                No additional fields required for this country.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Billing POC Information */}
      <Card className="border-l-4 border-l-warning bg-gradient-to-br from-surface-primary to-warning/5 shadow-neumorphic hover:shadow-neumorphic-hover transition-all duration-200">
        <CardHeader className="pb-4 bg-gradient-to-r from-warning/10 to-transparent">
          <SecurityHeader 
            title="Billing Point of Contact" 
            icon={Shield}
            subtitle="Designated contact for billing and compliance matters"
          />
        </CardHeader>
        <CardContent className="bg-surface-primary/30">
          {organization.billing_poc_user_id && billingPOCMember ? (
            <div className="space-y-0">
              <InfoRow 
                label="Primary Contact" 
                value={`${billingPOCMember.first_name || ''} ${billingPOCMember.last_name || ''}`.trim() || 'Unknown User'}
                icon={User}
              />
              
              <InfoRow 
                label="Primary Email" 
                value={billingPOCMember.email || 'Not provided'}
                icon={Mail}
              />
              
              {organization.billing_poc_additional_email && (
                <InfoRow 
                  label="Additional Email" 
                  value={organization.billing_poc_additional_email}
                  icon={Mail}
                />
              )}
              
              <InfoRow 
                label="Phone Number" 
                value={organization.billing_poc_phone || 'Not provided'}
                icon={Phone}
                isLast={true}
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No billing point of contact assigned</p>
              <p className="text-xs text-muted-foreground mt-1">
                A billing POC is required for compliance purposes
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced System Information */}
      <Card className="bg-gradient-to-r from-muted/20 to-muted/10 border border-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Organization ID:</span>
            </div>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">
              {organization.id}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
