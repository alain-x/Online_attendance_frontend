import http from './http';

import type { CreateEmployeeRequest, EmployeeResponse, UpdateEmployeeRequest } from './types';

export async function listEmployees(): Promise<EmployeeResponse[]> {
  const res = await http.get<EmployeeResponse[]>('/api/employees');
  return res.data;
}

export async function createEmployee(payload: CreateEmployeeRequest): Promise<EmployeeResponse> {
  const res = await http.post<EmployeeResponse>('/api/employees', payload);
  return res.data;
}

export async function updateEmployee(id: number, payload: UpdateEmployeeRequest): Promise<EmployeeResponse> {
  const res = await http.put<EmployeeResponse>(`/api/employees/${id}`, payload);
  return res.data;
}

export async function deleteEmployee(id: number): Promise<void> {
  await http.delete(`/api/employees/${id}`);
}
