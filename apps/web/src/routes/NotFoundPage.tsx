import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 404;

  return (
    <div className="flex min-h-full items-center justify-center bg-surface px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{status === 404 ? 'Page not found' : 'Something went wrong'}</CardTitle>
          <CardDescription>
            {status === 404
              ? "The page you're looking for doesn't exist or you don't have access."
              : 'An unexpected error occurred.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function GenericPageHeader() {
  return <PageHeader title="Page" />;
}
