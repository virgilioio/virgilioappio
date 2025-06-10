
import { Shield, Database, Code, Users, LogOut } from "lucide-react";
import { AppContainer } from "@/components/layout/AppContainer";
import { Section } from "@/components/layout/Section";
import { StatusCard } from "@/components/StatusCard";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user, logout } = useAuth();

  return (
    <AuthGate>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-surface-primary">
          <AppContainer>
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-token-md">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">V</span>
                </div>
                <span className="font-semibold text-lg">Virgilio.io</span>
              </div>
              <div className="flex items-center gap-token-md">
                <span className="text-sm text-muted-foreground">
                  {user?.email}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="gap-token-sm"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
                <ThemeToggle />
              </div>
            </div>
          </AppContainer>
        </header>

        {/* Hero Section */}
        <Section className="py-layout-xl">
          <AppContainer>
            <div className="text-center space-y-token-xl animate-fade-in">
              <div className="space-y-token-lg">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                  Welcome to{" "}
                  <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    Virgilio.io
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Multi-tenant hiring platform MVP - You're now authenticated!
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-token-md justify-center">
                <Button size="lg" className="gap-token-sm">
                  <Users className="h-5 w-5" />
                  Get Started
                </Button>
                <Button variant="outline" size="lg" className="gap-token-sm">
                  <Code className="h-5 w-5" />
                  View Documentation
                </Button>
              </div>
            </div>
          </AppContainer>
        </Section>

        {/* Status Section */}
        <Section variant="muted">
          <AppContainer>
            <div className="space-y-token-xl">
              <div className="text-center space-y-token-md">
                <h2 className="text-3xl font-bold">Platform Status</h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Current system status and configuration overview for the Virgilio.io platform
                </p>
              </div>

              <div className="grid gap-token-lg md:grid-cols-2 lg:grid-cols-3">
                <StatusCard
                  title="Authentication"
                  icon={Shield}
                  status="connected"
                  description="User authentication system"
                  details="Supabase Auth active"
                />
                
                <StatusCard
                  title="Database"
                  icon={Database}
                  status="connected"
                  description="Supabase database connection"
                  details="Ready for data operations"
                />
                
                <StatusCard
                  title="Build Environment"
                  icon={Code}
                  status="development"
                  description="Current build mode"
                  details={`Mode: ${import.meta.env.MODE}`}
                />
              </div>
            </div>
          </AppContainer>
        </Section>

        {/* Features Preview */}
        <Section>
          <AppContainer>
            <div className="space-y-token-xl">
              <div className="text-center space-y-token-md">
                <h2 className="text-3xl font-bold">Coming Soon</h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Core features in development for the multi-tenant hiring platform
                </p>
              </div>

              <div className="grid gap-token-lg md:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    title: "Multi-tenant Architecture",
                    description: "Secure, scalable tenant isolation",
                    icon: "🏢"
                  },
                  {
                    title: "Candidate Management",
                    description: "Complete applicant tracking system",
                    icon: "👥"
                  },
                  {
                    title: "Interview Scheduling",
                    description: "Automated scheduling and coordination",
                    icon: "📅"
                  },
                  {
                    title: "Assessment Tools",
                    description: "Customizable evaluation workflows",
                    icon: "📊"
                  },
                  {
                    title: "Collaboration Suite",
                    description: "Team-based hiring decisions",
                    icon: "🤝"
                  },
                  {
                    title: "Analytics Dashboard",
                    description: "Hiring metrics and insights",
                    icon: "📈"
                  }
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="p-token-lg rounded-token border bg-card text-card-foreground hover:shadow-md transition-all duration-200"
                  >
                    <div className="space-y-token-md">
                      <div className="text-2xl">{feature.icon}</div>
                      <div>
                        <h3 className="font-semibold">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground mt-token-xs">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AppContainer>
        </Section>

        {/* Footer */}
        <footer className="border-t bg-surface-secondary">
          <AppContainer>
            <div className="py-layout-md text-center text-sm text-muted-foreground">
              <p>© 2024 Virgilio.io - Multi-tenant Hiring Platform MVP</p>
            </div>
          </AppContainer>
        </footer>
      </div>
    </AuthGate>
  );
};

export default Index;
