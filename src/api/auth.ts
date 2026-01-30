import http from './http';

import type { LoginResponse, MeResponse } from './types';

export async function login(companySlug: string, username: string, password: string): Promise<LoginResponse> {
  const res = await http.post<LoginResponse>('/api/auth/login', { companySlug, username, password });
  return res.data;
}

export async function me(): Promise<MeResponse> {
  const res = await http.get<MeResponse>('/api/auth/me');
  return res.data;
}
