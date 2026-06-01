import http, { API_BASE_URL } from './http';

import type { CreateEmployeeRequest, EmployeeResponse, UpdateEmployeeRequest } from './types';

export type UpdateMyProfileRequest = {
  mobile?: string | null;
  department?: string | null;
  designation?: string | null;
  category?: string | null;
};

function normalizeEmployee(e: EmployeeResponse): EmployeeResponse {
  let profileImageUrl = e.profileImageUrl;
  if (profileImageUrl && (profileImageUrl.startsWith('/uploads/') || profileImageUrl.startsWith('uploads/'))) {
    profileImageUrl = `/api/employees/${e.id}/profile/image`;
  }
  if (profileImageUrl && profileImageUrl.startsWith('/')) {
    return { ...e, profileImageUrl: `${API_BASE_URL}${profileImageUrl}` };
  }
  return e;
}

export function profileImageDownloadUrl(employeeId: number): string {
  return `${API_BASE_URL}/api/employees/${employeeId}/profile/image?download=true`;
}

export async function getMyProfile(): Promise<EmployeeResponse> {
  const res = await http.get<EmployeeResponse>('/api/employees/me');
  return normalizeEmployee(res.data);
}

export async function updateMyProfile(payload: UpdateMyProfileRequest): Promise<EmployeeResponse> {
  const res = await http.put<EmployeeResponse>('/api/employees/me', payload);
  return normalizeEmployee(res.data);
}

export async function listEmployees(): Promise<EmployeeResponse[]> {
  const res = await http.get<EmployeeResponse[]>('/api/employees');
  return res.data.map(normalizeEmployee);
}

export async function createEmployee(payload: CreateEmployeeRequest, companyId?: number | null): Promise<EmployeeResponse> {
  const res = await http.post<EmployeeResponse>('/api/employees', payload, {
    headers: companyId ? { 'X-Company-Id': String(companyId) } : undefined,
  });
  return normalizeEmployee(res.data);
}

export async function updateEmployee(id: number, payload: UpdateEmployeeRequest): Promise<EmployeeResponse> {
  const res = await http.put<EmployeeResponse>(`/api/employees/${id}`, payload);
  return normalizeEmployee(res.data);
}

export async function deleteEmployee(id: number): Promise<void> {
  await http.delete(`/api/employees/${id}`);
}
