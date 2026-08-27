import { api } from './client';

export interface RouteAssignment {
  id: string;
  studentId: string;
  routeId: string;
  busStopId: string;
  validFrom: string;
  validTo: string | null;
  student: { id: string; legalName: string; admissionNumber: string };
  busStop: { id: string; name: string };
}

export async function listRouteAssignments(routeId: string): Promise<RouteAssignment[]> {
  const { data } = await api.get<RouteAssignment[]>(`/v1/routes/${routeId}/assignments`);
  return data;
}

export async function assignStudentToRoute(input: {
  studentId: string;
  routeId: string;
  busStopId: string;
  relation?: string;
  isPrimary?: boolean;
  validFrom: string;
  validTo?: string | null;
}): Promise<RouteAssignment> {
  const { data } = await api.post<RouteAssignment>('/v1/student-route-assignments', {
    studentId: input.studentId,
    routeId: input.routeId,
    busStopId: input.busStopId,
    validFrom: input.validFrom,
    validTo: input.validTo ?? null,
  });
  return data;
}
