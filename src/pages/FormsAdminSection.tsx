import React, { useEffect, useMemo, useState } from 'react';
import {
  createForm,
  deleteForm,
  getForm,
  listForms,
  rotateFormToken,
  updateForm,
  type FieldType,
  type FileStorageMode,
  type FormDto,
  type FormFieldDto,
  type UpsertFormRequest,
} from '../api/forms';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

function getApiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}

function makeKey(label: string) {
  const base = (label || 'field').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const suffix = Math.random().toString(16).slice(2, 6);
  return (base || 'field') + '_' + suffix;
}

const fieldTypeOptions: { label: string; value: FieldType }[] = [
  { label: 'Text', value: 'TEXT' },
  { label: 'Text Area', value: 'TEXTAREA' },
  { label: 'Checkbox', value: 'CHECKBOX' },
  { label: 'Radio', value: 'RADIO' },
  { label: 'Select', value: 'SELECT' },
  { label: 'Date', value: 'DATE' },
  { label: 'File Upload', value: 'FILE' },
];

export default function FormsAdminSection() {
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forms, setForms] = useState<FormDto[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [selectedForm, setSelectedForm] = useState<FormDto | null>(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftCompanyLogoUrl, setDraftCompanyLogoUrl] = useState('');
  const [draftLoginRequired, setDraftLoginRequired] = useState(true);
  const [draftPublicEnabled, setDraftPublicEnabled] = useState(true);
  const [draftActive, setDraftActive] = useState(true);
  const [draftFileStorageMode, setDraftFileStorageMode] = useState<FileStorageMode>('DISK');
  const [draftFields, setDraftFields] = useState<FormFieldDto[]>([]);

  const shareUrl = useMemo(() => {
    const token = selectedForm?.publicToken;
    if (!token) return '';
    const origin = window.location.origin;
    return `${origin}/forms/${token}`;
  }, [selectedForm?.publicToken]);

  async function refreshList() {
    setLoading(true);
    setError(null);
    try {
      const data = await listForms();
      setForms(data);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Failed to load forms'));
    } finally {
      setLoading(false);
    }
  }

  async function loadForm(id: number) {
    setBusy(true);
    try {
      const data = await getForm(id);
      setSelectedFormId(id);
      setSelectedForm(data);

      setDraftTitle(data.title || '');
      setDraftDescription(data.description || '');
      setDraftCompanyLogoUrl(data.companyLogoUrl || '');
      setDraftLoginRequired(!!data.loginRequired);
      setDraftPublicEnabled(!!data.publicEnabled);
      setDraftActive(!!data.active);
      setDraftFileStorageMode(data.fileStorageMode || 'DISK');
      setDraftFields((data.fields || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to load form'), 'error');
    } finally {
      setBusy(false);
    }
  }

  function resetDraft() {
    setSelectedFormId(null);
    setSelectedForm(null);

    setDraftTitle('');
    setDraftDescription('');
    setDraftCompanyLogoUrl('');
    setDraftLoginRequired(true);
    setDraftPublicEnabled(true);
    setDraftActive(true);
    setDraftFileStorageMode('DISK');
    setDraftFields([]);
  }

  useEffect(() => {
    refreshList();
  }, []);

  async function createNew() {
    setBusy(true);
    try {
      const body: UpsertFormRequest = {
        title: 'New Form',
        description: '',
        companyLogoUrl: '',
        loginRequired: true,
        publicEnabled: true,
        active: true,
        fileStorageMode: 'DISK',
        fields: [],
      };
      const created = await createForm(body);
      showToast('Form created', 'success');
      await refreshList();
      await loadForm(created.id);
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Create failed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draftTitle.trim()) {
      showToast('Title is required', 'error');
      return;
    }

    const normalizedFields = draftFields
      .map((f, idx) => ({
        ...f,
        key: (f.key || '').trim(),
        label: (f.label || '').trim(),
        sortOrder: typeof f.sortOrder === 'number' ? f.sortOrder : idx,
        required: !!f.required,
      }))
      .filter((f) => !!f.key && !!f.label);

    const body: UpsertFormRequest = {
      title: draftTitle.trim(),
      description: draftDescription.trim() || null,
      companyLogoUrl: draftCompanyLogoUrl.trim() || null,
      loginRequired: !!draftLoginRequired,
      publicEnabled: !!draftPublicEnabled,
      active: !!draftActive,
      fileStorageMode: draftFileStorageMode,
      fields: normalizedFields,
    };

    setBusy(true);
    try {
      if (selectedFormId == null) {
        const created = await createForm(body);
        showToast('Saved', 'success');
        await refreshList();
        await loadForm(created.id);
      } else {
        const updated = await updateForm(selectedFormId, body);
        showToast('Saved', 'success');
        await refreshList();
        await loadForm(updated.id);
      }
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Save failed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (selectedFormId == null) return;
    const yes = window.confirm('Delete this form?');
    if (!yes) return;

    setBusy(true);
    try {
      await deleteForm(selectedFormId);
      showToast('Deleted', 'success');
      resetDraft();
      await refreshList();
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Delete failed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function rotateToken() {
    if (selectedFormId == null) return;
    setBusy(true);
    try {
      await rotateFormToken(selectedFormId);
      showToast('Share link updated', 'success');
      await loadForm(selectedFormId);
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Rotate token failed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  function addField(type: FieldType) {
    const label = type === 'FILE' ? 'Upload document' : 'New field';
    const key = makeKey(label);

    let optionsJson: string | null | undefined = undefined;
    if (type === 'RADIO' || type === 'SELECT') {
      optionsJson = JSON.stringify(['Option 1', 'Option 2']);
    }

    setDraftFields((p) => [
      ...p,
      {
        key,
        label,
        description: '',
        placeholder: '',
        type,
        required: false,
        sortOrder: p.length,
        optionsJson,
        accept: type === 'FILE' ? '*/*' : null,
      },
    ]);
  }

  function updateField(index: number, patch: Partial<FormFieldDto>) {
    setDraftFields((p) => {
      const next = p.slice();
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function removeField(index: number) {
    setDraftFields((p) => p.filter((_, i) => i !== index).map((x, i) => ({ ...x, sortOrder: i })));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mt-6">
      {toast ? <Toast message={toast.message} type={toast.type} onClose={hideToast} /> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-900">Forms</div>
          <div className="mt-1 text-sm text-slate-600">Build shareable forms and store submissions in the database.</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={createNew}
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
          >
            New form
          </button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">All forms</div>
            <button type="button" onClick={refreshList} disabled={busy} className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60">
              Refresh
            </button>
          </div>

          <div className="divide-y">
            {forms.map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => loadForm(f.id)}
                className={
                  selectedFormId === f.id
                    ? 'w-full text-left px-4 py-3 bg-blue-50'
                    : 'w-full text-left px-4 py-3 hover:bg-slate-50'
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{f.title}</div>
                    <div className="text-xs text-slate-500 truncate">{f.loginRequired ? 'Login required' : 'Public'} · {f.active ? 'Active' : 'Inactive'}</div>
                  </div>
                  <div className="text-xs text-slate-400">#{f.id}</div>
                </div>
              </button>
            ))}

            {forms.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-600">No forms yet. Click “New form”.</div>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-8 rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">{selectedFormId ? `Edit form #${selectedFormId}` : 'Create form'}</div>
            <div className="flex items-center gap-2">
              {selectedFormId ? (
                <button type="button" onClick={remove} disabled={busy} className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60">
                  Delete
                </button>
              ) : null}
              <button type="button" onClick={save} disabled={busy} className="rounded-md bg-slate-900 px-4 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-60">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-medium text-slate-700">Title</div>
                <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-700">Company logo URL (optional)</div>
                <input value={draftCompanyLogoUrl} onChange={(e) => setDraftCompanyLogoUrl(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-700">Description (optional)</div>
              <textarea value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm min-h-[84px]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={draftActive} onChange={(e) => setDraftActive(e.target.checked)} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={draftPublicEnabled} onChange={(e) => setDraftPublicEnabled(e.target.checked)} />
                Public link enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={draftLoginRequired} onChange={(e) => setDraftLoginRequired(e.target.checked)} />
                Login required
              </label>
              <div>
                <div className="text-xs font-medium text-slate-700">File storage</div>
                <select value={draftFileStorageMode} onChange={(e) => setDraftFileStorageMode(e.target.value as FileStorageMode)} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
                  <option value="DISK">Server disk</option>
                  <option value="DB">Database</option>
                </select>
              </div>
            </div>

            {selectedForm ? (
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Share link</div>
                    <div className="text-xs text-slate-600 break-all">{shareUrl || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!shareUrl}
                      className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
                      onClick={() => {
                        if (!shareUrl) return;
                        navigator.clipboard.writeText(shareUrl);
                        showToast('Copied', 'success');
                      }}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
                      onClick={rotateToken}
                    >
                      Rotate
                    </button>
                    <a
                      href={shareUrl || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={shareUrl ? 'rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800' : 'rounded-md bg-slate-200 px-3 py-1.5 text-sm text-slate-500 pointer-events-none'}
                    >
                      Open
                    </a>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border bg-white">
              <div className="px-4 py-3 border-b flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Fields</div>
                  <div className="text-xs text-slate-500">Add inputs, checkboxes, radio buttons, dates, and file uploads.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {fieldTypeOptions.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => addField(o.value)}
                      disabled={busy}
                      className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      + {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y">
                {draftFields.map((f, idx) => (
                  <div key={f.key} className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      <div className="sm:col-span-4">
                        <div className="text-xs font-medium text-slate-700">Label</div>
                        <input
                          value={f.label || ''}
                          onChange={(e) => updateField(idx, { label: e.target.value })}
                          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <div className="text-xs font-medium text-slate-700">Key</div>
                        <input
                          value={f.key || ''}
                          onChange={(e) => updateField(idx, { key: e.target.value })}
                          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <div className="text-xs font-medium text-slate-700">Type</div>
                        <select
                          value={f.type}
                          onChange={(e) => updateField(idx, { type: e.target.value as FieldType })}
                          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        >
                          {fieldTypeOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2 mt-6">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!f.required}
                            onChange={(e) => updateField(idx, { required: e.target.checked })}
                          />
                          Required
                        </label>
                        <button
                          type="button"
                          onClick={() => removeField(idx)}
                          className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-medium text-slate-700">Help text (optional)</div>
                        <input
                          value={f.description || ''}
                          onChange={(e) => updateField(idx, { description: e.target.value })}
                          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      {f.type === 'TEXT' || f.type === 'TEXTAREA' || f.type === 'DATE' || f.type === 'SELECT' ? (
                        <div>
                          <div className="text-xs font-medium text-slate-700">Placeholder (optional)</div>
                          <input
                            value={(f as any).placeholder || ''}
                            onChange={(e) => updateField(idx, { placeholder: e.target.value } as any)}
                            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                            placeholder={f.type === 'DATE' ? 'YYYY-MM-DD' : 'Enter a hint…'}
                          />
                        </div>
                      ) : null}

                      {f.type === 'RADIO' || f.type === 'SELECT' ? (
                        <div>
                          <div className="text-xs font-medium text-slate-700">Options JSON</div>
                          <input
                            value={f.optionsJson || ''}
                            onChange={(e) => updateField(idx, { optionsJson: e.target.value })}
                            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                            placeholder='Example: ["Yes","No"]'
                          />
                        </div>
                      ) : null}

                      {f.type === 'FILE' ? (
                        <div>
                          <div className="text-xs font-medium text-slate-700">Accept (optional)</div>
                          <input
                            value={f.accept || ''}
                            onChange={(e) => updateField(idx, { accept: e.target.value })}
                            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                            placeholder="*/*, .pdf, image/*"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}

                {draftFields.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-600">No fields yet. Use the buttons above to add fields.</div>
                ) : null}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button type="button" disabled={busy} onClick={resetDraft} className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
                Clear
              </button>
              <button type="button" disabled={busy} onClick={save} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60">
                {busy ? 'Saving…' : 'Save form'}
              </button>
            </div>

            {busy ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <LoadingSpinner />
                Working…
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
