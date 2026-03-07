import http from './http';

export type FieldType = 'TEXT' | 'TEXTAREA' | 'CHECKBOX' | 'RADIO' | 'DATE' | 'FILE';
export type FileStorageMode = 'DISK' | 'DB';

export type FormFieldDto = {
  id?: number;
  key: string;
  label: string;
  description?: string | null;
  type: FieldType;
  required: boolean;
  sortOrder: number;
  optionsJson?: string | null;
  accept?: string | null;
};

export type FormDto = {
  id: number;
  companyId: number;
  title: string;
  description?: string | null;
  companyLogoUrl?: string | null;
  loginRequired: boolean;
  publicEnabled: boolean;
  publicToken?: string | null;
  fileStorageMode: FileStorageMode;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  fields?: FormFieldDto[] | null;
};

export type UpsertFormRequest = {
  title: string;
  description?: string | null;
  companyLogoUrl?: string | null;
  loginRequired: boolean;
  publicEnabled: boolean;
  active: boolean;
  fileStorageMode: FileStorageMode;
  fields: FormFieldDto[];
};

export type SubmissionDto = {
  id: number;
  formId: number;
  companyId: number;
  submittedAt: string;
  submittedByUsername?: string | null;
  submittedByUserId?: number | null;
  answersJson: string;
};

export async function listForms(): Promise<FormDto[]> {
  const res = await http.get<FormDto[]>('/api/forms');
  return res.data;
}

export async function getForm(id: number): Promise<FormDto> {
  const res = await http.get<FormDto>(`/api/forms/${id}`);
  return res.data;
}

export async function createForm(body: UpsertFormRequest): Promise<FormDto> {
  const res = await http.post<FormDto>('/api/forms', body);
  return res.data;
}

export async function updateForm(id: number, body: UpsertFormRequest): Promise<FormDto> {
  const res = await http.put<FormDto>(`/api/forms/${id}`, body);
  return res.data;
}

export async function deleteForm(id: number): Promise<void> {
  await http.delete(`/api/forms/${id}`);
}

export async function rotateFormToken(id: number): Promise<{ publicToken: string } | { publicToken: null } | any> {
  const res = await http.post(`/api/forms/${id}/rotate-token`);
  return res.data;
}

export async function listFormSubmissions(formId: number): Promise<SubmissionDto[]> {
  const res = await http.get<SubmissionDto[]>(`/api/forms/${formId}/submissions`);
  return res.data;
}

export async function getPublicForm(token: string): Promise<FormDto> {
  const res = await http.get<FormDto>(`/api/public/forms/${token}`);
  return res.data;
}

export async function submitPublicForm(token: string, answers: Record<string, any>, files: Record<string, File[]>) {
  const fd = new FormData();
  fd.append('answersJson', JSON.stringify(answers || {}));
  Object.entries(files || {}).forEach(([k, list]) => {
    (list || []).forEach((f) => fd.append(k, f));
  });
  const res = await http.post(`/api/public/forms/${token}/submit`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function submitLoginRequiredForm(formId: number, answers: Record<string, any>, files: Record<string, File[]>) {
  const fd = new FormData();
  fd.append('answersJson', JSON.stringify(answers || {}));
  Object.entries(files || {}).forEach(([k, list]) => {
    (list || []).forEach((f) => fd.append(k, f));
  });
  const res = await http.post(`/api/forms/${formId}/submit`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
