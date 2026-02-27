import http, { API_BASE_URL } from './http';

export type SystemLogoResponse = {
  logoUrl: string | null;
};

export type SystemBrandingResponse = {
  logoUrl: string | null;
  systemName: string | null;
};

export type UpdateSystemBrandingRequest = {
  systemName?: string | null;
};

function normalizeLogoUrl<T extends { logoUrl: string | null }>(data: T): T {
  const logoUrl = data.logoUrl;
  if (!logoUrl) return data;
  if (/^[a-zA-Z]:\\/.test(logoUrl)) return { ...data, logoUrl: null };
  if (logoUrl.startsWith('file:')) return { ...data, logoUrl: null };
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) return data;
  if (logoUrl.startsWith('/')) return { ...data, logoUrl: `${API_BASE_URL}${logoUrl}` };
  if (logoUrl.startsWith('uploads/')) return { ...data, logoUrl: `${API_BASE_URL}/${logoUrl}` };
  return data;
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
  return normalizeLogoUrl(res.data);
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
