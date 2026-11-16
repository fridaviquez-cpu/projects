import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import CoursePage from '@/pages/course';
import Learn from '@/pages/learn';
import LearnHub from '@/pages/learn-hub';
import Studio from '@/pages/studio';
import CourseLearnPage from '@/pages/course-learn';
import LibraryPage from '@/pages/library';
import ResourcesPage from '@/pages/resources';
import JourneyPage from '@/pages/journey';
import ReviewPage from '@/pages/review';
import MaterialsPage from '@/pages/materials';
import MaterialDetailPage from '@/pages/material-detail';
import { AuthCacheGuard } from '@/components/materials-kit';
import AdminReports from '@/pages/admin-reports';
import { GuestSession } from '@/components/guest-session';
import { Shell } from '@/components/shell';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/courses/:id/learn" component={CourseLearnPage} />
          <Route path="/courses/:id" component={CoursePage} />
          <Route path="/learn/210" component={Learn} />
          <Route path="/learn" component={LearnHub} />
          <Route path="/studio" component={Studio} />
          <Route path="/library" component={LibraryPage} />
          <Route path="/resources" component={ResourcesPage} />
          <Route path="/journey" component={JourneyPage} />
          <Route path="/review" component={ReviewPage} />
          <Route path="/materials" component={MaterialsPage} />
          <Route path="/materials/:id" component={MaterialDetailPage} />
          <Route path="/admin/reports" component={AdminReports} />
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
        <AuthCacheGuard />
        <GuestSession>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
        </GuestSession>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
