import http from './http';

export type Holiday = {
  id: number;
  date: string; // yyyy-MM-dd
  name: string;
};

export type CreateHolidayRequest = {
  date: string;
  name: string;
};

export type UpdateHolidayRequest = {
  date: string;
  name: string;
};

export async function listHolidays(params?: { from?: string; to?: string }): Promise<Holiday[]> {
  const res = await http.get<Holiday[]>('/api/holidays', { params });
  return res.data;
}

export async function createHoliday(payload: CreateHolidayRequest): Promise<Holiday> {
  const res = await http.post<Holiday>('/api/holidays', payload);
  return res.data;
}

export async function updateHoliday(id: number, payload: UpdateHolidayRequest): Promise<Holiday> {
  const res = await http.put<Holiday>(`/api/holidays/${id}`, payload);
  return res.data;
}

export async function deleteHoliday(id: number): Promise<void> {
  await http.delete(`/api/holidays/${id}`);
}
