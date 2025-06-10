
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Layout } from "@/components/layout/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const Organizations = lazy(() => import("./pages/Organizations"));
const Members = lazy(() => import("./pages/Members"));
const Jobs = lazy(() => import("./pages/Jobs"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const JobRequests = lazy(() => import("./pages/JobRequests"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected routes with layout */}
            <Route 
              path="/" 
              element={
                <Layout>
                  <Index />
                </Layout>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <Layout>
                  <Settings />
                </Layout>
              } 
            />
            <Route 
              path="/admin/organizations" 
              element={
                <Layout>
                  <Suspense fallback={<div>Loading...</div>}>
                    <Organizations />
                  </Suspense>
                </Layout>
              } 
            />
            <Route 
              path="/admin/members" 
              element={
                <Layout>
                  <Suspense fallback={<div>Loading...</div>}>
                    <Members />
                  </Suspense>
                </Layout>
              } 
            />
            <Route 
              path="/jobs" 
              element={
                <Layout>
                  <Suspense fallback={<div>Loading...</div>}>
                    <Jobs />
                  </Suspense>
                </Layout>
              } 
            />
            <Route 
              path="/jobs/:id" 
              element={
                <Layout>
                  <Suspense fallback={<div>Loading...</div>}>
                    <JobDetail />
                  </Suspense>
                </Layout>
              } 
            />
            <Route 
              path="/job-requests" 
              element={
                <Layout>
                  <Suspense fallback={<div>Loading...</div>}>
                    <JobRequests />
                  </Suspense>
                </Layout>
              } 
            />
            
            {/* Catch all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <DebugPanel />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
