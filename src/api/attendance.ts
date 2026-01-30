import http from './http';

import type {
  AdminUpsertAttendanceRequest,
  AttendanceResponse,
  CheckInRequest,
  CheckOutRequest,
  MessageResponse,
  VerifyFaceResponse,
} from './types';

export async function checkIn(latitude: number, longitude: number): Promise<AttendanceResponse> {
  const payload: CheckInRequest = { latitude, longitude };
  const res = await http.post<AttendanceResponse>('/api/attendance/check-in', payload);
  return res.data;
}

export async function checkOut(latitude: number, longitude: number): Promise<AttendanceResponse> {
  const payload: CheckOutRequest = { latitude, longitude };
  const res = await http.post<AttendanceResponse>('/api/attendance/check-out', payload);
  return res.data;
}

export async function myAttendance(): Promise<AttendanceResponse[]> {
  const res = await http.get<AttendanceResponse[]>('/api/attendance/my');
  return res.data;
}

export async function todayAttendance(): Promise<AttendanceResponse[]> {
  const res = await http.get<AttendanceResponse[]>('/api/attendance');
  return res.data;
}

export async function listAttendanceByEmployee(employeeId: number): Promise<AttendanceResponse[]> {
  const res = await http.get<AttendanceResponse[]>(`/api/attendance/employee/${employeeId}`);
  return res.data;
}

export async function adminCreateAttendance(payload: AdminUpsertAttendanceRequest): Promise<AttendanceResponse> {
  const res = await http.post<AttendanceResponse>('/api/attendance/admin', payload);
  return res.data;
}

export async function adminUpdateAttendance(id: number, payload: AdminUpsertAttendanceRequest): Promise<AttendanceResponse> {
  const res = await http.patch<AttendanceResponse>(`/api/attendance/admin/${id}`, payload);
  return res.data;
}

export async function adminDeleteAttendance(id: number): Promise<{ deleted: boolean } & Record<string, unknown>> {
  const res = await http.delete<{ deleted: boolean } & Record<string, unknown>>(`/api/attendance/admin/${id}`);
  return res.data;
}

export async function startBreak(): Promise<MessageResponse> {
  const res = await http.post<MessageResponse>('/api/attendance/break/start');
  return res.data;
}

export async function endBreak(): Promise<MessageResponse> {
  const res = await http.post<MessageResponse>('/api/attendance/break/end');
  return res.data;
}

export async function verifyFace(imageFile: File): Promise<VerifyFaceResponse> {
  const form = new FormData();
  form.append('image', imageFile);
  const res = await http.post<VerifyFaceResponse>('/api/attendance/face/verify', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

