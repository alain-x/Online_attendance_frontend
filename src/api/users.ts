import http from './http';

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
