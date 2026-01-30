import http from './http';

import type { CreateWorkLocationRequest, UpdateWorkLocationRequest, WorkLocation } from './types';

export async function listLocations(): Promise<WorkLocation[]> {
  const res = await http.get<WorkLocation[]>('/api/locations');
  return res.data;
}

export async function listActiveLocations(): Promise<WorkLocation[]> {
  const res = await http.get<WorkLocation[]>('/api/locations/active');
  return res.data;
}

export async function createLocation(payload: CreateWorkLocationRequest): Promise<WorkLocation> {
  const res = await http.post<WorkLocation>('/api/locations', payload);
  return res.data;
}

export async function updateLocation(id: number, payload: UpdateWorkLocationRequest): Promise<WorkLocation> {
  const res = await http.put<WorkLocation>(`/api/locations/${id}`, payload);
  return res.data;
}

export async function deleteLocation(id: number): Promise<void> {
  await http.delete(`/api/locations/${id}`);
}
