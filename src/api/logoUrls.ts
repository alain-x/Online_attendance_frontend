import { API_BASE_URL } from './http';

/** Build a browser-ready company logo URL using the current API host. */
export function companyLogoDisplayUrl(companyId: number, logoUrl?: string | null): string | null {
  if (!companyId) return null;
  const apiPath = `/api/companies/${companyId}/logo/image`;
  if (!logoUrl || !logoUrl.trim()) {
    return `${API_BASE_URL}${apiPath}`;
  }
  const trimmed = logoUrl.trim();
  if (/\/api\/companies\/\d+\/logo/.test(trimmed) || trimmed.includes('/uploads/')) {
    return `${API_BASE_URL}${apiPath}`;
  }
  if (trimmed.startsWith('/')) {
    return `${API_BASE_URL}${trimmed}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    const match = trimmed.match(/\/api\/companies\/(\d+)\/logo/);
    if (match) {
      return `${API_BASE_URL}/api/companies/${match[1]}/logo/image`;
    }
    return trimmed;
  }
  return trimmed;
}
