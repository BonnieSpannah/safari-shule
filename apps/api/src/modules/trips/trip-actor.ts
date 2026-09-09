import type { Prisma } from '@prisma/client';

// A trip's "actors" are the staff riding it: the assigned driver and assistant.
export function tripActorWhere(userId: string): Prisma.TripWhereInput {
  return { OR: [{ driverUserId: userId }, { assistantUserId: userId }] };
}
