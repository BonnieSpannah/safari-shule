import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({ page, pageSize, total, onPrev, onNext }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = to < total;

  return (
    <div className="flex items-center justify-between gap-4 pt-3 text-sm text-muted-foreground">
      <span>
        {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={!hasPrev} className="gap-1">
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext} className="gap-1">
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
