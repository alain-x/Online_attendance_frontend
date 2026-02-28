import http, { API_BASE_URL } from './http';

export type SystemLogoResponse = {
  logoUrl: string | null;
};

export type SystemBrandingResponse = {
  logoUrl: string | null;
  faviconUrl: string | null;
  systemName: string | null;
};

export type SystemFaviconResponse = {
  faviconUrl: string | null;
};

export type UpdateSystemBrandingRequest = {
  systemName?: string | null;
};

function normalizeRelativeUrl(url: string | null): string | null {
  if (!url) return url;
  if (/^[a-zA-Z]:\\/.test(url)) return null;
  if (url.startsWith('file:')) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  if (url.startsWith('uploads/')) return `${API_BASE_URL}/${url}`;
  return url;
}

function normalizeLogoUrl<T extends { logoUrl: string | null }>(data: T): T {
  return { ...data, logoUrl: normalizeRelativeUrl(data.logoUrl) };
}

function normalizeFaviconUrl<T extends { faviconUrl: string | null }>(data: T): T {
  return { ...data, faviconUrl: normalizeRelativeUrl(data.faviconUrl) };
}

export async function getSystemLogo(): Promise<SystemLogoResponse> {
  const res = await http.get<SystemLogoResponse>('/api/system/logo');
  return normalizeLogoUrl(res.data);
}

export async function uploadSystemLogo(file: File): Promise<SystemLogoResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await http.post<SystemLogoResponse>('/api/system/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return normalizeLogoUrl(res.data);
}

export async function getSystemBranding(): Promise<SystemBrandingResponse> {
  const res = await http.get<SystemBrandingResponse>('/api/system/branding');
  return normalizeFaviconUrl(normalizeLogoUrl(res.data));
}

export async function getSystemFavicon(): Promise<SystemFaviconResponse> {
  const res = await http.get<SystemFaviconResponse>('/api/system/favicon');
  return normalizeFaviconUrl(res.data);
}

export async function uploadSystemFavicon(file: File): Promise<SystemFaviconResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await http.post<SystemFaviconResponse>('/api/system/favicon', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return normalizeFaviconUrl(res.data);
}

export async function updateSystemBranding(payload: UpdateSystemBrandingRequest): Promise<{ updated: boolean }> {
  const res = await http.put<{ updated: boolean }>('/api/system/branding', payload);
  return res.data;
}

export async function deleteSystemBranding(): Promise<{ deleted: boolean }> {
  const res = await http.delete<{ deleted: boolean }>('/api/system/branding');
  return res.data;
}

export async function deleteSystemLogo(): Promise<{ deleted: boolean }> {
  const res = await http.delete<{ deleted: boolean }>('/api/system/logo');
  return res.data;
}

export async function deleteSystemFavicon(): Promise<{ deleted: boolean }> {
  const res = await http.delete<{ deleted: boolean }>('/api/system/favicon');
  return res.data;
}
