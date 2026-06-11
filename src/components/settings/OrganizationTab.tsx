import { useState, useEffect } from "react";
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
import { CurrencySettings } from "./CurrencySettings";
import { SettingsCard } from "@/components/settings/shared/SettingsCard";
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
      <SettingsCard title="Company">
        <p className="font-inter text-[12px] text-[#8B8F9E] py-4 text-center">Loading…</p>
      </SettingsCard>
    );
  }

  // Error state
  if (error) {
    return (
      <SettingsCard title="Company">
        <p className="font-inter text-[12px] text-[#A21D1D] py-4 text-center">Error loading company data</p>
      </SettingsCard>
    );
  }

  // No tenant state
  if (!tenant) {
    return (
      <SettingsCard title="Company">
        <p className="font-inter text-[12px] text-[#8B8F9E] py-4 text-center">
          No company data available. Contact support if this looks wrong.
        </p>
      </SettingsCard>
    );
  }

  // Check if current user can edit the tenant
  const canEditTenant = userType === 'platform_admin' || userType === 'workspace_owner';

  if (!canEditTenant) {
    return (
      <div className="space-y-4">
        <SettingsCard title="Company">
          <OrganizationDisplay tenant={tenant} />
        </SettingsCard>
        <CurrencySettings />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Company"
        description="Your company name and details, shown on careers pages, offers and invoices."
        action={
          !isEditMode ? (
            <Button size="sm" variant="secondary" icon={Pencil} onClick={handleEditModeToggle}>
              Edit
            </Button>
          ) : undefined
        }
      >
        {!isEditMode ? (
          <OrganizationDisplay tenant={tenant} />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company name</Label>
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
              <p className="font-inter text-[11.5px] text-[#8B8F9E]">
                Describe your company. Shown on your public careers page.
              </p>
              <RichTextEditor
                value={tenantFormData.about}
                onChange={(value) => handleFormDataChange("about", value)}
                placeholder="Tell candidates about your company, culture, mission, and values…"
                minHeight="150px"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-poppins font-semibold text-[12.5px] text-[#0d0d09]">Billing contact</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="billing_contact_name">Contact name</Label>
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
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-[#EFEFEA]">
            <Button
              variant="secondary"
              icon={X}
              onClick={handleEditModeToggle}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              icon={Save}
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              loading={isSaving}
            >
              Save changes
            </Button>
          </div>
        )}
      </SettingsCard>

      <CurrencySettings />

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
