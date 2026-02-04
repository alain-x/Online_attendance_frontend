import http from './http';

import type {
  AdminUpsertAttendanceRequest,
  AttendanceResponse,
  BulkTimesheetImportRequest,
  BulkTimesheetImportResponse,
  MessageResponse,
  VerifyFaceResponse,
} from './types';

export async function checkIn(
  imageFile: File,
  latitude: number,
  longitude: number,
  descriptorJson?: string
): Promise<AttendanceResponse> {
  const form = new FormData();
  form.append('image', imageFile);
  form.append('latitude', String(latitude));
  form.append('longitude', String(longitude));
  if (descriptorJson) form.append('descriptor', descriptorJson);
  const res = await http.post<AttendanceResponse>('/api/attendance/check-in', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function checkOutCompanyPurpose(
  imageFile: File,
  latitude: number,
  longitude: number,
  note: string,
  descriptorJson?: string
): Promise<AttendanceResponse> {
  const form = new FormData();
  form.append('image', imageFile);
  form.append('latitude', String(latitude));
  form.append('longitude', String(longitude));
  form.append('note', note);
  if (descriptorJson) form.append('descriptor', descriptorJson);
  const res = await http.post<AttendanceResponse>('/api/attendance/check-out/company-purpose', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function listPendingCompanyPurpose(): Promise<AttendanceResponse[]> {
  const res = await http.get<AttendanceResponse[]>('/api/attendance/company-purpose/pending');
  return res.data;
}

export async function approveCompanyPurpose(attendanceId: number, note?: string): Promise<AttendanceResponse> {
  const res = await http.post<AttendanceResponse>(`/api/attendance/${attendanceId}/company-purpose/approve`, {
    note,
  });
  return res.data;
}

export async function rejectCompanyPurpose(attendanceId: number, note?: string): Promise<AttendanceResponse> {
  const res = await http.post<AttendanceResponse>(`/api/attendance/${attendanceId}/company-purpose/reject`, {
    note,
  });
  return res.data;
}

export async function checkOut(
  imageFile: File,
  latitude: number,
  longitude: number,
  descriptorJson?: string
): Promise<AttendanceResponse> {
  const form = new FormData();
  form.append('image', imageFile);
  form.append('latitude', String(latitude));
  form.append('longitude', String(longitude));
  if (descriptorJson) form.append('descriptor', descriptorJson);
  const res = await http.post<AttendanceResponse>('/api/attendance/check-out', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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

export async function adminBulkImportTimesheet(payload: BulkTimesheetImportRequest): Promise<BulkTimesheetImportResponse> {
  const res = await http.post<BulkTimesheetImportResponse>('/api/attendance/admin/bulk', payload);
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

/** descriptorJson: optional AI face descriptor for recognition. */
export async function verifyFace(imageFile: File, descriptorJson?: string): Promise<VerifyFaceResponse> {
  const form = new FormData();
  form.append('image', imageFile);
  if (descriptorJson) form.append('descriptor', descriptorJson);
  const res = await http.post<VerifyFaceResponse>('/api/attendance/face/verify', form);
  return res.data;
}

