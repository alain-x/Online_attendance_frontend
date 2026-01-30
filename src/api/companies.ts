import http from './http';

import type { RegisterCompanyRequest, RegisterCompanyResponse } from './types';

export async function registerCompany(payload: RegisterCompanyRequest): Promise<RegisterCompanyResponse> {
  const res = await http.post<RegisterCompanyResponse>('/api/companies/register', payload);
  return res.data;
}
