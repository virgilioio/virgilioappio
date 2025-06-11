
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { AuthGate } from "@/components/auth/AuthGate";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import JobRequests from "./pages/JobRequests";
import Members from "./pages/Members";
import Organizations from "./pages/Organizations";
import Settings from "./pages/Settings";
import AdminInvoices from "./pages/AdminInvoices";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <AuthGate>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/jobs" element={<Jobs />} />
                        <Route path="/jobs/:id" element={<JobDetail />} />
                        <Route path="/job-requests" element={<JobRequests />} />
                        <Route path="/admin/members" element={<Members />} />
                        <Route path="/admin/organizations" element={<Organizations />} />
                        <Route path="/admin/invoices" element={<AdminInvoices />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Layout>
                  </AuthGate>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
