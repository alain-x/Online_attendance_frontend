import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

import { listCompanies, registerCompany, setCompanyActive } from '../api/companies';
import { deleteSystemBranding, deleteSystemFavicon, deleteSystemLogo, getSystemBranding, updateSystemBranding, uploadSystemFavicon, uploadSystemLogo } from '../api/system';
import { generateInvoicePdf } from '../api/invoices';

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

function buildInvoicePdfPayload(d: InvoiceDraft) {
  const isReceipt = d.kind === 'receipt';
  return {
    invoiceNumber: d.invoiceNumber,
    invoiceDate: d.issueDate,
    dueDate: isReceipt ? null : d.dueDate,
    status: d.status,
    currency: d.currency,
    vatRatePercent: 0,
    credit: 0,
    seller: {
      name: 'Attendance System',
    },
    billedTo: {
      name: d.companyName,
      attn: d.companySlug,
    },
    items: [
      {
        description: `${d.planName} subscription`,
        total: d.amount,
      },
    ],
    transactions: isReceipt
      ? [
          {
            transactionDate: d.issueDate,
            gateway: 'SYSTEM',
            transactionId: d.invoiceNumber,
            amount: d.amount,
          },
        ]
      : [],
  };
}

type StoredInvoice = InvoiceDraft & {
  id: string;
  createdAt: string;
};

const INVOICE_STORAGE_KEY = 'systemInvoices';

function loadStoredInvoices(): StoredInvoice[] {
  try {
    const raw = localStorage.getItem(INVOICE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredInvoice[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveStoredInvoices(next: StoredInvoice[]) {
  localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(next));
}

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

async function openPdfPrintWindow(blob: Blob, title: string) {
  const url = window.URL.createObjectURL(blob);
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) {
    window.URL.revokeObjectURL(url);
    return;
  }

  w.document.open();
  w.document.write(`<!doctype html><html><head><title>${title}</title><meta charset="utf-8" />
    <style>
      html,body{margin:0;padding:0;height:100%;}
      iframe{border:0;width:100%;height:100%;}
    </style>
    </head><body>
      <iframe id="pdf" src="${url}"></iframe>
      <script>
        const iframe = document.getElementById('pdf');
        iframe.addEventListener('load', () => {
          try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
        });
      </script>
    </body></html>`);
  w.document.close();

  const revoke = () => {
    try { window.URL.revokeObjectURL(url); } catch (e) {}
  };
  w.addEventListener('beforeunload', revoke);
}

function openPdfPlaceholderWindow(title: string) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return null;

  w.document.open();
  w.document.write(`<!doctype html><html><head><title>${title}</title><meta charset="utf-8" />
    <style>
      *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;}
      body{margin:0;padding:24px;background:#f8fafc;}
      .card{max-width:900px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:20px;}
      .muted{color:#64748b;font-size:13px;}
      .row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
      .btn{padding:10px 14px;border-radius:10px;border:1px solid #e2e8f0;background:white;cursor:pointer;}
      .btn.primary{background:#0f172a;color:white;border-color:#0f172a;}
      iframe{border:0;width:100%;height:80vh;margin-top:14px;display:none;}
    </style>
    </head><body>
      <div class="card">
        <div class="row">
          <div>
            <div style="font-weight:800;font-size:18px">${title}</div>
            <div class="muted" id="status">Generating PDF…</div>
          </div>
          <div>
            <button class="btn" onclick="window.close()">Close</button>
          </div>
        </div>
        <iframe id="pdf"></iframe>
      </div>
    </body></html>`);
  w.document.close();
  return w;
}

function navigatePdfIntoPlaceholderWindow(w: Window, blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const revoke = () => {
    try {
      window.URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  try {
    const status = w.document.getElementById('status');
    if (status) status.textContent = 'Opening PDF…';
  } catch {
    // ignore
  }

  try {
    w.location.href = url;
  } catch {
    // ignore
  }

  w.addEventListener('beforeunload', revoke);
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
  const navigate = useNavigate();
  const [section, setSection] = useState<'companies' | 'create_company' | 'billing'>('companies');

  const [systemLogoUrl, setSystemLogoUrl] = useState<string | null>(() => localStorage.getItem('systemLogoUrl'));
  const [systemFaviconUrl, setSystemFaviconUrl] = useState<string | null>(() => localStorage.getItem('systemFaviconUrl'));
  const [systemName, setSystemName] = useState<string>(() => localStorage.getItem('systemName') || '');
  const [systemNameBusy, setSystemNameBusy] = useState(false);
  const [systemLogoFile, setSystemLogoFile] = useState<File | null>(null);
  const [systemLogoBusy, setSystemLogoBusy] = useState(false);
  const [systemFaviconFile, setSystemFaviconFile] = useState<File | null>(null);
  const [systemFaviconBusy, setSystemFaviconBusy] = useState(false);

  const sidebarItems = useMemo(
    () => [
      { key: 'companies', label: 'Companies' },
      { key: 'create_company', label: 'Create Company' },
      { key: 'billing', label: 'Billing (Invoices & Receipts)' },
    ],
    []
  );

  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');

  const [createCompanyBusy, setCreateCompanyBusy] = useState(false);
  const [createCompanyError, setCreateCompanyError] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanySlug, setNewCompanySlug] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const [companyContextId, setCompanyContextId] = useState<number | null>(() => {
    const v = localStorage.getItem('companyContextId');
    const n = v != null ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  });

  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [storedInvoices, setStoredInvoices] = useState<StoredInvoice[]>(() => loadStoredInvoices());
  const [invoiceSearch, setInvoiceSearch] = useState('');

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

  async function onCreateCompany() {
    setCreateCompanyError(null);
    setCreateCompanyBusy(true);
    try {
      await registerCompany({
        companyName: newCompanyName,
        companySlug: newCompanySlug,
        adminUsername: newAdminUsername,
        adminPassword: newAdminPassword,
      });
      showToast('Company created successfully', 'success');
      setNewCompanyName('');
      setNewCompanySlug('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      await refreshCompanies();
      setSection('companies');
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, 'Failed to create company');
      setCreateCompanyError(msg);
      showToast(msg, 'error');
    } finally {
      setCreateCompanyBusy(false);
    }
  }

  useEffect(() => {
    refreshCompanies().catch(() => {});
    getSystemBranding()
      .then((res) => {
        localStorage.setItem('systemLogoUrl', res.logoUrl || '');
        localStorage.setItem('systemName', res.systemName || '');
        localStorage.setItem('systemFaviconUrl', res.faviconUrl || '');
        setSystemLogoUrl(res.logoUrl || null);
        setSystemFaviconUrl(res.faviconUrl || null);
        setSystemName(res.systemName || '');
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSaveSystemName() {
    setSystemNameBusy(true);
    try {
      await updateSystemBranding({ systemName: systemName.trim() });
      localStorage.setItem('systemName', systemName.trim());
      document.title = systemName.trim() ? systemName.trim() : 'Attendance System';
      showToast('System name updated', 'success');
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to update system name'), 'error');
    } finally {
      setSystemNameBusy(false);
    }
  }

  async function onDeleteSystemName() {
    setSystemNameBusy(true);
    try {
      await deleteSystemBranding();
      localStorage.setItem('systemName', '');
      setSystemName('');
      document.title = 'Attendance System';
      showToast('System name removed', 'success');
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to remove system name'), 'error');
    } finally {
      setSystemNameBusy(false);
    }
  }

  async function onUploadSystemLogo() {
    if (!systemLogoFile) return;
    setSystemLogoBusy(true);
    try {
      const res = await uploadSystemLogo(systemLogoFile);
      localStorage.setItem('systemLogoUrl', res.logoUrl || '');
      localStorage.setItem('systemLogoBust', String(Date.now()));
      setSystemLogoUrl(res.logoUrl || null);
      setSystemLogoFile(null);
      showToast('System logo uploaded', 'success');
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to upload system logo'), 'error');
    } finally {
      setSystemLogoBusy(false);
    }
  }

  async function onDeleteSystemLogo() {
    setSystemLogoBusy(true);
    try {
      await deleteSystemLogo();
      localStorage.setItem('systemLogoUrl', '');
      localStorage.setItem('systemLogoBust', String(Date.now()));
      setSystemLogoUrl(null);
      setSystemLogoFile(null);
      showToast('System logo removed', 'success');
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to remove system logo'), 'error');
    } finally {
      setSystemLogoBusy(false);
    }
  }

  async function onUploadSystemFavicon() {
    if (!systemFaviconFile) return;
    setSystemFaviconBusy(true);
    try {
      const res = await uploadSystemFavicon(systemFaviconFile);
      localStorage.setItem('systemFaviconUrl', res.faviconUrl || '');
      localStorage.setItem('systemFaviconBust', String(Date.now()));
      setSystemFaviconUrl(res.faviconUrl || null);
      setSystemFaviconFile(null);
      showToast('System favicon updated', 'success');
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to upload system favicon'), 'error');
    } finally {
      setSystemFaviconBusy(false);
    }
  }

  async function onDeleteSystemFavicon() {
    setSystemFaviconBusy(true);
    try {
      await deleteSystemFavicon();
      localStorage.setItem('systemFaviconUrl', '');
      localStorage.setItem('systemFaviconBust', String(Date.now()));
      setSystemFaviconUrl(null);
      setSystemFaviconFile(null);
      showToast('System favicon removed', 'success');
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to remove system favicon'), 'error');
    } finally {
      setSystemFaviconBusy(false);
    }
  }

  function applyCompanyContext(nextCompanyId: number | null) {
    if (nextCompanyId == null) {
      localStorage.removeItem('companyContextId');
      setCompanyContextId(null);
      showToast('Company context cleared', 'success');
      return;
    }
    localStorage.setItem('companyContextId', String(nextCompanyId));
    setCompanyContextId(nextCompanyId);
    const c = companies.find((x) => x.id === nextCompanyId);
    showToast(c ? `Company context set: ${c.name}` : 'Company context updated', 'success');
  }

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
    setSection('billing');
  }

  function addStoredInvoice(from: InvoiceDraft) {
    const rec: StoredInvoice = {
      ...from,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
    };
    setStoredInvoices((prev) => {
      const next = [rec, ...prev];
      saveStoredInvoices(next);
      return next;
    });
    showToast(from.kind === 'invoice' ? 'Invoice created' : 'Receipt created', 'success');
  }

  function updateStoredInvoice(id: string, patch: Partial<StoredInvoice>) {
    setStoredInvoices((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, ...patch } : x));
      saveStoredInvoices(next);
      return next;
    });
  }

  function removeStoredInvoice(id: string) {
    setStoredInvoices((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveStoredInvoices(next);
      return next;
    });
    showToast('Deleted', 'success');
  }

  function printDraft() {
    if (!draft) return;
    const payload = buildInvoicePdfPayload(draft);
    const title = draft.kind === 'invoice' ? 'Invoice' : 'Receipt';
    const w = openPdfPlaceholderWindow(title);

    generateInvoicePdf(payload)
      .then((blob) => {
        if (w && !w.closed) {
          navigatePdfIntoPlaceholderWindow(w, blob);
          return;
        }
        return openPdfPrintWindow(blob, title);
      })
      .catch((err) => {
        if (w && !w.closed) {
          try {
            const status = w.document.getElementById('status');
            if (status) {
              const msg = err instanceof Error ? err.message : 'Failed to generate PDF';
              status.textContent = msg;
            }
          } catch {
            // ignore
          }
        }
        const html = renderInvoiceHtml(draft);
        openPrintWindow(html, title);
      });
  }

  return (
    <AppLayout title="" sidebarItems={sidebarItems} activeSidebarKey={section} onSidebarChange={(k) => setSection(k as any)}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="space-y-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">Quick navigation</div>
          <div className="mt-1 text-sm text-slate-600">Open any dashboard with full access.</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800" onClick={() => navigate('/admin')}>
              Admin
            </button>
            <button type="button" className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => navigate('/payroll')}>
              Payroll
            </button>
            <button type="button" className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => navigate('/hr')}>
              HR
            </button>
            <button type="button" className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => navigate('/manager')}>
              Manager
            </button>
            <button type="button" className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => navigate('/recorder')}>
              Recorder
            </button>
            <button type="button" className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => navigate('/auditor')}>
              Auditor
            </button>
            <button type="button" className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => navigate('/employee')}>
              Employee
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-2xl font-bold text-slate-900">{sidebarItems.find((x) => x.key === section)?.label}</div>
            <div className="mt-1 text-sm text-slate-600">
              {section === 'companies'
                ? 'Manage all companies in the system and enforce access.'
                : section === 'create_company'
                  ? 'Create a new company and its initial admin account.'
                : 'Create, track, and manage invoices and receipts professionally.'}
            </div>
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

        {section === 'create_company' ? (
          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Create company</div>
            <div className="mt-1 text-sm text-slate-600">This creates a new company and an initial ADMIN user for that company.</div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Company name</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  autoComplete="organization"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Company slug</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={newCompanySlug}
                  onChange={(e) => setNewCompanySlug(e.target.value)}
                  placeholder="e.g. acme"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Admin email</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Admin password</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {createCompanyError ? (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {createCompanyError}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setSection('companies')}
                disabled={createCompanyBusy}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onCreateCompany}
                disabled={createCompanyBusy || !newCompanyName.trim() || !newCompanySlug.trim() || !newAdminUsername.trim() || !newAdminPassword}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {createCompanyBusy && <LoadingSpinner size="sm" />}
                {createCompanyBusy ? 'Creating…' : 'Create company'}
              </button>
            </div>
          </div>
        ) : null}

        {section === 'companies' ? (
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">System favicon</div>
                <div className="mt-1 text-sm text-slate-600">Browser tab icon shown to all users.</div>
              </div>
              {systemFaviconUrl ? (
                <img src={systemFaviconUrl} alt="System favicon" className="h-10 w-10 rounded-lg object-contain bg-white border" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-slate-100 border flex items-center justify-center text-slate-600 text-xs">N/A</div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="file"
                accept="image/*,.ico"
                className="w-full rounded-md border px-3 py-2 text-sm"
                onChange={(e) => setSystemFaviconFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
              />
              <button
                type="button"
                disabled={!systemFaviconFile || systemFaviconBusy}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
                onClick={onUploadSystemFavicon}
              >
                {systemFaviconBusy && <LoadingSpinner size="sm" />}
                {systemFaviconBusy ? 'Uploading...' : 'Upload favicon'}
              </button>
              <button
                type="button"
                disabled={systemFaviconBusy || !systemFaviconUrl}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
                onClick={onDeleteSystemFavicon}
              >
                {systemFaviconBusy && <LoadingSpinner size="sm" />}
                {systemFaviconBusy ? 'Removing...' : 'Remove favicon'}
              </button>
            </div>
          </div>
        ) : null}

        {section === 'companies' ? (
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">System logo</div>
                <div className="mt-1 text-sm text-slate-600">Global logo shown in header, sidebar, and login.</div>
              </div>
              {systemLogoUrl ? (
                <img src={systemLogoUrl} alt="System logo" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">A</div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="file"
                accept="image/*"
                className="w-full rounded-md border px-3 py-2 text-sm"
                onChange={(e) => setSystemLogoFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
              />
              <button
                type="button"
                disabled={!systemLogoFile || systemLogoBusy}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
                onClick={onUploadSystemLogo}
              >
                {systemLogoBusy && <LoadingSpinner size="sm" />}
                {systemLogoBusy ? 'Uploading...' : 'Upload system logo'}
              </button>
              <button
                type="button"
                disabled={systemLogoBusy || !systemLogoUrl}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
                onClick={onDeleteSystemLogo}
              >
                {systemLogoBusy && <LoadingSpinner size="sm" />}
                {systemLogoBusy ? 'Removing...' : 'Remove logo'}
              </button>
            </div>
          </div>
        ) : null}

        {section === 'companies' ? (
          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">System name</div>
            <div className="mt-1 text-sm text-slate-600">This is the global name shown in the top header.</div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Enter system name"
              />
              <button
                type="button"
                disabled={systemNameBusy}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
                onClick={onSaveSystemName}
              >
                {systemNameBusy && <LoadingSpinner size="sm" />}
                {systemNameBusy ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                disabled={systemNameBusy || !systemName.trim()}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
                onClick={onDeleteSystemName}
              >
                {systemNameBusy && <LoadingSpinner size="sm" />}
                {systemNameBusy ? 'Removing...' : 'Remove name'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Company context</div>
              <div className="mt-1 text-sm text-slate-600">
                Select a company to manage its data across the app (Admin, Payroll, Employees, Attendance, Reports).
              </div>
              <div className="mt-2">
                {companyContextId ? (
                  <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                    Active context: ID {companyContextId}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    No context selected
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
              <div>
                <label className="text-xs font-medium text-slate-700">Company</label>
                <select
                  className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                  value={companyContextId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    applyCompanyContext(v ? Number(v) : null);
                  }}
                >
                  <option value="">-- Select company --</option>
                  {companies
                    .filter((c) => c.active !== false)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.slug})
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                className="mt-5 rounded-md border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                onClick={() => applyCompanyContext(null)}
                disabled={!companyContextId}
              >
                Clear
              </button>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                  disabled={!companyContextId}
                  onClick={() => navigate('/admin')}
                >
                  Open Admin
                </button>
                <button
                  type="button"
                  className="w-full rounded-md border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                  disabled={!companyContextId}
                  onClick={() => navigate('/payroll')}
                >
                  Open Payroll
                </button>
              </div>
            </div>
          </div>
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

        {section === 'billing' ? (
          <div className="rounded-xl border bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Billing Center</div>
                <div className="mt-1 text-sm text-slate-600">Create invoices/receipts and track payment status.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={() => {
                    setStoredInvoices([]);
                    saveStoredInvoices([]);
                    showToast('Billing history cleared', 'success');
                  }}
                >
                  Clear history
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="text-sm font-medium text-slate-700">Company</label>
                <select
                  className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                  value={draft?.companyId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    const id = v ? Number(v) : null;
                    if (!id) {
                      setDraft(null);
                      return;
                    }
                    const c = companies.find((x) => x.id === id);
                    if (!c) return;
                    openInvoiceForCompany(c, draft?.kind || 'invoice');
                  }}
                >
                  <option value="">-- Select company --</option>
                  {companies
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.slug})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Document type</label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={draft?.kind || 'invoice'}
                  onChange={(e) => {
                    const kind = e.target.value as 'invoice' | 'receipt';
                    if (!draft) return;
                    setDraft({ ...draft, kind, status: kind === 'receipt' ? 'PAID' : draft.status });
                  }}
                >
                  <option value="invoice">Invoice</option>
                  <option value="receipt">Receipt</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={draft?.status || 'UNPAID'}
                  onChange={(e) => {
                    if (!draft) return;
                    setDraft({ ...draft, status: e.target.value as any });
                  }}
                >
                  <option value="UNPAID">UNPAID</option>
                  <option value="PAID">PAID</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Plan</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={draft?.planName || ''}
                  onChange={(e) => draft && setDraft({ ...draft, planName: e.target.value })}
                  placeholder="e.g. Standard Plan"
                  disabled={!draft}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Amount</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={draft?.amount ?? 0}
                  onChange={(e) => draft && setDraft({ ...draft, amount: Number(e.target.value) })}
                  disabled={!draft}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Currency</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={draft?.currency || ''}
                  onChange={(e) => draft && setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
                  placeholder="USD"
                  disabled={!draft}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Issue date</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={draft?.issueDate || ''}
                  onChange={(e) => draft && setDraft({ ...draft, issueDate: e.target.value })}
                  disabled={!draft}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Due date</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={draft?.dueDate || ''}
                  onChange={(e) => draft && setDraft({ ...draft, dueDate: e.target.value })}
                  disabled={!draft || draft.kind !== 'invoice'}
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-sm font-medium text-slate-700">Note</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  rows={3}
                  value={draft?.note || ''}
                  onChange={(e) => draft && setDraft({ ...draft, note: e.target.value })}
                  disabled={!draft}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                disabled={!draft}
                onClick={() => draft && printDraft()}
              >
                Preview / Print
              </button>
              <button
                type="button"
                className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={!draft}
                onClick={() => {
                  if (!draft) return;
                  addStoredInvoice(draft);
                }}
              >
                Create & Save
              </button>
            </div>

            <div className="mt-6 rounded-xl border">
              <div className="border-b p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-semibold text-slate-900">Invoices & receipts</div>
                  <input
                    className="w-full sm:w-72 rounded-md border bg-white px-3 py-2 text-sm"
                    placeholder="Search company, invoice number, plan"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                  />
                </div>
              </div>

              {storedInvoices.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-600">No invoices yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[1000px] w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-2 text-left">Document</th>
                        <th className="px-4 py-2 text-left">Company</th>
                        <th className="px-4 py-2 text-left">Dates</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {storedInvoices
                        .filter((inv) => {
                          const q = invoiceSearch.trim().toLowerCase();
                          if (!q) return true;
                          return `${inv.invoiceNumber} ${inv.companyName} ${inv.companySlug} ${inv.planName}`.toLowerCase().includes(q);
                        })
                        .map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{inv.kind === 'invoice' ? 'Invoice' : 'Receipt'}</div>
                              <div className="text-xs font-mono text-slate-600">{inv.invoiceNumber}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{inv.companyName}</div>
                              <div className="text-xs text-slate-500">{inv.companySlug} • ID: {inv.companyId}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              <div className="text-xs text-slate-500">Issue</div>
                              <div className="font-medium">{inv.issueDate}</div>
                              {inv.kind === 'invoice' ? (
                                <>
                                  <div className="mt-1 text-xs text-slate-500">Due</div>
                                  <div className="font-medium">{inv.dueDate}</div>
                                </>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={
                                  inv.status === 'PAID'
                                    ? 'inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200'
                                    : 'inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200'
                                }
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              {money(inv.amount)} {inv.currency}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50"
                                  onClick={() => {
                                    setDraft(inv);
                                    const html = renderInvoiceHtml(inv);
                                    openPrintWindow(html, inv.kind === 'invoice' ? 'Invoice' : 'Receipt');
                                  }}
                                >
                                  Print
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50"
                                  onClick={() => updateStoredInvoice(inv.id, { status: inv.status === 'PAID' ? 'UNPAID' : 'PAID' })}
                                >
                                  Mark {inv.status === 'PAID' ? 'unpaid' : 'paid'}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50"
                                  onClick={() => removeStoredInvoice(inv.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

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
