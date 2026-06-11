import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { CurrencySettings } from "./CurrencySettings";
import { SettingsCard } from "@/components/settings/shared/SettingsCard";
import { stripHtmlToPlainText } from "@/utils/templateUtils";

interface TenantFormData {
  name: string;
  about: string;
  billing_email: string;
  billing_phone: string;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-inter text-[11.5px] font-medium text-[#5A6072] mb-1.5 block">
      {children}
    </label>
  );
}

export default function OrganizationTab() {
  const { toast } = useToast();
  const { userType } = useAuth();
  const { tenant, isLoading, error, updateTenant } = useTenant();
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [form, setForm] = useState<TenantFormData>({
    name: "",
    about: "",
    billing_email: "",
    billing_phone: "",
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name || "",
        about: stripHtmlToPlainText(tenant.about || ""),
        billing_email: tenant.billing_email || "",
        billing_phone: tenant.billing_phone || "",
      });
      setDirty(false);
    }
  }, [tenant]);

  const update = (field: keyof TenantFormData, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setDirty(true);
  };

  const canEdit = userType === "platform_admin" || userType === "workspace_owner";

  const handleSave = async () => {
    if (!tenant?.id) return;
    setIsSaving(true);
    try {
      await updateTenant.mutateAsync({
        name: form.name,
        about: form.about,
        billing_email: form.billing_email || null,
        billing_phone: form.billing_phone || null,
      });
      setDirty(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SettingsCard title="Company">
        <p className="font-inter text-[12px] text-[#8B8F9E] py-4 text-center">Loading…</p>
      </SettingsCard>
    );
  }

  if (error || !tenant) {
    return (
      <SettingsCard title="Company">
        <p className="font-inter text-[12px] text-[#A21D1D] py-4 text-center">
          {error ? "Error loading company data" : "No company data available."}
        </p>
      </SettingsCard>
    );
  }

  const createdDate = new Date(tenant.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const statusTone = tenant.status === "active" ? "green" : "neutral";

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Company"
        description="Workspace identity — name, story, and billing contact."
        action={
          <Badge tone={statusTone as any} size="sm" dot>
            {tenant.status === "active" ? "Active" : tenant.status}
          </Badge>
        }
      >
        <div className="space-y-5">
          {/* Row 1: Name + Created */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Company name</FieldLabel>
              <Input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                disabled={!canEdit}
                placeholder="Enter company name"
              />
            </div>
            <div>
              <FieldLabel>Created</FieldLabel>
              <Input value={createdDate} disabled readOnly className="bg-[#FAFAF7] text-[#5A6072]" />
            </div>
          </div>

          {/* About */}
          <div>
            <FieldLabel>About</FieldLabel>
            <Textarea
              value={form.about}
              onChange={(e) => update("about", e.target.value)}
              disabled={!canEdit}
              placeholder="Tell candidates about your company, culture, mission, and values…"
              rows={4}
              className="resize-y min-h-[110px]"
            />
            <p className="font-inter text-[11px] text-[#8B8F9E] mt-1.5">
              Feeds your careers page hero — keep it candidate-facing.
            </p>
          </div>

          {/* Billing contact row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Billing contact email</FieldLabel>
              <Input
                type="email"
                value={form.billing_email}
                onChange={(e) => update("billing_email", e.target.value)}
                disabled={!canEdit}
                placeholder="billing@company.com"
              />
            </div>
            <div>
              <FieldLabel>Billing contact phone</FieldLabel>
              <Input
                type="tel"
                value={form.billing_phone}
                onChange={(e) => update("billing_phone", e.target.value)}
                disabled={!canEdit}
                placeholder="+1 555 000 0000"
              />
            </div>
          </div>

          {/* Tenant ID — readonly mono */}
          <div>
            <FieldLabel>Tenant ID</FieldLabel>
            <Input
              value={tenant.id}
              disabled
              readOnly
              onClick={(e) => {
                (e.target as HTMLInputElement).select();
                navigator.clipboard?.writeText(tenant.id).then(() => {
                  toast({ title: "Copied", description: "Tenant ID copied to clipboard" });
                });
              }}
              className="bg-[#FAFAF7] text-[#5A6072] font-mono text-[12px] cursor-pointer"
            />
          </div>

          {canEdit && (
            <div className="flex justify-end pt-3 border-t border-[#EFEFEA]">
              <Button onClick={handleSave} disabled={!dirty || isSaving} loading={isSaving}>
                Save changes
              </Button>
            </div>
          )}
        </div>
      </SettingsCard>

      <CurrencySettings />
    </div>
  );
}
