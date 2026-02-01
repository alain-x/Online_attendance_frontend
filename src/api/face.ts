import http from './http';

import type { MessageResponse } from './types';

/** descriptorJson: optional AI face descriptor (128 floats) for recognition. */
export async function enrollFace(imageFile: File, descriptorJson?: string): Promise<MessageResponse> {
  const form = new FormData();
  form.append('image', imageFile);
  if (descriptorJson) form.append('descriptor', descriptorJson);
  const res = await http.post<MessageResponse>('/api/face/enroll', form);
  return res.data;
}
