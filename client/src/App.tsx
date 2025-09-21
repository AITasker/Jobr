import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Suspense, lazy } from "react";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/not-found";

// PERFORMANCE: Lazy load secondary pages for better initial bundle size
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Login = lazy(() => import("@/pages/Login"));
const Billing = lazy(() => import("@/pages/Billing"));
const PlanSelection = lazy(() => import("@/pages/PlanSelection"));

// Loading component for Suspense fallback
function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login">
        <Suspense fallback={<PageLoading />}>
          <Login />
        </Suspense>
      </Route>
      <Route path="/signup">
        <Suspense fallback={<PageLoading />}>
          <Login />
        </Suspense>
      </Route>
      <Route path="/dashboard">
        <Suspense fallback={<PageLoading />}>
          <Dashboard />
        </Suspense>
      </Route>
      <Route path="/billing">
        <Suspense fallback={<PageLoading />}>
          <Billing />
        </Suspense>
      </Route>
      <Route path="/plan-selection">
        <Suspense fallback={<PageLoading />}>
          <PlanSelection />
        </Suspense>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Router />
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
