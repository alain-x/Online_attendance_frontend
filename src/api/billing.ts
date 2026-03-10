import http from './http';

export type PesapalEnvironment = 'SANDBOX' | 'LIVE';

export type PesapalSettingsResponse = {
  enabled: boolean;
  environment: PesapalEnvironment;
  consumerKey: string | null;
  consumerSecretMasked: string | null;
  ipnId: string | null;
  ipnUrl: string | null;
  callbackUrl: string | null;
  updatedAt: string | null;
};

export type UpdatePesapalSettingsRequest = {
  enabled: boolean;
  environment: PesapalEnvironment;
  consumerKey?: string;
  consumerSecret?: string;
  ipnUrl?: string;
  callbackUrl?: string;
};

export type SubscriptionPlan = {
  id: number;
  name: string;
  price: number;
  durationMonths: number;
  currency: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type UpsertSubscriptionPlanRequest = {
  name: string;
  price: number;
  durationMonths: number;
  active: boolean;
};

export async function getAdminPesapalSettings(): Promise<PesapalSettingsResponse> {
  const res = await http.get<PesapalSettingsResponse>('/api/system-admin/billing/pesapal');
  return res.data;
}

export async function updateAdminPesapalSettings(payload: UpdatePesapalSettingsRequest): Promise<PesapalSettingsResponse> {
  const res = await http.put<PesapalSettingsResponse>('/api/system-admin/billing/pesapal', payload);
  return res.data;
}

export async function listAdminPlans(): Promise<SubscriptionPlan[]> {
  const res = await http.get<SubscriptionPlan[]>('/api/system-admin/billing/plans');
  return res.data;
}

export async function createAdminPlan(payload: UpsertSubscriptionPlanRequest): Promise<SubscriptionPlan> {
  const res = await http.post<SubscriptionPlan>('/api/system-admin/billing/plans', payload);
  return res.data;
}

export async function updateAdminPlan(id: number, payload: UpsertSubscriptionPlanRequest): Promise<SubscriptionPlan> {
  const res = await http.put<SubscriptionPlan>(`/api/system-admin/billing/plans/${id}`, payload);
  return res.data;
}

export async function deleteAdminPlan(id: number): Promise<void> {
  await http.delete(`/api/system-admin/billing/plans/${id}`);
}
