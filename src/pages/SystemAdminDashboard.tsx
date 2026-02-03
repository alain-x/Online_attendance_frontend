import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

import { listCompanies, setCompanyActive } from '../api/companies';

import type { Company } from '../api/types';

function getApiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

type InvoiceDraft = {
  kind: 'invoice' | 'receipt';
  companyId: number;
  companyName: string;
  companySlug: string;
  issueDate: string;
  dueDate: string;
  invoiceNumber: string;
  planName: string;
  amount: number;
  currency: string;
  note: string;
  status: 'UNPAID' | 'PAID';
};

function buildInvoiceNumber(companySlug: string): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `INV-${companySlug.toUpperCase()}-${ym}-${rnd}`;
}

function openPrintWindow(html: string, title: string) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  w.document.open();
  w.document.write(`<!doctype html><html><head><title>${title}</title><meta charset="utf-8" />
    <style>
      *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;}
      body{margin:0;padding:24px;background:#f8fafc;}
      .card{max-width:900px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px;}
      .row{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;}
      .muted{color:#64748b;font-size:12px;}
      .title{font-size:20px;font-weight:700;margin:0;}
      .h1{font-size:24px;font-weight:800;margin:0;}
      .badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;border:1px solid #e2e8f0;background:#f8fafc;}
      table{width:100%;border-collapse:collapse;margin-top:16px;}
      th,td{padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left;}
      th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;}
      .right{text-align:right;}
      .total{font-size:18px;font-weight:800;}
      .btnbar{margin-top:16px;display:flex;gap:8px;justify-content:flex-end;}
      button{padding:10px 14px;border-radius:10px;border:1px solid #e2e8f0;background:white;cursor:pointer;}
      button.primary{background:#0f172a;color:white;border-color:#0f172a;}
      @media print { body{background:white;padding:0;} .card{border:none;border-radius:0;max-width:none;} .btnbar{display:none;} }
    </style></head><body>
    <div class="card">${html}<div class="btnbar"><button onclick="window.print()" class="primary">Print / Save PDF</button><button onclick="window.close()">Close</button></div></div>
    </body></html>`);
  w.document.close();
}

function renderInvoiceHtml(d: InvoiceDraft): string {
  const kindLabel = d.kind === 'invoice' ? 'Invoice' : 'Receipt';
  const statusBadge = d.status === 'PAID' ? '<span class="badge">PAID</span>' : '<span class="badge">UNPAID</span>';
  const dueLine = d.kind === 'invoice' ? `<div class="muted">Due date</div><div><strong>${d.dueDate}</strong></div>` : '';

  return `
    <div class="row">
      <div>
        <p class="muted">Attendance System</p>
        <h1 class="h1">${kindLabel}</h1>
        <p class="muted">${statusBadge}</p>
      </div>
      <div style="min-width:260px">
        <div class="muted">${kindLabel} number</div>
        <div><strong>${d.invoiceNumber}</strong></div>
        <div style="height:10px"></div>
        <div class="muted">Issue date</div>
        <div><strong>${d.issueDate}</strong></div>
        ${dueLine}
      </div>
    </div>

    <div style="height:16px"></div>

    <div class="row">
      <div style="min-width:260px">
        <div class="muted">Bill to</div>
        <div><strong>${d.companyName}</strong></div>
        <div class="muted">Company slug: ${d.companySlug}</div>
      </div>
      <div style="min-width:260px">
        <div class="muted">Plan</div>
        <div><strong>${d.planName}</strong></div>
        <div class="muted">Currency: ${d.currency}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${d.planName} subscription</td>
          <td class="right">${money(d.amount)} ${d.currency}</td>
        </tr>
        <tr>
          <td class="right" colspan="1"><span class="muted">Total</span></td>
          <td class="right total">${money(d.amount)} ${d.currency}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top:14px" class="muted">Note</div>
    <div>${d.note || '-'}</div>
  `;
}

export default function SystemAdminDashboard() {
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState<'companies' | 'billing'>('companies');

  const sidebarItems = useMemo(
    () => [
      { key: 'companies', label: 'Companies' },
      { key: 'billing', label: 'Billing (Invoices & Receipts)' },
    ],
    []
  );

  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');

  const [draft, setDraft] = useState<InvoiceDraft | null>(null);

  async function refreshCompanies() {
    setLoading(true);
    try {
      const list = await listCompanies();
      setCompanies(list);
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to load companies'), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshCompanies().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => `${c.name} ${c.slug}`.toLowerCase().includes(q));
  }, [companies, search]);

  const stats = useMemo(() => {
    const total = companies.length;
    const active = companies.filter((c) => c.active !== false).length;
    const inactive = total - active;
    const roots = companies.filter((c) => !c.parentCompanyId).length;
    return { total, active, inactive, roots };
  }, [companies]);

  async function toggleCompanyActive(c: Company, nextActive: boolean) {
    try {
      const updated = await setCompanyActive(c.id, nextActive);
      setCompanies((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
      showToast(nextActive ? 'Company activated' : 'Company deactivated', 'success');
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to update company'), 'error');
    }
  }

  function openInvoiceForCompany(c: Company, kind: 'invoice' | 'receipt') {
    const today = new Date();
    const due = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 7));

    setDraft({
      kind,
      companyId: c.id,
      companyName: c.name,
      companySlug: c.slug,
      issueDate: fmtDate(today),
      dueDate: fmtDate(due),
      invoiceNumber: buildInvoiceNumber(c.slug),
      planName: 'Standard Plan',
      amount: 50,
      currency: 'USD',
      note: 'Thank you for using our attendance system.',
      status: kind === 'receipt' ? 'PAID' : 'UNPAID',
    });
  }

  function printDraft() {
    if (!draft) return;
    const html = renderInvoiceHtml(draft);
    openPrintWindow(html, draft.kind === 'invoice' ? 'Invoice' : 'Receipt');
  }

  return (
    <AppLayout title="System Admin" sidebarItems={sidebarItems} activeSidebarKey={section} onSidebarChange={(k) => setSection(k as any)}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-2xl font-bold text-slate-900">{sidebarItems.find((x) => x.key === section)?.label}</div>
            <div className="mt-1 text-sm text-slate-600">Manage all companies in the system and enforce billing status.</div>
          </div>
          <button
            type="button"
            onClick={refreshCompanies}
            disabled={loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-white p-4">
            <div className="text-xs text-slate-500">Total companies</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{stats.total}</div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-xs text-slate-500">Active</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{stats.active}</div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-xs text-slate-500">Inactive</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{stats.inactive}</div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-xs text-slate-500">Root companies</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{stats.roots}</div>
          </div>
        </div>

        <div className="rounded-xl border bg-white">
          <div className="border-b p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-slate-900">Companies</div>
              <input
                className="w-full sm:w-72 rounded-md border bg-white px-3 py-2 text-sm"
                placeholder="Search name or slug"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="px-4 py-10 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-600">No companies found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 text-left">Company</th>
                    <th className="px-4 py-2 text-left">Slug</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((c) => {
                    const isActive = c.active !== false;
                    const isBranch = !!c.parentCompanyId;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{c.name}</div>
                          <div className="text-xs text-slate-500">ID: {c.id}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.slug}</td>
                        <td className="px-4 py-3 text-slate-700">{isBranch ? 'Branch' : 'Root'}</td>
                        <td className="px-4 py-3">
                          <span className={isActive ? 'inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200' : 'inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 border border-red-200'}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={isActive ? 'rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50' : 'rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700'}
                              onClick={() => toggleCompanyActive(c, !isActive)}
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              className="rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50"
                              onClick={() => openInvoiceForCompany(c, 'invoice')}
                            >
                              Create invoice
                            </button>
                            <button
                              type="button"
                              className="rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50"
                              onClick={() => openInvoiceForCompany(c, 'receipt')}
                            >
                              Create receipt
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {draft ? (
          <div className="rounded-xl border bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{draft.kind === 'invoice' ? 'Invoice draft' : 'Receipt draft'}</div>
                <div className="mt-1 text-xs text-slate-500">{draft.invoiceNumber} • {draft.companyName}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setDraft(null)}>
                  Close
                </button>
                <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800" onClick={printDraft}>
                  Print / Save PDF
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Plan name</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={draft.planName} onChange={(e) => setDraft({ ...draft, planName: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Amount</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Currency</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as any })}>
                  <option value="UNPAID">UNPAID</option>
                  <option value="PAID">PAID</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Issue date</label>
                <input type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={draft.issueDate} onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Due date</label>
                <input type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Note</label>
                <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
