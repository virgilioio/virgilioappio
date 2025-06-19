
import { useOrganizations } from '@/hooks/useOrganizations'
import { useCountryFields } from '@/hooks/useCountryFields'
import { useOrganizationCustomData } from '@/hooks/useOrganizationCustomData'
import { useBillingPOCMembers } from '@/hooks/useBillingPOCMembers'
import { useAuth } from '@/contexts/AuthContext'

export interface OrganizationProgressItem {
  id: string
  label: string
  completed: boolean
  required: boolean
}

export function useOrganizationProgress() {
  const { organizations } = useOrganizations()
  const { user, userType } = useAuth()
  
  // Get user's organization
  const getUserOrganization = () => {
    if (!organizations || organizations.length === 0) return null
    
    if ((userType === 'workspace_owner' || userType === 'platform_admin') && user) {
      const ownedOrganization = organizations.find(org => org.owner_id === user.id)
      if (ownedOrganization) return ownedOrganization
      
      if (userType === 'platform_admin') {
        return organizations[0]
      }
    }
    
    return organizations[0]
  }
  
  const organization = getUserOrganization()
  const { fields } = useCountryFields(organization?.country || '')
  const { customData } = useOrganizationCustomData(organization?.id)
  const { members } = useBillingPOCMembers(organization?.id || '')
  
  const calculateProgress = () => {
    if (!organization) return { items: [], progress: 0, isComplete: false }
    
    const billingPOCMember = members.find(m => m.user_id === organization.billing_poc_user_id)
    
    const items: OrganizationProgressItem[] = [
      {
        id: 'basic_info',
        label: 'Organization Name & Country',
        completed: !!(organization.name && organization.country),
        required: true
      },
      {
        id: 'billing_poc',
        label: 'Billing Point of Contact',
        completed: !!(
          organization.billing_poc_user_id && 
          billingPOCMember && 
          organization.billing_poc_phone
        ),
        required: true
      }
    ]
    
    // Add country-specific field requirements
    fields.forEach(field => {
      const customFieldData = customData.find(data => data.country_field_id === field.id)
      const hasValue = field.field_type === 'file' 
        ? !!customFieldData?.file_url 
        : !!customFieldData?.field_value
      
      items.push({
        id: `custom_field_${field.id}`,
        label: field.field_label,
        completed: hasValue,
        required: field.is_required
      })
    })
    
    const requiredItems = items.filter(item => item.required)
    const completedRequired = requiredItems.filter(item => item.completed)
    const progress = requiredItems.length > 0 ? Math.round((completedRequired.length / requiredItems.length) * 100) : 100
    
    return {
      items,
      progress,
      isComplete: progress === 100
    }
  }
  
  return calculateProgress()
}
