import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { useTenantDomains } from '@/hooks/useTenantDomains';
import { Plus, Shield, ShieldCheck, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VerifiedDomainsManagerProps {
  tenantId: string;
  isWorkspaceOwner: boolean;
  isPlatformAdmin: boolean;
}

export function VerifiedDomainsManager({ 
  tenantId, 
  isWorkspaceOwner, 
  isPlatformAdmin 
}: VerifiedDomainsManagerProps) {
  const [newDomain, setNewDomain] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [verifyDialogDomain, setVerifyDialogDomain] = useState<string | null>(null);

  const {
    domains,
    isLoading,
    addDomain,
    deleteDomain,
    verifyDomain,
    isAddingDomain,
    isVerifyingDomain,
  } = useTenantDomains(tenantId);

  const canManageDomains = isWorkspaceOwner || isPlatformAdmin;

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    
    // Validate domain format
    const domainPattern = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainPattern.test(newDomain.trim())) {
      return;
    }

    addDomain(
      { domain: newDomain.trim(), tenantId },
      {
        onSuccess: () => {
          setNewDomain('');
          setIsAddDialogOpen(false);
        },
      }
    );
  };

  const handleVerifyDomain = (domainId: string, method: 'manual' | 'email') => {
    verifyDomain(
      { id: domainId, method },
      {
        onSuccess: () => {
          setVerifyDialogDomain(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verified Domains</CardTitle>
          <CardDescription>Loading domains...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Verified Domains</CardTitle>
            <CardDescription>
              Manage domains for automatic team member onboarding. Users signing up with these domains will automatically join your workspace.
            </CardDescription>
          </div>
          {canManageDomains && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Domain</DialogTitle>
                  <DialogDescription>
                    Enter your company domain (e.g., acme.com). After adding, you'll need to verify ownership.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      placeholder="example.com"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddDomain();
                        }
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddDomain} 
                    disabled={isAddingDomain || !newDomain.trim()}
                  >
                    {isAddingDomain ? 'Adding...' : 'Add Domain'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {domains.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No domains configured yet.</p>
            {canManageDomains && (
              <p className="text-sm mt-2">Add your company domain to enable auto-join for team members.</p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verification Method</TableHead>
                <TableHead>Added</TableHead>
                {canManageDomains && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => (
                <TableRow key={domain.id}>
                  <TableCell className="font-medium">{domain.domain}</TableCell>
                  <TableCell>
                    {domain.verified ? (
                      <Badge variant="default" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {domain.verification_method ? (
                      <span className="capitalize">{domain.verification_method}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(domain.created_at), { addSuffix: true })}
                  </TableCell>
                  {canManageDomains && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!domain.verified && (
                          <Dialog
                            open={verifyDialogDomain === domain.id}
                            onOpenChange={(open) =>
                              setVerifyDialogDomain(open ? domain.id : null)
                            }
                          >
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Verify
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Verify Domain: {domain.domain}</DialogTitle>
                                <DialogDescription>
                                  Choose how you'd like to verify ownership of this domain.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                {isPlatformAdmin && (
                                  <Button
                                    onClick={() => handleVerifyDomain(domain.id, 'manual')}
                                    disabled={isVerifyingDomain}
                                    className="w-full"
                                  >
                                    Manual Verification (Admin)
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  onClick={() => handleVerifyDomain(domain.id, 'email')}
                                  disabled={isVerifyingDomain}
                                  className="w-full"
                                >
                                  Email Verification
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Domain</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove <strong>{domain.domain}</strong>? 
                                Users with this domain will no longer auto-join your workspace.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteDomain(domain.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
