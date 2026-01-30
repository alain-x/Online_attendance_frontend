import http from './http';

import type { MessageResponse } from './types';

export async function enrollFace(imageFile: File): Promise<MessageResponse> {
  const form = new FormData();
  form.append('image', imageFile);
  const res = await http.post<MessageResponse>('/api/face/enroll', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
