import http, { API_BASE_URL } from './http';

import type {
  CreateEmployeeRequest,
  EmployeeResponse,
  UpdateEmployeeRequest,
  UpdateMyProfileRequest,
} from './types';

function normalizeEmployee(e: EmployeeResponse): EmployeeResponse {
  let profileImageUrl = e.profileImageUrl;
  if (profileImageUrl && (profileImageUrl.startsWith('/uploads/') || profileImageUrl.startsWith('uploads/'))) {
    profileImageUrl = `${API_BASE_URL}/api/employees/${e.id}/profile/image`;
  }
  if (profileImageUrl && profileImageUrl.startsWith('/')) {
    profileImageUrl = `${API_BASE_URL}${profileImageUrl}`;
  }
  const hasImage = Boolean(profileImageUrl && !profileImageUrl.includes('null') && !profileImageUrl.startsWith('data:'));
  return { ...e, profileImageUrl: profileImageUrl || (hasImage ? undefined : null), _profileImageAvailable: hasImage || !profileImageUrl };
}

export function profileImageDownloadUrl(employeeId: number): string {
  return `${API_BASE_URL}/api/employees/${employeeId}/profile/image?download=true`;
}

export function profileImageUrl(employeeId: number): string {
  return `${API_BASE_URL}/api/employees/${employeeId}/profile/image`;
}

export async function updateMyProfileImage(imageFile: File): Promise<{ message: string; profileImageUrl: string | null }> {
  const form = new FormData();
  form.append('image', imageFile);
  const res = await http.post('/api/employees/me/profile/image', form);
  return res.data;
}

export async function deleteMyProfileImage(): Promise<{ message: string }> {
  const res = await http.delete('/api/employees/me/profile/image');
  return res.data;
}

export async function getMyProfileImageUrl(): Promise<{ profileImageUrl: string | null }> {
  const res = await http.get('/api/employees/me/profile/image-url');
  return res.data;
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
