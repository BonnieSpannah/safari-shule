import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PlaceholderPageProps {
  title: string;
  description: string;
  eta: string;
}

export function PlaceholderPage({ title, description, eta }: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <CardHeader>
          <CardTitle>Coming in the next release</CardTitle>
          <CardDescription>{eta}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border bg-surface-3 text-sm text-muted-foreground">
            This screen is scaffolded — the interactive experience ships in the next milestone.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
