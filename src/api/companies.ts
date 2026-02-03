import http from './http';

import type {
  Company,
  CreateCompanyRequest,
  RegisterCompanyRequest,
  RegisterCompanyResponse,
  UpdateCompanyRequest,
} from './types';

export async function registerCompany(payload: RegisterCompanyRequest): Promise<RegisterCompanyResponse> {
  const res = await http.post<RegisterCompanyResponse>('/api/companies/register', payload);
  return res.data;
}

export async function listCompanies(): Promise<Company[]> {
  const res = await http.get<Company[]>('/api/companies');
  return res.data;
}

export async function createCompany(payload: CreateCompanyRequest): Promise<Company> {
  const res = await http.post<Company>('/api/companies', payload);
  return res.data;
}

export async function listBranches(companyId: number): Promise<Company[]> {
  const res = await http.get<Company[]>(`/api/companies/${companyId}/branches`);
  return res.data;
}

export async function getCompany(id: number): Promise<Company> {
  const res = await http.get<Company>(`/api/companies/${id}`);
  return res.data;
}

export async function updateCompany(id: number, payload: UpdateCompanyRequest): Promise<Company> {
  const res = await http.put<Company>(`/api/companies/${id}`, payload);
  return res.data;
}

export async function setCompanyActive(id: number, active: boolean): Promise<Company> {
  const res = await http.put<Company>(`/api/companies/${id}/active`, { active });
  return res.data;
}

export async function deleteCompany(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<{ deleted: boolean }>(`/api/companies/${id}`);
  return res.data;
}

export async function uploadCompanyLogo(id: number, file: File): Promise<Company> {
  const form = new FormData();
  form.append('file', file);
  const res = await http.post<Company>(`/api/companies/${id}/logo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
