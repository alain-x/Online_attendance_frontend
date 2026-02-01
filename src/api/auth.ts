import http from './http';

import type { LoginResponse, MeResponse } from './types';

/** Pass companySlug only when you know the user's company; omit for username-only login (looks up across all companies). */
export async function login(username: string, password: string, companySlug?: string): Promise<LoginResponse> {
  const body = companySlug ? { companySlug, username, password } : { username, password };
  const res = await http.post<LoginResponse>('/api/auth/login', body);
  return res.data;
}

export async function me(): Promise<MeResponse> {
  const res = await http.get<MeResponse>('/api/auth/me');
  return res.data;
}
