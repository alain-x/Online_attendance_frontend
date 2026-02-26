import http from './http';

import type { MessageResponse } from './types';

/** descriptorJson: optional AI face descriptor (128 floats) for recognition. */
export async function enrollFace(descriptorJson?: string, imageFile?: File): Promise<MessageResponse> {
  const form = new FormData();
  if (imageFile) form.append('image', imageFile);
  if (descriptorJson) form.append('descriptor', descriptorJson);
  const res = await http.post<MessageResponse>('/api/face/enroll', form);
  return res.data;
}

/** Enroll face for an employee (admin/recorder flow). */
export async function enrollFaceForEmployee(employeeId: number, descriptorJson?: string, imageFile?: File): Promise<MessageResponse> {
  const form = new FormData();
  if (imageFile) form.append('image', imageFile);
  if (descriptorJson) form.append('descriptor', descriptorJson);
  const res = await http.post<MessageResponse>(`/api/face/enroll/${employeeId}`, form);
  return res.data;
}
