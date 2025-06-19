
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, User, Mail, Phone } from 'lucide-react'
import { useBillingPOCMembers } from '@/hooks/useBillingPOCMembers'

interface BillingPOCData {
  billing_poc_user_id: string | null
  billing_poc_additional_email: string
  billing_poc_phone: string
}

interface BillingPOCSectionProps {
  organizationId: string | undefined
  data: BillingPOCData
  onChange: (data: Partial<BillingPOCData>) => void
  isReadOnly?: boolean
  errors?: Record<string, string>
}

export function BillingPOCSection({ 
  organizationId, 
  data, 
  onChange, 
  isReadOnly = false,
  errors = {}
}: BillingPOCSectionProps) {
  const { members, isLoading: membersLoading } = useBillingPOCMembers(organizationId)

  const selectedMember = members.find(m => m.user_id === data.billing_poc_user_id)

  const handlePOCUserChange = (userId: string) => {
    onChange({ billing_poc_user_id: userId === 'none' ? null : userId })
  }

  const handleAdditionalEmailChange = (value: string) => {
    onChange({ billing_poc_additional_email: value })
  }

  const handlePhoneChange = (value: string) => {
    onChange({ billing_poc_phone: value })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Billing Point of Contact
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select a workspace owner from your organization to serve as the billing point of contact. 
          This information is required for compliance purposes.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField 
          label="Billing POC User" 
          required 
          htmlFor="billing-poc-user"
          helpText="Select a workspace owner who will be the primary contact for billing matters"
          error={errors.billing_poc_user_id}
        >
          <Select
            value={data.billing_poc_user_id || 'none'}
            onValueChange={handlePOCUserChange}
            disabled={isReadOnly || membersLoading}
          >
            <SelectTrigger className={errors.billing_poc_user_id ? 'border-destructive' : ''}>
              <SelectValue placeholder={membersLoading ? "Loading users..." : "Select a user"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No POC assigned</SelectItem>
              {members.map((member) => {
                const name = `${member.first_name || ''} ${member.last_name || ''}`.trim()
                const displayName = name || 'Unknown User'
                const email = member.email || 'No email'
                
                return (
                  <SelectItem key={member.user_id} value={member.user_id!}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <div className="flex flex-col">
                        <span className="font-medium">{displayName}</span>
                        <span className="text-xs text-muted-foreground">{email}</span>
                      </div>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </FormField>

        {selectedMember && (
          <FormField 
            label="Primary Email" 
            htmlFor="billing-poc-primary-email"
            helpText="This email is automatically populated from the selected user's profile"
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{selectedMember.email || 'No email on file'}</span>
              <span className="text-xs text-muted-foreground ml-auto">(Read-only)</span>
            </div>
          </FormField>
        )}

        <FormField 
          label="Additional Email (Optional)" 
          htmlFor="billing-poc-additional-email"
          helpText="Optional secondary email for billing communications"
          error={errors.billing_poc_additional_email}
        >
          <Input
            id="billing-poc-additional-email"
            type="email"
            value={data.billing_poc_additional_email || ''}
            onChange={(e) => handleAdditionalEmailChange(e.target.value)}
            placeholder="additional@company.com"
            disabled={isReadOnly}
            className={errors.billing_poc_additional_email ? 'border-destructive' : ''}
          />
        </FormField>

        <FormField 
          label="Phone Number" 
          required 
          htmlFor="billing-poc-phone"
          helpText="Primary phone number for billing-related contact"
          error={errors.billing_poc_phone}
        >
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="billing-poc-phone"
              type="tel"
              value={data.billing_poc_phone || ''}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className={`pl-10 ${errors.billing_poc_phone ? 'border-destructive' : ''}`}
              disabled={isReadOnly}
            />
          </div>
        </FormField>

        {members.length === 0 && !membersLoading && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No workspace owners available in this organization. 
            Please invite workspace owners first to assign a billing POC.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
