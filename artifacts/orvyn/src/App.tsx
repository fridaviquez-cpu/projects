import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Shell } from '@/components/shell';
import { WorkspaceProvider } from '@/lib/orvyn';
import Dashboard from '@/pages/dashboard';
import Opportunities from '@/pages/opportunities';
import Vault from '@/pages/vault';
import Resumes from '@/pages/resumes';
import Coach from '@/pages/coach';
import Dna from '@/pages/dna';
import Insights from '@/pages/insights';
import Settings from '@/pages/settings';
import { ResumeDraftProvider } from '@/lib/resume-drafts';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000, refetchOnWindowFocus: true } } });

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  useEffect(() => {
    const page = location === '/' ? 'Dashboard' : location.slice(1).replace(/^\w/, c => c.toUpperCase());
    document.title = `${page} · Orvyn`;
  }, [location]);
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/opportunities" component={Opportunities} />
          <Route path="/vault" component={Vault} />
          <Route path="/resumes" component={Resumes} />
          <Route path="/coach" component={Coach} />
          <Route path="/dna" component={Dna} />
          <Route path="/insights" component={Insights} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider>
        <ResumeDraftProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
        </ResumeDraftProvider>
      </WorkspaceProvider>
    </QueryClientProvider>
  );
}

export default App;
