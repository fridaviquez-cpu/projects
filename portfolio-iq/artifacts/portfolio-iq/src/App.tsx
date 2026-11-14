import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Compass, RotateCw } from 'lucide-react';
import { useGetWorkspace } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Shell } from '@/components/shell';
import NotFound from '@/pages/not-found';
import Overview from '@/pages/overview';
import Portfolio from '@/pages/portfolio';
import Learn from '@/pages/learn';
import Resources from '@/pages/resources';
import ThesisPage from '@/pages/thesis';
import Wealth from '@/pages/wealth';
import Budget from '@/pages/budget';
import SettingsPage from '@/pages/settings';
import Onboarding from '@/pages/onboarding';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });

const PAGE_INFO: Record<string, [string, string]> = {
  "/": ["Overview", "Understand what you own with private portfolio snapshots, clear allocation, and educational insights. No login required."],
  "/portfolio": ["Holdings", "Import brokerage screenshots or record holdings by hand, with snapshot prices, and optional total cost basis in your private PortfolioIQ workspace."],
  "/learn": ["Learn", "Build investing knowledge with short lessons, quizzes, and automatically saved progress."],
  "/resources": ["Resources", "Explore evidence-led investing explanations, risks, sources, and your bookmarked topics."],
  "/thesis": ["Thesis journal", "Record your investment reasoning, risks, and what would change your mind before you trade."],
  "/wealth": ["Wealth sketch", "Explore a constant-rate compound-growth illustration. Not a forecast or investment recommendation."],
  "/budget": ["Budget", "Keep a private monthly ledger with optional receipt photo import, set a spending limit, and understand your categories."],
  "/onboarding": ["Personalize", "Optional setup: answer up to seven questions so PortfolioIQ explains things at your level. Skip any time."],
  "/settings": ["Settings", "Manage your private guest workspace, export records, and save a secret recovery key for another browser."],
};

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/learn" component={Learn} />
        <Route path="/resources" component={Resources} />
        <Route path="/thesis" component={ThesisPage} />
        <Route path="/wealth" component={Wealth} />
        <Route path="/budget" component={Budget} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/onboarding" component={Onboarding} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  useEffect(() => {
    const [title, description] = PAGE_INFO[location] ?? ["Page not found", "Return to your private PortfolioIQ workspace."];
    document.title = `${title} | PortfolioIQ`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  }, [location]);
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

/** Only the workspace query runs first, so the guest cookie is set before any other request. */
function WorkspaceGate() {
  const ws = useGetWorkspace();
  if (ws.isLoading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <div className="rise text-center">
          <span className="mx-auto mb-5 grid h-12 w-12 animate-pulse place-items-center rounded-full bg-accent text-accent-foreground"><Compass className="h-5 w-5" /></span>
          <p className="font-display text-3xl">Opening your workspace</p>
          <p className="mt-1 text-sm text-muted-foreground">Private to this browser. No sign-in needed.</p>
        </div>
      </div>
    );
  }
  if (ws.isError || !ws.data) {
    return (
      <div className="grid min-h-[100dvh] place-items-center px-6">
        <div className="paper max-w-md p-8 text-center" role="alert">
          <p className="eyebrow mb-2">Couldn't connect</p>
          <p className="font-display text-3xl">Your workspace didn't open.</p>
          <p className="mt-2 text-sm text-muted-foreground">Nothing was lost. This is usually a brief network hiccup.</p>
          <Button className="mt-5" onClick={() => ws.refetch()} data-testid="button-retry-workspace"><RotateCw className="mr-2 h-4 w-4" />Try again</Button>
        </div>
      </div>
    );
  }
  return <Shell key={ws.data.id}><Router /></Shell>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <WorkspaceGate />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
