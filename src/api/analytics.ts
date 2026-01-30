import http from './http';

import type { HomeAnalyticsResponse } from './types';

export async function getHomeAnalytics(year?: number, month?: number): Promise<HomeAnalyticsResponse> {
  const params: { year?: number; month?: number } = {};
  if (year != null) params.year = year;
  if (month != null) params.month = month;
  const res = await http.get<HomeAnalyticsResponse>('/api/analytics/home', { params });
  return res.data;
}
