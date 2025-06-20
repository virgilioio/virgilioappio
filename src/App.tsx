import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthContextProvider } from "@/contexts/AuthContext";
import { InvoiceProvider } from "@/contexts/InvoiceContext";
import Dashboard from "@/pages/Dashboard";
import Organizations from "@/pages/Organizations";
import Settings from "@/pages/Settings";
import Signin from "@/pages/Signin";
import Signup from "@/pages/Signup";
import Legal from "@/pages/Legal";
import NotFound from "@/pages/NotFound";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequirePlatformAdmin } from "@/components/auth/RequirePlatformAdmin";
import { RequireWorkspaceOwner } from "@/components/auth/RequireWorkspaceOwner";
import { OrganizationDetails } from "@/components/organizations/OrganizationDetails";
import { PlatformSettings } from "@/components/settings/PlatformSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthContextProvider>
      <InvoiceProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/signin" element={<Signin />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/legal" element={<Legal />} />

              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/organizations"
                element={
                  <RequireAuth>
                    <RequirePlatformAdmin>
                      <Organizations />
                    </RequirePlatformAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/organizations/:id"
                element={
                  <RequireAuth>
                    <RequirePlatformAdmin>
                      <OrganizationDetails />
                    </RequirePlatformAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <Settings />
                  </RequireAuth>
                }
              />
              <Route
                path="/platform-settings"
                element={
                  <RequireAuth>
                    <RequirePlatformAdmin>
                      <PlatformSettings />
                    </RequirePlatformAdmin>
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </InvoiceProvider>
    </AuthContextProvider>
  </QueryClientProvider>
);

export default App;
