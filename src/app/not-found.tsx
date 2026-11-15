import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
            <Compass className="size-6" />
          </div>
          <h1 className="text-xl font-bold">Page Not Found (404)</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            The study resource or workspace route you requested does not exist.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/">
              <Button variant="outline" size="sm">
                Home
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm">Student Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
