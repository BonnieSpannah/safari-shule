import type { PaginationQuery, PaginatedResult } from '@safari-shule/shared-types';

export function buildPagination(q: PaginationQuery) {
  return {
    skip: (q.page - 1) * q.pageSize,
    take: q.pageSize,
    orderBy: q.sort ? buildOrder(q.sort) : undefined,
  };
}

export function buildOrder(sort: string): Record<string, 'asc' | 'desc'> {
  const [field, dir] = sort.split(':');
  return { [field!]: (dir as 'asc' | 'desc') ?? 'asc' };
}

export function pageMeta(total: number, q: PaginationQuery) {
  return { page: q.page, pageSize: q.pageSize, total, pageCount: Math.ceil(total / q.pageSize) };
}

export function paginated<T>(data: T[], total: number, q: PaginationQuery): PaginatedResult<T> {
  return { data, meta: pageMeta(total, q) };
}
