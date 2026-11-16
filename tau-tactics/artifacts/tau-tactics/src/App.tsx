import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Focus from '@/pages/focus';
import Learn from '@/pages/learn';
import AI from '@/pages/ai';
import PlanPage from '@/pages/plan';
import Toolkit from '@/pages/toolkit';
import Review from '@/pages/review';
import { Shell } from '@/components/shell';
import { TimerProvider } from '@/lib/timer';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/focus" component={Focus} />
          <Route path="/review/:id" component={Review} />
          <Route path="/learn" component={Learn} />
          <Route path="/ai" component={AI} />
          <Route path="/plan" component={PlanPage} />
          <Route path="/toolkit" component={Toolkit} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TimerProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
        </TimerProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
