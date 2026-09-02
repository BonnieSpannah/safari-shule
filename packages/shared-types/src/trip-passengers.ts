import { z } from 'zod';

export const tripPassengerLookupInput = z.object({
  admissionNumber: z.string().min(1).max(50),
});
export type TripPassengerLookupInput = z.infer<typeof tripPassengerLookupInput>;
