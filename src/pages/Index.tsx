
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Briefcase, Settings, CreditCard, Shield } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { usePermissions } from "@/hooks/usePermissions";

export default function Index() {
  const permissions = usePermissions();

  return (
    <AuthGate>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-token-xl px-token-lg">
          {/* Header */}
          <div className="mb-token-xl">
            <h1 className="text-4xl font-bold tracking-tight mb-token-md">
              Welcome to the Dashboard
            </h1>
            <p className="text-xl text-muted-foreground">
              Manage your workspace with role-based access controls
            </p>
          </div>

          {/* Permission-based Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-token-lg mb-token-xl">
            
            {/* Organizations Management */}
            <PermissionGate permission="canManageOrganization">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-token-md">
                    <Building2 className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle>Organizations</CardTitle>
                      <CardDescription>Manage organizations and settings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link to="/admin/organizations">
                    <Button className="w-full">Manage Organizations</Button>
                  </Link>
                </CardContent>
              </Card>
            </PermissionGate>

            {/* Members Management */}
            <PermissionGate permission="canManageMembers">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-token-md">
                    <Users className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle>Team Members</CardTitle>
                      <CardDescription>Invite and manage team members</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled>
                    Manage Members
                    <Badge variant="secondary" className="ml-token-sm">Coming Soon</Badge>
                  </Button>
                </CardContent>
              </Card>
            </PermissionGate>

            {/* Job Management */}
            <PermissionGate permission="canCreateJobs">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-token-md">
                    <Briefcase className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle>Job Postings</CardTitle>
                      <CardDescription>Create and manage job listings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled>
                    Manage Jobs
                    <Badge variant="secondary" className="ml-token-sm">Coming Soon</Badge>
                  </Button>
                </CardContent>
              </Card>
            </PermissionGate>

            {/* Settings */}
            <PermissionGate permission="canManageOrganization">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-token-md">
                    <Settings className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle>Settings</CardTitle>
                      <CardDescription>Configure workspace settings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled>
                    Workspace Settings
                    <Badge variant="secondary" className="ml-token-sm">Coming Soon</Badge>
                  </Button>
                </CardContent>
              </Card>
            </PermissionGate>

            {/* Billing */}
            <PermissionGate permission="canViewBilling">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-token-md">
                    <CreditCard className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle>Billing</CardTitle>
                      <CardDescription>View billing and subscription details</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled>
                    View Billing
                    <Badge variant="secondary" className="ml-token-sm">Coming Soon</Badge>
                  </Button>
                </CardContent>
              </Card>
            </PermissionGate>

            {/* Admin Panel */}
            <PermissionGate permission="isPlatformAdmin">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20">
                <CardHeader>
                  <div className="flex items-center gap-token-md">
                    <Shield className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle className="flex items-center gap-token-sm">
                        Admin Panel
                        <Badge variant="destructive">Admin</Badge>
                      </CardTitle>
                      <CardDescription>Platform administration tools</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled>
                    Admin Tools
                    <Badge variant="secondary" className="ml-token-sm">Coming Soon</Badge>
                  </Button>
                </CardContent>
              </Card>
            </PermissionGate>
          </div>

          {/* User Role Information */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Your Access Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-token-sm">
                {permissions.isPlatformAdmin && (
                  <Badge variant="destructive">Platform Admin</Badge>
                )}
                {permissions.isWorkspaceOwner && (
                  <Badge variant="default">Workspace Owner</Badge>
                )}
                {permissions.isMember && !permissions.isWorkspaceOwner && (
                  <Badge variant="secondary">Member</Badge>
                )}
                {permissions.isGuest && (
                  <Badge variant="outline">Guest</Badge>
                )}
                
                {/* Sub-roles */}
                {permissions.isRecruiter && (
                  <Badge variant="outline">Recruiter</Badge>
                )}
                {permissions.isCustomerSuccess && (
                  <Badge variant="outline">Customer Success</Badge>
                )}
                {permissions.isBilling && (
                  <Badge variant="outline">Billing</Badge>
                )}
                {permissions.isSales && (
                  <Badge variant="outline">Sales</Badge>
                )}
                {permissions.isAdmin && (
                  <Badge variant="outline">Admin</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Guest Message */}
          <PermissionGate permission="isGuest">
            <Card className="mt-token-lg border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-amber-800">Guest Access</CardTitle>
                <CardDescription className="text-amber-700">
                  You have limited access. Contact your administrator to get proper permissions.
                </CardDescription>
              </CardHeader>
            </Card>
          </PermissionGate>
        </div>
      </div>
    </AuthGate>
  );
}
