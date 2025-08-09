
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, Briefcase } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { PermissionGate } from "@/components/auth/PermissionGate";

const Index = () => {
  return (
    <AuthGate>
      <div className="min-h-screen bg-background">
        <Section container className="py-token-xl animate-fade-in">
          <div className="text-center mb-token-xl">
            <h1 className="text-4xl font-bold tracking-tight">
              Welcome to Your Platform
            </h1>
            <p className="text-xl text-muted-foreground mt-token-md">
              Manage your organization, members, and jobs all in one place
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-token-lg">
            <PermissionGate permission="canManageOrganization">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-token-sm">
                    <Building2 className="h-5 w-5" />
                    Organizations
                  </CardTitle>
                  <CardDescription>
                    Manage your organizations and settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/admin/organizations">
                    <Button className="w-full">
                      Manage Organizations
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </PermissionGate>

            <PermissionGate permission="canViewMembers">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-token-sm">
                    <Users className="h-5 w-5" />
                    Team Members
                  </CardTitle>
                  <CardDescription>
                    Invite and manage team members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/admin/members">
                    <Button className="w-full">
                      Manage Members
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </PermissionGate>

            <PermissionGate permission="canViewJobs">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-token-sm">
                    <Briefcase className="h-5 w-5" />
                    Jobs
                  </CardTitle>
                  <CardDescription>
                    Create and manage job postings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/jobs">
                    <Button className="w-full">
                      Manage Jobs
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </PermissionGate>
          </div>
        </div>
      </div>
    </AuthGate>
  );
};

export default Index;
