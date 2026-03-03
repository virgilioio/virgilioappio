import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

type TemplateType = 'offer-letters' | 'email-templates' | 'contract-templates' | 'rejection-reasons' | 'rejection-templates'

interface OfferTemplatesManagerProps {
  context?: 'platform-defaults' | 'organization'
}

export function OfferTemplatesManager({ context = 'organization' }: OfferTemplatesManagerProps) {
  // Hooks for different template types
  const { templates: offerTemplates, isLoading: offerLoading, deleteTemplate: deleteOffer, copyPlatformTemplate: copyOffer } = useOfferTemplates(context)
  const { templates: emailTemplates, isLoading: emailLoading, deleteTemplate: deleteEmail } = useEmailTemplates(context)
  const { templates: contractTemplates, isLoading: contractLoading, deleteTemplate: deleteContract, copyPlatformTemplate: copyContract } = useContractTemplates(context)
  
  // Sheet states
  const [offerLetterSheet, setOfferLetterSheet] = useState({ open: false, templateId: undefined as string | undefined })
  const [emailTemplateSheet, setEmailTemplateSheet] = useState({ open: false, templateId: undefined as string | undefined })
  const [contractTemplateSheet, setContractTemplateSheet] = useState({ open: false, templateId: undefined as string | undefined })
  
  // Fields dialog state
  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  // Separate platform and tenant templates
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
        <TabsList>
          <TabsTrigger value="offer-forms">Offer Forms</TabsTrigger>
          <TabsTrigger value="offer-letters">Offer Letters</TabsTrigger>
          <TabsTrigger value="email-templates">Email Templates</TabsTrigger>
          <TabsTrigger value="contract-templates">Contracts</TabsTrigger>
          <TabsTrigger value="rejection-reasons">Rejection Reasons</TabsTrigger>
          <TabsTrigger value="rejection-templates">Rejection Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="offer-forms" className="mt-4">
          <OfferFormsManager context={context} />
        </TabsContent>

        <TabsContent value="offer-letters" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {context === 'platform-defaults' ? 'Platform Default Offer Templates' : 'Offer Letter Templates'}
                </h3>
                <Button onClick={() => openCreateSheet('offer-letters')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </div>

              {context === 'organization' && platformOfferTemplates.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">Platform Library</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Default templates provided by the platform. Copy to your library to customize.
                  </p>
                  {offerLoading ? (
                    <div className="text-center py-8">Loading templates...</div>
                  ) : (
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
                  )}
                </div>
              )}

              {context === 'organization' && <h3 className="text-lg font-semibold mb-2">My Library</h3>}
              {offerLoading ? (
                <div className="text-center py-8">Loading templates...</div>
              ) : (context === 'organization' ? tenantOfferTemplates : offerTemplates).length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No offer templates found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create your first template to get started
                  </p>
                </div>
              ) : (
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
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-templates" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {context === 'platform-defaults' ? 'Platform Default Email Templates' : 'Email Templates'}
                </h3>
                <Button onClick={() => openCreateSheet('email-templates')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Email
                </Button>
              </div>

              {emailLoading ? (
                <div className="text-center py-8">Loading templates...</div>
              ) : emailTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No email templates found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create your first template to get started
                  </p>
                </div>
              ) : (
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
                            <Badge variant={template.source === 'platform' ? 'secondary' : 'default'}>
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contract-templates" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {context === 'platform-defaults' ? 'Platform Default Contract Templates' : 'Contract Templates'}
                </h3>
                <Button onClick={() => openCreateSheet('contract-templates')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Contract
                </Button>
              </div>

              {context === 'organization' && platformContractTemplates.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">Platform Library</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Default templates provided by the platform. Copy to your library to customize.
                  </p>
                  {contractLoading ? (
                    <div className="text-center py-8">Loading templates...</div>
                  ) : (
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
                  )}
                </div>
              )}

              {context === 'organization' && <h3 className="text-lg font-semibold mb-2">My Library</h3>}
              {contractLoading ? (
                <div className="text-center py-8">Loading templates...</div>
              ) : (context === 'organization' ? tenantContractTemplates : contractTemplates).length === 0 ? (
                <div className="text-center py-8">
                  <FileCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No contract templates found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create your first template to get started
                  </p>
                </div>
              ) : (
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
                                <Button 
                                  variant="ghost" 
                                  size="sm"
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
