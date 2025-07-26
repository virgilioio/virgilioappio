
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Edit, Lock, Save, X, FileText, Briefcase } from 'lucide-react'
import { JobRequestAgreementsManager } from './JobRequestAgreementsManager'
import { SafeHtml } from '@/components/ui/safe-html'

export function LegalManager() {
  const { getSetting, updateSetting, isUpdating } = usePlatformSettings()
  const { toast } = useToast()
  
  const [isEditingTerms, setIsEditingTerms] = useState(false)
  const [isEditingPrivacy, setIsEditingPrivacy] = useState(false)
  const [termsContent, setTermsContent] = useState('')
  const [privacyContent, setPrivacyContent] = useState('')
  const [originalTerms, setOriginalTerms] = useState('')
  const [originalPrivacy, setOriginalPrivacy] = useState('')

  useEffect(() => {
    const termsSetting = getSetting('terms_and_conditions')
    const privacySetting = getSetting('privacy_policy')
    
    const terms = termsSetting?.setting_value || ''
    const privacy = privacySetting?.setting_value || ''
    
    setTermsContent(terms)
    setPrivacyContent(privacy)
    setOriginalTerms(terms)
    setOriginalPrivacy(privacy)
  }, [getSetting])

  const handleEditTerms = () => {
    setOriginalTerms(termsContent)
    setIsEditingTerms(true)
  }

  const handleEditPrivacy = () => {
    setOriginalPrivacy(privacyContent)
    setIsEditingPrivacy(true)
  }

  const handleSaveTerms = async () => {
    const success = await updateSetting('terms_and_conditions', termsContent)
    if (success) {
      setIsEditingTerms(false)
      toast({
        title: 'Success',
        description: 'Terms and Conditions updated successfully'
      })
    }
  }

  const handleSavePrivacy = async () => {
    const success = await updateSetting('privacy_policy', privacyContent)
    if (success) {
      setIsEditingPrivacy(false)
      toast({
        title: 'Success',
        description: 'Privacy Policy updated successfully'
      })
    }
  }

  const handleCancelTerms = () => {
    setTermsContent(originalTerms)
    setIsEditingTerms(false)
  }

  const handleCancelPrivacy = () => {
    setPrivacyContent(originalPrivacy)
    setIsEditingPrivacy(false)
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="platform-docs" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="platform-docs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Platform Documents
          </TabsTrigger>
          <TabsTrigger value="job-agreements" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Job Request Agreements
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="platform-docs" className="space-y-6">
          {/* Terms and Conditions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Terms and Conditions
                  {!isEditingTerms && <Lock className="h-4 w-4 text-muted-foreground" />}
                </CardTitle>
                <CardDescription>
                  Manage your platform's terms and conditions
                </CardDescription>
              </div>
              {!isEditingTerms && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Edit Terms and Conditions</AlertDialogTitle>
                      <AlertDialogDescription>
                        You are about to edit the Terms and Conditions. This is a legal document that affects all users. Are you sure you want to proceed?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleEditTerms}>
                        Yes, Edit Terms
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingTerms ? (
                <>
                  <FormField 
                    label="Terms and Conditions Content"
                    helpText="Use the rich text editor to format your terms and conditions"
                  >
                    <RichTextEditor
                      value={termsContent}
                      onChange={setTermsContent}
                      placeholder="Enter your terms and conditions..."
                      minHeight="400px"
                    />
                  </FormField>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSaveTerms}
                      disabled={isUpdating}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isUpdating ? 'Saving...' : 'Save Terms'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleCancelTerms}
                      disabled={isUpdating}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="min-h-[200px] p-4 border rounded-md bg-muted/30">
                  {termsContent ? (
                    <SafeHtml 
                      content={termsContent}
                      className="prose prose-sm max-w-none"
                    />
                  ) : (
                    <p className="text-muted-foreground italic">No terms and conditions set</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Privacy Policy */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Privacy Policy
                  {!isEditingPrivacy && <Lock className="h-4 w-4 text-muted-foreground" />}
                </CardTitle>
                <CardDescription>
                  Manage your platform's privacy policy
                </CardDescription>
              </div>
              {!isEditingPrivacy && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Edit Privacy Policy</AlertDialogTitle>
                      <AlertDialogDescription>
                        You are about to edit the Privacy Policy. This is a legal document that affects all users. Are you sure you want to proceed?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleEditPrivacy}>
                        Yes, Edit Policy
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingPrivacy ? (
                <>
                  <FormField 
                    label="Privacy Policy Content"
                    helpText="Use the rich text editor to format your privacy policy"
                  >
                    <RichTextEditor
                      value={privacyContent}
                      onChange={setPrivacyContent}
                      placeholder="Enter your privacy policy..."
                      minHeight="400px"
                    />
                  </FormField>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSavePrivacy}
                      disabled={isUpdating}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isUpdating ? 'Saving...' : 'Save Policy'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleCancelPrivacy}
                      disabled={isUpdating}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="min-h-[200px] p-4 border rounded-md bg-muted/30">
                  {privacyContent ? (
                    <SafeHtml 
                      content={privacyContent}
                      className="prose prose-sm max-w-none"
                    />
                  ) : (
                    <p className="text-muted-foreground italic">No privacy policy set</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="job-agreements">
          <JobRequestAgreementsManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
