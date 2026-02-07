import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { getPayrollSummary } from '../api/payroll';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../hooks/useToast';

import type { PayrollSummaryResponse } from '../api/types';

type AuditorSection = 'overview' | 'payroll' | 'exports' | 'audit_log';

export default function AuditorDashboard() {
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState<AuditorSection>('overview');

  const [payrollFrom, setPayrollFrom] = useState<string>(() => {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return first.toISOString().slice(0, 10);
  });
  const [payrollTo, setPayrollTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollError, setPayrollError] = useState<string | null>(null);
  const [payroll, setPayroll] = useState<PayrollSummaryResponse | null>(null);
  const [payrollSearch, setPayrollSearch] = useState('');
  const [sortKey, setSortKey] = useState<'employee' | 'worked' | 'expected' | 'gross' | 'net'>('employee');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sidebarItems = useMemo(
    () => [
      { key: 'overview', label: 'Overview' },
      { key: 'payroll', label: 'Payroll Summary' },
      { key: 'exports', label: 'Exports' },
      { key: 'audit_log', label: 'Audit Log' },
    ],
    []
  );

  useEffect(() => {
    if (user?.role !== 'AUDITOR') {
      showToast('Access limited: Auditor dashboard is for Auditor accounts only.', 'warning');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  function setPresetThisWeek() {
    const today = new Date();
    const day = today.getUTCDay();
    const diff = (day + 6) % 7;
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - diff));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6));
    setPayrollFrom(start.toISOString().slice(0, 10));
    setPayrollTo(end.toISOString().slice(0, 10));
  }

  function setPresetThisMonth() {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    setPayrollFrom(start.toISOString().slice(0, 10));
    setPayrollTo(today.toISOString().slice(0, 10));
  }

  function setPresetLastMonth() {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    setPayrollFrom(start.toISOString().slice(0, 10));
    setPayrollTo(end.toISOString().slice(0, 10));
  }

  async function loadPayroll() {
    setPayrollError(null);
    setPayrollLoading(true);
    try {
      const data = await getPayrollSummary(payrollFrom, payrollTo);
      setPayroll(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const msg = err?.response?.data?.message || err?.message || 'Failed to load payroll summary';
      setPayrollError(msg);
      showToast(msg, 'error');
    } finally {
      setPayrollLoading(false);
    }
  }

  useEffect(() => {
    if (section !== 'payroll') return;
    loadPayroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const filteredPayrollRows = useMemo(() => {
    if (!payroll) return [];
    const q = payrollSearch.trim().toLowerCase();
    if (!q) return payroll.rows;
    return payroll.rows.filter((r) => {
      const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
      const code = (r.employeeCode || '').toLowerCase();
      return fullName.includes(q) || code.includes(q);
    });
  }, [payroll, payrollSearch]);

  const sortedPayrollRows = useMemo(() => {
    const list = [...filteredPayrollRows];
    const dir = sortDir === 'asc' ? 1 : -1;
    function cmpNum(a: number, b: number): number {
      return a === b ? 0 : a > b ? 1 : -1;
    }
    list.sort((a, b) => {
      if (sortKey === 'employee') {
        const aa = `${a.firstName} ${a.lastName} ${a.employeeCode}`.toLowerCase();
        const bb = `${b.firstName} ${b.lastName} ${b.employeeCode}`.toLowerCase();
        return aa.localeCompare(bb) * dir;
      }
      if (sortKey === 'worked') return cmpNum(a.workedMinutes, b.workedMinutes) * dir;
      if (sortKey === 'expected') return cmpNum(a.expectedMinutes, b.expectedMinutes) * dir;
      if (sortKey === 'gross') return cmpNum(a.grossPay, b.grossPay) * dir;
      return cmpNum(a.netPay, b.netPay) * dir;
    });
    return list;
  }, [filteredPayrollRows, sortDir, sortKey]);

  function csvEscape(v: unknown): string {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function exportPayrollCsv() {
    if (!payroll) {
      showToast('Load payroll summary first', 'error');
      return;
    }

    const header = ['Employee Code', 'First Name', 'Last Name', 'Worked Minutes', 'Expected Minutes', 'Gross Pay', 'Net Pay'];
    const lines: string[] = [];
    lines.push(header.map(csvEscape).join(','));
    for (const r of payroll.rows) {
      lines.push([r.employeeCode, r.firstName, r.lastName, r.workedMinutes, r.expectedMinutes, r.grossPay, r.netPay].map(csvEscape).join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_summary_${payroll.from}_${payroll.to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout
      title="Auditor"
      sidebarItems={sidebarItems}
      activeSidebarKey={section}
      onSidebarChange={(k) => setSection(k as AuditorSection)}
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-2xl font-bold text-slate-900">{sidebarItems.find((x) => x.key === section)?.label}</div>
            <div className="mt-1 text-sm text-slate-600">Read-only access to payroll and compliance exports.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border bg-white px-3 py-1.5 text-sm text-slate-700">Role: Auditor</div>
            {user?.companySlug ? <div className="rounded-full border bg-white px-3 py-1.5 text-sm text-slate-700">Company: {user.companySlug}</div> : null}
          </div>
        </div>

        {section === 'overview' ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8 grid gap-4">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Audit focus</div>
                <div className="mt-1 text-sm text-slate-600">Track payroll summaries and export compliance datasets.</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-600">Payroll runs</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">—</div>
                    <div className="mt-1 text-xs text-slate-500">Coming soon</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-600">Export jobs</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">—</div>
                    <div className="mt-1 text-xs text-slate-500">Coming soon</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-600">Flags</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">—</div>
                    <div className="mt-1 text-xs text-slate-500">Coming soon</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Quick actions</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button type="button" className="rounded-lg border bg-white px-4 py-3 text-left hover:bg-slate-50" onClick={() => setSection('payroll')}>
                    <div className="text-sm font-medium text-slate-900">View payroll summary</div>
                    <div className="mt-1 text-xs text-slate-600">Review totals, overtime, and salary figures.</div>
                  </button>
                  <button type="button" className="rounded-lg border bg-white px-4 py-3 text-left hover:bg-slate-50" onClick={() => setSection('exports')}>
                    <div className="text-sm font-medium text-slate-900">Export data</div>
                    <div className="mt-1 text-xs text-slate-600">Download compliance exports and audit packs.</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 grid gap-4">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Compliance notes</div>
                <div className="mt-1 text-sm text-slate-600">Store audit notes and export evidence.</div>
                <div className="mt-3">
                  <EmptyState title="Coming soon" description="Audit notes and compliance evidence features will be added here." />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {section !== 'overview' ? (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            {section === 'payroll' ? (
              <div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Payroll summary</div>
                    <div className="mt-1 text-sm text-slate-600">Read-only payroll view for auditing and compliance.</div>
                  </div>

                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-end sm:justify-end">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={setPresetThisWeek}>
                        This week
                      </button>
                      <button type="button" className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={setPresetThisMonth}>
                        This month
                      </button>
                      <button type="button" className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={setPresetLastMonth}>
                        Last month
                      </button>
                    </div>
                    <label className="block">
                      <div className="text-xs font-medium text-slate-600">From</div>
                      <input className="mt-1 rounded-md border bg-white px-3 py-2 text-sm" type="date" value={payrollFrom} onChange={(e) => setPayrollFrom(e.target.value)} />
                    </label>
                    <label className="block">
                      <div className="text-xs font-medium text-slate-600">To</div>
                      <input className="mt-1 rounded-md border bg-white px-3 py-2 text-sm" type="date" value={payrollTo} onChange={(e) => setPayrollTo(e.target.value)} />
                    </label>
                    <button
                      type="button"
                      disabled={payrollLoading || !payrollFrom || !payrollTo}
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                      onClick={loadPayroll}
                    >
                      {payrollLoading ? 'Loading…' : 'Load'}
                    </button>
                  </div>
                </div>

                {payrollError ? (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{payrollError}</div>
                ) : null}

                {payrollLoading ? (
                  <div className="mt-6 flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : !payroll ? (
                  <EmptyState title="No data" description="Select a date range and click Load." />
                ) : (
                  <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border bg-slate-50 p-4">
                        <div className="text-xs font-medium text-slate-600">Total worked</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{Math.round(payroll.totalWorkedMinutes / 60)}h</div>
                      </div>
                      <div className="rounded-xl border bg-slate-50 p-4">
                        <div className="text-xs font-medium text-slate-600">Total gross</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{payroll.totalGrossPay.toFixed(2)}</div>
                      </div>
                      <div className="rounded-xl border bg-slate-50 p-4">
                        <div className="text-xs font-medium text-slate-600">Total net</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{payroll.totalNetPay.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                      <input
                        className="w-full sm:w-80 rounded-md border bg-white px-3 py-2 text-sm"
                        placeholder="Search employee name or code…"
                        value={payrollSearch}
                        onChange={(e) => setPayrollSearch(e.target.value)}
                      />

                      <div className="flex flex-wrap gap-2 items-center justify-end">
                        <select
                          className="rounded-md border bg-white px-3 py-2 text-sm"
                          value={sortKey}
                          onChange={(e) => setSortKey(e.target.value as any)}
                        >
                          <option value="employee">Employee</option>
                          <option value="worked">Worked</option>
                          <option value="expected">Expected</option>
                          <option value="gross">Gross</option>
                          <option value="net">Net</option>
                        </select>
                        <button
                          type="button"
                          className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                        >
                          {sortDir === 'asc' ? 'Asc' : 'Desc'}
                        </button>
                      </div>
                    </div>

                    {sortedPayrollRows.length === 0 ? (
                      <EmptyState title="No employees" description="No payroll rows match your search." />
                    ) : (
                      <>
                        <div className="mt-4 hidden md:block overflow-x-auto rounded-xl border">
                          <table className="w-full min-w-[980px] text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                              <tr>
                                <th className="px-4 py-3 text-left">Employee</th>
                                <th className="px-4 py-3 text-left">Code</th>
                                <th className="px-4 py-3 text-right">Worked (min)</th>
                                <th className="px-4 py-3 text-right">Expected (min)</th>
                                <th className="px-4 py-3 text-right">Gross</th>
                                <th className="px-4 py-3 text-right">Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedPayrollRows.map((r) => (
                                <tr key={r.employeeId} className="border-t hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{r.firstName} {r.lastName}</td>
                                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{r.employeeCode}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{r.workedMinutes}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{r.expectedMinutes}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{r.grossPay.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{r.netPay.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-4 grid gap-3 md:hidden">
                          {sortedPayrollRows.map((r) => (
                            <div key={r.employeeId} className="rounded-xl border bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">{r.firstName} {r.lastName}</div>
                                  <div className="mt-1 text-xs text-slate-600">Code: <span className="font-medium text-slate-800">{r.employeeCode}</span></div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-slate-500">Net</div>
                                  <div className="text-sm font-semibold text-slate-900">{r.netPay.toFixed(2)}</div>
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <div className="text-slate-500">Worked (min)</div>
                                  <div className="text-slate-800">{r.workedMinutes}</div>
                                </div>
                                <div>
                                  <div className="text-slate-500">Expected (min)</div>
                                  <div className="text-slate-800">{r.expectedMinutes}</div>
                                </div>
                                <div>
                                  <div className="text-slate-500">Gross</div>
                                  <div className="text-slate-800">{r.grossPay.toFixed(2)}</div>
                                </div>
                                <div>
                                  <div className="text-slate-500">Deficit (min)</div>
                                  <div className="text-slate-800">{r.deficitMinutes}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : section === 'exports' ? (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Exports</div>
                    <div className="mt-1 text-sm text-slate-600">Download read-only export packs for compliance checks.</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-7 rounded-xl border bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Payroll summary (CSV)</div>
                    <div className="mt-1 text-sm text-slate-600">Exports the payroll rows currently loaded in the Payroll Summary section.</div>
                    <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                      <button
                        type="button"
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                        disabled={!payroll}
                        onClick={exportPayrollCsv}
                      >
                        Download payroll CSV
                      </button>
                      {!payroll ? <div className="text-sm text-slate-600">Load Payroll Summary first.</div> : <div className="text-sm text-slate-600">Range: {payroll.from} → {payroll.to}</div>}
                    </div>
                  </div>

                  <div className="lg:col-span-5 rounded-xl border bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Audit pack</div>
                    <div className="mt-1 text-sm text-slate-600">Combined exports (attendance, payroll, and exception logs) will be added here.</div>
                    <div className="mt-3">
                      <EmptyState title="No audit pack yet" description="This export will be enabled when the backend provides the required endpoints." />
                    </div>
                  </div>
                </div>
              </div>
            ) : section === 'audit_log' ? (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Audit log</div>
                    <div className="mt-1 text-sm text-slate-600">Track who changed critical payroll and attendance data.</div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Filters</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <label className="block">
                      <div className="text-xs font-medium text-slate-600">From</div>
                      <input className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" type="date" />
                    </label>
                    <label className="block">
                      <div className="text-xs font-medium text-slate-600">To</div>
                      <input className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" type="date" />
                    </label>
                    <label className="block">
                      <div className="text-xs font-medium text-slate-600">Search</div>
                      <input className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" placeholder="User, action, employee code…" />
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button type="button" className="rounded-md border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Apply
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
                  <EmptyState
                    title="No audit log connected"
                    description="This screen is ready. Once an audit-log API is available, entries will appear here with export support."
                  />
                </div>
              </div>
            ) : (
              <EmptyState title="Coming soon" description="This Auditor dashboard section is planned and will be implemented next." />
            )}
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
