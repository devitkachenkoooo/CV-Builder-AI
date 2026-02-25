import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";

// Pages
import LandingPage from "@/pages/LandingPage";
import GalleryPage from "@/pages/GalleryPage";
import MyResumesPage from "@/pages/MyResumesPage";
import CvViewPage from "@/pages/CvViewPage";
import PdfGenerationPage from "@/pages/PdfGenerationPage";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground font-medium animate-pulse">Authenticating...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // We render Landing Page for unauthenticated root path
    return <LandingPage />;
  }

  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      {/* Root path: Gallery if logged in, Landing if logged out */}
      <Route path="/">
        {isAuthenticated ? <GalleryPage /> : <LandingPage />}
      </Route>
      
      {/* Protected Routes */}
      <Route path="/my-resumes">
        {() => <ProtectedRoute component={MyResumesPage} />}
      </Route>
      
      <Route path="/cv/:id">
        {() => <ProtectedRoute component={CvViewPage} />}
      </Route>
      
      {/* PDF Generation Page - no auth required */}
      <Route path="/pdf-generation/:html">
        <PdfGenerationPage />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
