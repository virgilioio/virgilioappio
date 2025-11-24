import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { OrganizationDisplay } from "./OrganizationDisplay";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pencil, Save, X } from "lucide-react";

interface TenantFormData {
  name: string;
  about: string;
  billing_contact_name?: string;
  billing_email?: string;
  billing_phone?: string;
}

export default function OrganizationTab() {
  const { toast } = useToast();
  const { userType } = useAuth();
  const { tenant, isLoading, error, updateTenant } = useTenant();
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [tenantFormData, setTenantFormData] = useState<TenantFormData>({
    name: tenant?.name || "",
    about: tenant?.about || "",
    billing_contact_name: tenant?.billing_contact_name || "",
    billing_email: tenant?.billing_email || "",
    billing_phone: tenant?.billing_phone || "",
  });

  useEffect(() => {
    if (tenant) {
      setTenantFormData({
        name: tenant.name || "",
        about: tenant.about || "",
        billing_contact_name: tenant.billing_contact_name || "",
        billing_email: tenant.billing_email || "",
        billing_phone: tenant.billing_phone || "",
      });
    }
  }, [tenant]);

  const handleFormDataChange = (field: keyof TenantFormData, value: string) => {
    setTenantFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleEditModeToggle = () => {
    if (isEditMode && hasUnsavedChanges) {
      setShowCancelDialog(true);
    } else {
      setIsEditMode(!isEditMode);
      if (!isEditMode && tenant) {
        setTenantFormData({
          name: tenant.name || "",
          about: tenant.about || "",
          billing_contact_name: tenant.billing_contact_name || "",
          billing_email: tenant.billing_email || "",
          billing_phone: tenant.billing_phone || "",
        });
        setHasUnsavedChanges(false);
      }
    }
  };

  const handleCancelEdit = () => {
    if (tenant) {
      setTenantFormData({
        name: tenant.name || "",
        about: tenant.about || "",
        billing_contact_name: tenant.billing_contact_name || "",
        billing_email: tenant.billing_email || "",
        billing_phone: tenant.billing_phone || "",
      });
    }
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    setShowCancelDialog(false);
  };

  const handleSave = async () => {
    if (!tenant?.id) {
      toast({
        title: "Error",
        description: "No tenant found",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateTenant.mutateAsync({
        name: tenantFormData.name,
        about: tenantFormData.about,
        billing_contact_name: tenantFormData.billing_contact_name || null,
        billing_email: tenantFormData.billing_email || null,
        billing_phone: tenantFormData.billing_phone || null,
      });

      setIsEditMode(false);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to update tenant:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-md">
        <PageHeader
          title="Company Profile"
          subtitle="View and manage your company information"
        />
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-md">
        <PageHeader
          title="Company Profile"
          subtitle="View and manage your company information"
        />
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-destructive">Error loading company data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No tenant state
  if (!tenant) {
    return (
      <div className="space-y-md">
        <PageHeader
          title="Company Profile"
          subtitle="View and manage your company information"
        />
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                No company data available. Please contact support if you believe this is an error.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if current user can edit the tenant
  const canEditTenant = userType === 'platform_admin' || userType === 'workspace_owner';

  if (!canEditTenant) {
    return (
      <div className="space-y-md">
        <PageHeader
          title="Company Profile"
          subtitle="View and manage your company information"
        />
        <Card>
          <CardContent className="pt-6">
            <OrganizationDisplay tenant={tenant} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-md">
      <PageHeader
        title="Company Profile"
        subtitle="View and manage your company information"
      >
        {!isEditMode && (
          <Button
            onClick={handleEditModeToggle}
            variant="outline"
            size="sm"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-md">
          {!isEditMode ? (
            <OrganizationDisplay tenant={tenant} />
          ) : (
            <div className="space-y-sm">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  value={tenantFormData.name}
                  onChange={(e) => handleFormDataChange("name", e.target.value)}
                  placeholder="Enter company name"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="about">About</Label>
                <p className="text-xs text-muted-foreground">
                  Describe your company. This information can be displayed on your public careers page.
                </p>
                <RichTextEditor
                  value={tenantFormData.about}
                  onChange={(value) => handleFormDataChange("about", value)}
                  placeholder="Tell candidates about your company, culture, mission, and values..."
                  minHeight="150px"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Billing Contact</h4>
                <div className="space-y-sm">
                  <div className="space-y-2">
                    <Label htmlFor="billing_contact_name">Contact Name</Label>
                    <Input
                      id="billing_contact_name"
                      value={tenantFormData.billing_contact_name || ""}
                      onChange={(e) => handleFormDataChange("billing_contact_name", e.target.value)}
                      placeholder="Enter billing contact name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing_email">Email</Label>
                    <Input
                      id="billing_email"
                      type="email"
                      value={tenantFormData.billing_email || ""}
                      onChange={(e) => handleFormDataChange("billing_email", e.target.value)}
                      placeholder="Enter billing email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing_phone">Phone</Label>
                    <Input
                      id="billing_phone"
                      type="tel"
                      value={tenantFormData.billing_phone || ""}
                      onChange={(e) => handleFormDataChange("billing_phone", e.target.value)}
                      placeholder="Enter billing phone number"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {isEditMode && (
            <div className="flex justify-end gap-2 pt-md">
              <Button
                variant="outline"
                onClick={handleEditModeToggle}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to cancel? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCancelDialog(false)}>
              Continue Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCancelDialog(false);
                handleCancelEdit();
              }}
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
