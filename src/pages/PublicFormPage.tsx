import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { getPublicForm, submitLoginRequiredForm, submitPublicForm, type FormDto, type FormFieldDto } from '../api/forms';
import { useToast } from '../hooks/useToast';

function parseOptions(optionsJson?: string | null): { label: string; value: string }[] {
  if (!optionsJson) return [];
  try {
    const raw = JSON.parse(optionsJson);
    if (Array.isArray(raw)) {
      return raw
        .map((x) => {
          if (typeof x === 'string') return { label: x, value: x };
          if (x && typeof x === 'object') {
            const label = String((x as any).label ?? (x as any).value ?? '');
            const value = String((x as any).value ?? (x as any).label ?? '');
            return { label, value };
          }
          return null;
        })
        .filter(Boolean) as any;
    }
  } catch {
    // ignore
  }
  return [];
}

function getErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}

export default function PublicFormPage() {
  const { token } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [values, setValues] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});

  const fields = useMemo(() => (form?.fields || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), [form]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getPublicForm(token);
        if (!mounted) return;
        setForm(data);
      } catch (e: unknown) {
        if (!mounted) return;
        setError(getErrorMessage(e, 'Failed to load form'));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  async function submit() {
    if (!form || !token) return;

    const requiredMissing = fields
      .filter((f) => f.required)
      .some((f) => {
        if (f.type === 'FILE') {
          return !(files[f.key]?.length);
        }
        const v = values[f.key];
        if (f.type === 'CHECKBOX') return v !== true;
        return v == null || String(v).trim() === '';
      });

    if (requiredMissing) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (form.loginRequired) {
        if (!user) {
          showToast('Please login to submit this form', 'error');
          navigate('/login');
          return;
        }
        await submitLoginRequiredForm(form.id, values, files);
      } else {
        await submitPublicForm(token, values, files);
      }

      showToast('Submitted successfully', 'success');
      setValues({});
      setFiles({});
    } catch (e: unknown) {
      showToast(getErrorMessage(e, 'Submit failed'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-xl border bg-white p-6">
          <div className="text-lg font-semibold text-slate-900">Form unavailable</div>
          <div className="mt-2 text-sm text-slate-600">{error || 'This form does not exist or is not active.'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {toast ? <Toast message={toast.message} type={toast.type} onClose={hideToast} /> : null}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex items-start gap-4">
              {form.companyLogoUrl ? (
                <img src={form.companyLogoUrl} alt="Company logo" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600" />
              )}
              <div className="flex-1">
                <div className="text-2xl font-bold text-slate-900">{form.title}</div>
                {form.description ? <div className="mt-1 text-sm text-slate-600">{form.description}</div> : null}
                {form.loginRequired ? (
                  <div className="mt-2 text-xs text-slate-500">Login required to submit</div>
                ) : (
                  <div className="mt-2 text-xs text-slate-500">Public form</div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {fields.length === 0 ? (
              <div className="text-sm text-slate-600">This form has no fields yet.</div>
            ) : (
              fields.map((f: FormFieldDto) => {
                const options = f.type === 'RADIO' ? parseOptions(f.optionsJson) : [];

                return (
                  <div key={f.key} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-800">{f.label}</label>
                      {f.required ? <span className="text-xs text-red-600">Required</span> : null}
                    </div>
                    {f.description ? <div className="text-xs text-slate-500">{f.description}</div> : null}

                    {f.type === 'TEXT' ? (
                      <input
                        value={values[f.key] ?? ''}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      />
                    ) : null}

                    {f.type === 'TEXTAREA' ? (
                      <textarea
                        value={values[f.key] ?? ''}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm min-h-[96px]"
                      />
                    ) : null}

                    {f.type === 'DATE' ? (
                      <input
                        type="date"
                        value={values[f.key] ?? ''}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      />
                    ) : null}

                    {f.type === 'CHECKBOX' ? (
                      <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={values[f.key] === true}
                          onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.checked }))}
                          className="h-4 w-4"
                        />
                        <span>{f.label}</span>
                      </label>
                    ) : null}

                    {f.type === 'RADIO' ? (
                      <div className="mt-2 grid gap-2">
                        {options.map((o) => (
                          <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="radio"
                              name={f.key}
                              checked={values[f.key] === o.value}
                              onChange={() => setValues((p) => ({ ...p, [f.key]: o.value }))}
                              className="h-4 w-4"
                            />
                            <span>{o.label}</span>
                          </label>
                        ))}
                        {options.length === 0 ? <div className="text-sm text-slate-500">No options configured.</div> : null}
                      </div>
                    ) : null}

                    {f.type === 'FILE' ? (
                      <div className="mt-1">
                        <input
                          type="file"
                          multiple
                          accept={f.accept || undefined}
                          onChange={(e) => {
                            const list = e.target.files ? Array.from(e.target.files) : [];
                            setFiles((p) => ({ ...p, [f.key]: list }));
                          }}
                          className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                        />
                        {(files[f.key]?.length || 0) > 0 ? (
                          <div className="mt-2 text-xs text-slate-600">
                            {(files[f.key] || []).map((x) => x.name).join(', ')}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={submit}
                disabled={submitting || fields.length === 0}
                className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500 text-center">
          Powered by Attendance System
        </div>
      </div>
    </div>
  );
}
