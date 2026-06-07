import http, { API_BASE_URL } from './http';

import type { CreateUserRequest, UpdateUserRequest, UserResponse } from './types';

export async function listUsers(): Promise<UserResponse[]> {
  const res = await http.get<UserResponse[]>('/api/users');
  return res.data;
}

export async function createUser(payload: CreateUserRequest): Promise<UserResponse> {
  const res = await http.post<UserResponse>('/api/users', payload);
  return res.data;
}

export async function updateUser(id: number, payload: UpdateUserRequest): Promise<UserResponse> {
  const res = await http.patch<UserResponse>(`/api/users/${id}`, payload);
  return res.data;
}

export async function deleteUser(id: number): Promise<void> {
  await http.delete(`/api/users/${id}`);
}

export async function updateMyProfileImage(imageFile: File): Promise<{ message: string; profileImageUrl: string | null }> {
  const form = new FormData();
  form.append('image', imageFile);
  const res = await http.post('/api/users/me/profile/image', form);
  return res.data;
}

export async function deleteMyProfileImage(): Promise<{ message: string }> {
  const res = await http.delete('/api/users/me/profile/image');
  return res.data;
}

export function userProfileImageUrl(userId: number): string {
  return `${API_BASE_URL}/api/users/${userId}/profile/image`;
}
