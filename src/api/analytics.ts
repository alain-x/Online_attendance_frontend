import http from './http';

import type { DayAttendanceResponse, HomeAnalyticsResponse, TimesheetResponse } from './types';

export async function getHomeAnalytics(year?: number, month?: number): Promise<HomeAnalyticsResponse> {
  const params: { year?: number; month?: number } = {};
  if (year != null) params.year = year;
  if (month != null) params.month = month;
  const res = await http.get<HomeAnalyticsResponse>('/api/analytics/home', { params });
  return res.data;
}

export async function getDayAnalytics(params: {
  date?: string;
  department?: string;
  roleScope?: string;
  search?: string;
}): Promise<DayAttendanceResponse> {
  const res = await http.get<DayAttendanceResponse>('/api/analytics/day', { params });
  return res.data;
}

export async function getTimesheet(params: {
  year: number;
  month: number;
  department?: string;
  roleScope?: string;
  search?: string;
}): Promise<TimesheetResponse> {
  const res = await http.get<TimesheetResponse>('/api/analytics/timesheet', { params });
  return res.data;
}
