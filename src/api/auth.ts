import http, { API_BASE_URL } from './http';

import type { LoginResponse, MeResponse } from './types';

/** Pass companySlug only when you know the user's company; omit for username-only login (looks up across all companies). */
export async function login(username: string, password: string, companySlug?: string): Promise<LoginResponse> {
  const body = companySlug ? { companySlug, username, password } : { username, password };
  const res = await http.post<LoginResponse>('/api/auth/login', body);
  return res.data;
}

export async function me(): Promise<MeResponse> {
  const res = await http.get<MeResponse>('/api/auth/me');
  const logoUrl = res.data.companyLogoUrl;
  const profileImageUrl = res.data.profileImageUrl;

  const toAbsolute = (url?: string | null): string | null | undefined => {
    if (!url) return url;
    if (/^[a-zA-Z]:\\/.test(url)) return null;
    if (url.startsWith('file:')) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
    if (url.startsWith('uploads/')) return `${API_BASE_URL}/${url}`;
    return url;
  };
  return {
    ...res.data,
    companyLogoUrl: toAbsolute(logoUrl),
    profileImageUrl: toAbsolute(profileImageUrl),
  };
}
