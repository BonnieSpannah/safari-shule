import { api } from './client';

export interface DashboardStats {
  users: number;
  students: number;
  staff: number;
  vehicles: number;
  routes: number;
  tripsToday: number;
  incidentsOpen: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/v1/dashboard/stats');
  return data;
}
