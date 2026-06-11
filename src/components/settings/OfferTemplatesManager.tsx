import { useState } from 'react'
import { InlineEmpty } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Edit, Trash2, FileText, Settings as SettingsIcon, Mail, FileCheck } from 'lucide-react'
import { useOfferTemplates, type OfferTemplate } from '@/hooks/useOfferTemplates'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { useContractTemplates } from '@/hooks/useContractTemplates'
import { OfferLetterSheet } from './templates/OfferLetterSheet'
import { EmailTemplateSheet } from './templates/EmailTemplateSheet'
import { ContractTemplateSheet } from './templates/ContractTemplateSheet'
import { OfferTemplateFieldsManager } from './OfferTemplateFieldsManager'
import { RejectionReasonsManager } from './RejectionReasonsManager'
import { RejectionEmailTemplatesManager } from './RejectionEmailTemplatesManager'
import { OfferFormsManager } from './OfferFormsManager'
import { CandidateSourcesManager } from './CandidateSourcesManager'

type TemplateType = 'offer-letters' | 'email-templates' | 'contract-templates' | 'rejection-reasons' | 'rejection-templates' | 'candidate-sources'

interface OfferTemplatesManagerProps {
  context?: 'platform-defaults' | 'organization'
}

export function OfferTemplatesManager({ context = 'organization' }: OfferTemplatesManagerProps) {
  const { templates: offerTemplates, isLoading: offerLoading, deleteTemplate: deleteOffer, copyPlatformTemplate: copyOffer } = useOfferTemplates(context)
  const { templates: emailTemplates, isLoading: emailLoading, deleteTemplate: deleteEmail } = useEmailTemplates(context)
  const { templates: contractTemplates, isLoading: contractLoading, deleteTemplate: deleteContract, copyPlatformTemplate: copyContract } = useContractTemplates(context)
  
  const [offerLetterSheet, setOfferLetterSheet] = useState({ open: false, templateId: undefined as string | undefined })
  const [emailTemplateSheet, setEmailTemplateSheet] = useState({ open: false, templateId: undefined as string | undefined })
  const [contractTemplateSheet, setContractTemplateSheet] = useState({ open: false, templateId: undefined as string | undefined })
  
  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const platformOfferTemplates = offerTemplates?.filter(t => t.source === 'platform')
  const tenantOfferTemplates = offerTemplates?.filter(t => t.source === 'tenant')
  const platformContractTemplates = contractTemplates?.filter(t => t.source === 'platform')
  const tenantContractTemplates = contractTemplates?.filter(t => t.source === 'tenant')

  const openCreateSheet = (type: TemplateType) => {
    if (type === 'offer-letters') {
      setOfferLetterSheet({ open: true, templateId: undefined })
    } else if (type === 'email-templates') {
      setEmailTemplateSheet({ open: true, templateId: undefined })
    } else if (type === 'contract-templates') {
      setContractTemplateSheet({ open: true, templateId: undefined })
    }
  }

  const openEditSheet = (templateId: string, type: TemplateType) => {
    if (type === 'offer-letters') {
      setOfferLetterSheet({ open: true, templateId })
    } else if (type === 'email-templates') {
      setEmailTemplateSheet({ open: true, templateId })
    } else if (type === 'contract-templates') {
      setContractTemplateSheet({ open: true, templateId })
    }
  }

  const openFieldsDialog = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setIsFieldsDialogOpen(true)
  }

  const handleCopyOffer = async (templateId: string) => {
    await copyOffer(templateId)
  }

  const handleCopyContract = async (templateId: string) => {
    await copyContract(templateId)
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="offer-forms" className="w-full">
        <TabsList className="bg-[#F1F0EC] p-1 h-auto rounded-full inline-flex gap-1 mb-4">
          {[
            ['offer-forms', 'Offer forms'],
            ['offer-letters', 'Offer letters'],
            ['email-templates', 'Emails'],
            ['contract-templates', 'Contracts'],
            ['rejection-reasons', 'Rejection reasons'],
            ['rejection-templates', 'Rejection templates'],
            ['candidate-sources', 'Sources'],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-full px-3 h-7 font-poppins font-medium text-[12px] text-[#5A6072] data-[state=active]:bg-[#0d0d09] data-[state=active]:text-[#fffcf9] data-[state=active]:shadow-none"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>


        <TabsContent value="offer-forms" className="mt-4">
          <OfferFormsManager context={context} />
        </TabsContent>

        <TabsContent value="offer-letters" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {context === 'platform-defaults' ? 'Platform Default Offer Templates' : 'Offer Letter Templates'}
                </CardTitle>
                <CardDescription>
                  {context === 'platform-defaults'
                    ? 'Manage platform-wide default offer letter templates'
                    : 'Manage offer letter templates for your organization'
                  }
                </CardDescription>
              </div>
              <Button onClick={() => openCreateSheet('offer-letters')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </CardHeader>
            <CardContent>
              {context === 'organization' && platformOfferTemplates.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold mb-2">Platform Library</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Default templates provided by the platform. Copy to your library to customize.
                  </p>
                  {offerLoading ? (
                    <div className="text-center py-8">Loading templates...</div>
                  ) : (
                    <div className="rounded-md border overflow-hidden mb-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {platformOfferTemplates.map((template) => (
                            <TableRow key={template.id}>
                              <TableCell className="font-medium">{template.name}</TableCell>
                              <TableCell>
                                {template.description || <span className="text-muted-foreground italic">No description</span>}
                              </TableCell>
                              <TableCell>
                                {new Date(template.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyOffer(template.id)}
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Copy to My Library
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {context === 'organization' && <h4 className="text-sm font-semibold mb-2">My Library</h4>}
              {offerLoading ? (
                <div className="text-center py-8">Loading templates...</div>
              ) : (context === 'organization' ? tenantOfferTemplates : offerTemplates).length === 0 ? (
                <InlineEmpty text="No offer templates yet. Create your first template to get started." />
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(context === 'organization' ? tenantOfferTemplates : offerTemplates).map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell>
                            {template.description || <span className="text-muted-foreground italic">No description</span>}
                          </TableCell>
                          <TableCell>
                            {new Date(template.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openFieldsDialog(template.id)}
                              >
                                <SettingsIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditSheet(template.id, 'offer-letters')}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Template</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{template.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteOffer(template.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-templates" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {context === 'platform-defaults' ? 'Platform Default Email Templates' : 'Email Templates'}
                </CardTitle>
                <CardDescription>
                  {context === 'platform-defaults'
                    ? 'Manage platform-wide default email templates'
                    : 'Manage email templates for your organization'
                  }
                </CardDescription>
              </div>
              <Button onClick={() => openCreateSheet('email-templates')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Email
              </Button>
            </CardHeader>
            <CardContent>
              {emailLoading ? (
                <div className="text-center py-8">Loading templates...</div>
              ) : emailTemplates.length === 0 ? (
                <InlineEmpty text="No email templates yet. Create your first template to get started." />
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Created</TableHead>
                        {context === 'organization' && <TableHead>Source</TableHead>}
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell>{template.subject}</TableCell>
                          <TableCell>
                            {new Date(template.created_at).toLocaleDateString()}
                          </TableCell>
                          {context === 'organization' && (
                            <TableCell>
                              <Badge variant={template.source === 'platform' ? 'source-inherited' : 'source-custom'}>
                                {template.source === 'platform' ? 'Inherited' : 'Custom'}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditSheet(template.id, 'email-templates')}
                                disabled={context === 'organization' && template.source === 'platform'}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    disabled={context === 'organization' && template.source === 'platform'}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Template</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{template.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteEmail(template.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contract-templates" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {context === 'platform-defaults' ? 'Platform Default Contract Templates' : 'Contract Templates'}
                </CardTitle>
                <CardDescription>
                  {context === 'platform-defaults'
                    ? 'Manage platform-wide default contract templates'
                    : 'Manage contract templates for your organization'
                  }
                </CardDescription>
              </div>
              <Button onClick={() => openCreateSheet('contract-templates')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Contract
              </Button>
            </CardHeader>
            <CardContent>
              {context === 'organization' && platformContractTemplates.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold mb-2">Platform Library</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Default templates provided by the platform. Copy to your library to customize.
                  </p>
                  {contractLoading ? (
                    <div className="text-center py-8">Loading templates...</div>
                  ) : (
                    <div className="rounded-md border overflow-hidden mb-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {platformContractTemplates.map((template) => (
                            <TableRow key={template.id}>
                              <TableCell className="font-medium">{template.name}</TableCell>
                              <TableCell>
                                {template.description || <span className="text-muted-foreground italic">No description</span>}
                              </TableCell>
                              <TableCell>
                                {new Date(template.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyContract(template.id)}
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Copy to My Library
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {context === 'organization' && <h4 className="text-sm font-semibold mb-2">My Library</h4>}
              {contractLoading ? (
                <div className="text-center py-8">Loading templates...</div>
              ) : (context === 'organization' ? tenantContractTemplates : contractTemplates).length === 0 ? (
                <InlineEmpty text="No contract templates yet. Create your first template to get started." />
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(context === 'organization' ? tenantContractTemplates : contractTemplates).map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell>
                            {template.description || <span className="text-muted-foreground italic">No description</span>}
                          </TableCell>
                          <TableCell>
                            {new Date(template.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditSheet(template.id, 'contract-templates')}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Template</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{template.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteContract(template.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejection-reasons" className="mt-4">
          <RejectionReasonsManager context={context} />
        </TabsContent>

        <TabsContent value="rejection-templates" className="mt-4">
          <RejectionEmailTemplatesManager context={context} />
        </TabsContent>

        <TabsContent value="candidate-sources" className="mt-4">
          <CandidateSourcesManager context={context} />
        </TabsContent>
      </Tabs>

      {/* Offer Letter Sheet */}
      <OfferLetterSheet
        open={offerLetterSheet.open}
        onOpenChange={(open) => setOfferLetterSheet({ open, templateId: undefined })}
        templateId={offerLetterSheet.templateId}
        context={context}
        onFieldsClick={openFieldsDialog}
      />

      {/* Email Template Sheet */}
      <EmailTemplateSheet
        open={emailTemplateSheet.open}
        onOpenChange={(open) => setEmailTemplateSheet({ open, templateId: undefined })}
        templateId={emailTemplateSheet.templateId}
        context={context}
      />

      {/* Contract Template Sheet */}
      <ContractTemplateSheet
        open={contractTemplateSheet.open}
        onOpenChange={(open) => setContractTemplateSheet({ open, templateId: undefined })}
        templateId={contractTemplateSheet.templateId}
        context={context}
      />

      {/* Template Fields Dialog */}
      <Dialog open={isFieldsDialogOpen} onOpenChange={() => setIsFieldsDialogOpen(false)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Template Fields</DialogTitle>
          </DialogHeader>
          {selectedTemplateId && (
            <OfferTemplateFieldsManager templateId={selectedTemplateId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
