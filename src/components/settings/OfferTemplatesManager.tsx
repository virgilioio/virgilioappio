import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Plus, Edit, Trash2, FileText, Settings as SettingsIcon, Mail, FileCheck, Ban, FileX } from 'lucide-react'
import { useOfferTemplates, type OfferTemplate } from '@/hooks/useOfferTemplates'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { useContractTemplates } from '@/hooks/useContractTemplates'
import { OfferLetterSheet } from './templates/OfferLetterSheet'
import { EmailTemplateSheet } from './templates/EmailTemplateSheet'
import { ContractTemplateSheet } from './templates/ContractTemplateSheet'
import { OfferTemplateFieldsManager } from './OfferTemplateFieldsManager'
import { RejectionReasonsManager } from './RejectionReasonsManager'

type TemplateType = 'offer-letters' | 'email-templates' | 'contract-templates' | 'rejection-reasons' | 'rejection-templates'

interface OfferTemplatesManagerProps {
  context?: 'platform-defaults' | 'organization'
}

export function OfferTemplatesManager({ context = 'organization' }: OfferTemplatesManagerProps) {
  const [templateType, setTemplateType] = useState<TemplateType>('offer-letters')
  
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

  const openCreateSheet = () => {
    if (templateType === 'offer-letters') {
      setOfferLetterSheet({ open: true, templateId: undefined })
    } else if (templateType === 'email-templates') {
      setEmailTemplateSheet({ open: true, templateId: undefined })
    } else if (templateType === 'contract-templates') {
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {context === 'platform-defaults' ? 'Platform Default Templates' : 'Templates'}
            </CardTitle>
            
            {templateType !== 'rejection-reasons' && templateType !== 'rejection-templates' && (
              <Button onClick={openCreateSheet}>
                <Plus className="h-4 w-4 mr-2" />
                {templateType === 'offer-letters' && 'Create Template'}
                {templateType === 'email-templates' && 'Create Email'}
                {templateType === 'contract-templates' && 'Create Contract'}
              </Button>
            )}
          </div>
          
          <ToggleGroup 
            type="single" 
            value={templateType} 
            onValueChange={(value) => value && setTemplateType(value as TemplateType)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="offer-letters" aria-label="Offer Letters">
              <FileText className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Offer Letters</span>
              <span className="sm:hidden">Offers</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="email-templates" aria-label="Email Templates">
              <Mail className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Email</span>
              <span className="sm:hidden">Email</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="contract-templates" aria-label="Contract Templates">
              <FileCheck className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Contracts</span>
              <span className="sm:hidden">Contracts</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="rejection-reasons" aria-label="Rejection Reasons">
              <Ban className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Rejection Reasons</span>
              <span className="sm:hidden">Reasons</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="rejection-templates" aria-label="Rejection Templates" disabled className="opacity-60">
              <FileX className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Rejection Templates</span>
              <span className="sm:hidden">Reject</span>
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">Soon</Badge>
            </ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          {templateType === 'offer-letters' && (
            <>
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
            </>
          )}
          
          {templateType === 'email-templates' && (
            <>
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
            </>
          )}
          
          {templateType === 'contract-templates' && (
            <>
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
            </>
          )}
          
          {templateType === 'rejection-reasons' && (
            <RejectionReasonsManager context={context} />
          )}

          {templateType === 'rejection-templates' && (
            <div className="text-center py-12">
              <FileX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">Coming Soon</h3>
              <p className="text-text-secondary">
                Create rejection email templates for consistent and professional candidate communication.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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