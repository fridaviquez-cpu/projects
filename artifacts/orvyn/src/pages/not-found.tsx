import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-[60dvh] w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md bg-card text-card-foreground">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle aria-hidden="true" className="h-8 w-8 shrink-0 text-muted-foreground" />
            <h1 className="text-2xl font-medium text-foreground">
              404 Page Not Found
            </h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            This page could not be found. Return to your dashboard to continue.
          </p>
          <Button asChild className="mt-6"><Link href="/">Back to dashboard</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
