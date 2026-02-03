import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

import { approveCompanyPurpose, listPendingCompanyPurpose, rejectCompanyPurpose } from '../api/attendance';
import { getPayrollSummary } from '../api/payroll';

import type { AttendanceResponse, PayrollSummaryResponse } from '../api/types';

function minutesToHourMinute(mins: number): { h: number; m: number } {
  const n = Number(mins || 0);
  const h = Math.floor(n / 60);
  const m = n % 60;
  return { h, m };
}

function utcDateString(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

function addUtcDays(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfUtcMonth(d: Date): Date {
  return addUtcDays(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)), -1);
}

function startOfUtcWeekMonday(d: Date): Date {
  // Monday = 1, Sunday = 0
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addUtcDays(d, diff);
}

function money(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}

export default function PayrollDashboard() {
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState<'overview' | 'approvals' | 'payroll'>('overview');

  const [pending, setPending] = useState<AttendanceResponse[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const [payrollFrom, setPayrollFrom] = useState<string>(() => {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return utcDateString(first);
  });
  const [payrollTo, setPayrollTo] = useState<string>(() => utcDateString(new Date()));
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payroll, setPayroll] = useState<PayrollSummaryResponse | null>(null);
  const [payrollSearch, setPayrollSearch] = useState('');
  const [sortKey, setSortKey] = useState<
    'employee' | 'expected' | 'worked' | 'regular' | 'overtime' | 'deficit' | 'hourlyRate' | 'gross' | 'net'
  >('employee');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sidebarItems = [
    { key: 'overview', label: 'Overview' },
    { key: 'approvals', label: 'Company Purpose Approvals' },
    { key: 'payroll', label: 'Payroll Summary' },
  ];

  const [helpOpen, setHelpOpen] = useState(false);
  const [helpInput, setHelpInput] = useState('');
  const [helpMessages, setHelpMessages] = useState<{ id: string; from: 'user' | 'bot'; text: string; ts: number }[]>(() => [
    {
      id: 'm0',
      from: 'bot',
      text: 'Tip: Use “This week / This month / Last month” presets, then click Calculate. Exports respect your search filter.',
      ts: Date.now(),
    },
  ]);

  async function refreshPending() {
    setPendingLoading(true);
    try {
      const data = await listPendingCompanyPurpose();
      setPending(data);
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to load pending approvals'), 'error');
    } finally {
      setPendingLoading(false);
    }
  }

  function setPresetThisWeek() {
    const today = new Date();
    const start = startOfUtcWeekMonday(today);
    const end = addUtcDays(start, 6);
    setPayrollFrom(utcDateString(start));
    setPayrollTo(utcDateString(end));
  }

  function setPresetThisMonth() {
    const today = new Date();
    setPayrollFrom(utcDateString(startOfUtcMonth(today)));
    setPayrollTo(utcDateString(today));
  }

  function setPresetLastMonth() {
    const today = new Date();
    const lastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    setPayrollFrom(utcDateString(startOfUtcMonth(lastMonth)));
    setPayrollTo(utcDateString(endOfUtcMonth(lastMonth)));
  }

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
      if (sortKey === 'expected') return cmpNum(a.expectedMinutes, b.expectedMinutes) * dir;
      if (sortKey === 'worked') return cmpNum(a.workedMinutes, b.workedMinutes) * dir;
      if (sortKey === 'regular') return cmpNum(a.regularMinutes, b.regularMinutes) * dir;
      if (sortKey === 'overtime') return cmpNum(a.overtimeMinutes, b.overtimeMinutes) * dir;
      if (sortKey === 'deficit') return cmpNum(a.deficitMinutes, b.deficitMinutes) * dir;
      if (sortKey === 'hourlyRate') return cmpNum(a.hourlyRate ?? -1, b.hourlyRate ?? -1) * dir;
      if (sortKey === 'gross') return cmpNum(a.grossPay, b.grossPay) * dir;
      return cmpNum(a.netPay, b.netPay) * dir;
    });

    return list;
  }, [filteredPayrollRows, sortDir, sortKey]);

  const filteredTotals = useMemo(() => {
    let expectedMinutes = 0;
    let workedMinutes = 0;
    let regularMinutes = 0;
    let overtimeMinutes = 0;
    let deficitMinutes = 0;
    let grossPay = 0;
    let netPay = 0;

    for (const r of sortedPayrollRows) {
      expectedMinutes += r.expectedMinutes;
      workedMinutes += r.workedMinutes;
      regularMinutes += r.regularMinutes;
      overtimeMinutes += r.overtimeMinutes;
      deficitMinutes += r.deficitMinutes;
      grossPay += r.grossPay;
      netPay += r.netPay;
    }

    return { expectedMinutes, workedMinutes, regularMinutes, overtimeMinutes, deficitMinutes, grossPay, netPay };
  }, [sortedPayrollRows]);

  function toggleSort(next: typeof sortKey) {
    if (sortKey === next) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(next);
    setSortDir('asc');
  }

  function sortLabel(key: typeof sortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportPayrollCsv() {
    if (!payroll) return;
    const header = [
      'EmployeeCode',
      'FirstName',
      'LastName',
      'ExpectedMinutes',
      'WorkedMinutes',
      'RegularMinutes',
      'OvertimeMinutes',
      'DeficitMinutes',
      'HourlyRate',
      'GrossPay',
      'NetPay',
    ];
    const lines = [header.join(',')];
    for (const r of filteredPayrollRows) {
      const vals = [
        r.employeeCode,
        r.firstName,
        r.lastName,
        String(r.expectedMinutes),
        String(r.workedMinutes),
        String(r.regularMinutes),
        String(r.overtimeMinutes),
        String(r.deficitMinutes),
        r.hourlyRate != null ? String(r.hourlyRate) : '',
        money(r.grossPay),
        money(r.netPay),
      ];
      const escaped = vals.map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(escaped.join(','));
    }
    const csv = lines.join('\n');
    downloadBlob(`payroll_${payroll.from}_to_${payroll.to}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  }

  function exportPayrollExcel() {
    if (!payroll) return;
    const html = `\n      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">\n        <head>\n          <meta charset="utf-8" />\n          <!--[if gte mso 9]>\n          <xml>\n            <x:ExcelWorkbook>\n              <x:ExcelWorksheets>\n                <x:ExcelWorksheet>\n                  <x:Name>Payroll</x:Name>\n                  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>\n                </x:ExcelWorksheet>\n              </x:ExcelWorksheets>\n            </x:ExcelWorkbook>\n          </xml>\n          <![endif]-->\n        </head>\n        <body>\n          <table border="1">\n            <thead>\n              <tr>\n                <th>Employee Code</th>\n                <th>First Name</th>\n                <th>Last Name</th>\n                <th>Expected Minutes</th>\n                <th>Worked Minutes</th>\n                <th>Regular Minutes</th>\n                <th>Overtime Minutes</th>\n                <th>Deficit Minutes</th>\n                <th>Hourly Rate</th>\n                <th>Gross Pay</th>\n                <th>Net Pay</th>\n              </tr>\n            </thead>\n            <tbody>\n              ${filteredPayrollRows
                .map(
                  (r) => `\n                <tr>\n                  <td>${r.employeeCode}</td>\n                  <td>${r.firstName}</td>\n                  <td>${r.lastName}</td>\n                  <td>${r.expectedMinutes}</td>\n                  <td>${r.workedMinutes}</td>\n                  <td>${r.regularMinutes}</td>\n                  <td>${r.overtimeMinutes}</td>\n                  <td>${r.deficitMinutes}</td>\n                  <td>${r.hourlyRate != null ? money(r.hourlyRate) : ''}</td>\n                  <td>${money(r.grossPay)}</td>\n                  <td>${money(r.netPay)}</td>\n                </tr>`
                )
                .join('')}\n            </tbody>\n          </table>\n        </body>\n      </html>\n    `;
    downloadBlob(`payroll_${payroll.from}_to_${payroll.to}.xls`, new Blob([html], { type: 'application/vnd.ms-excel' }));
  }

  async function refreshPayroll() {
    setPayrollLoading(true);
    try {
      const data = await getPayrollSummary(payrollFrom, payrollTo);
      setPayroll(data);
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to load payroll summary'), 'error');
    } finally {
      setPayrollLoading(false);
    }
  }

  useEffect(() => {
    refreshPending().catch(() => {});
    refreshPayroll().catch(() => {});
  }, []);

  useEffect(() => {
    if (section === 'payroll' || section === 'overview') {
      refreshPayroll().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  function sendHelp() {
    const text = helpInput.trim();
    if (!text) return;
    const id = `u_${Date.now()}`;
    const now = Date.now();
    setHelpMessages((prev) => [...prev, { id, from: 'user', text, ts: now }]);
    setHelpInput('');

    const lower = text.toLowerCase();
    let reply = 'I can help with payroll. Try: “export”, “overtime”, “deficit”, “net pay”.';
    if (lower.includes('export')) {
      reply = 'Exports: use the Search box to filter, then click Export CSV or Export Excel. The exported file matches the filtered rows.';
    } else if (lower.includes('overtime')) {
      reply = 'Overtime rule: daily OT is minutes above 8h/day, plus weekly OT above 40h/week (without double counting).';
    } else if (lower.includes('deficit')) {
      reply = 'Deficit = Expected minutes (Mon–Fri * 8h) minus Regular minutes. Deficit does not reduce Gross/Net by default; it’s a performance metric.';
    } else if (lower.includes('net')) {
      reply = 'Net pay is calculated as 75% of Gross pay.';
    }
    setTimeout(() => {
      setHelpMessages((prev) => [...prev, { id: `b_${Date.now()}`, from: 'bot', text: reply, ts: Date.now() }]);
    }, 250);
  }

  const overviewCharts = useMemo(() => {
    if (!payroll) return null;
    const list = [...payroll.rows];
    const topOvertime = [...list].sort((a, b) => b.overtimeMinutes - a.overtimeMinutes).slice(0, 6);
    const topDeficit = [...list].sort((a, b) => b.deficitMinutes - a.deficitMinutes).slice(0, 6);
    const topRegularPct = [...list]
      .map((r) => {
        const pct = r.expectedMinutes > 0 ? Math.min(1, r.regularMinutes / r.expectedMinutes) : 0;
        return { r, pct };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);

    function maxOf(rows: typeof list, pick: (x: (typeof list)[number]) => number): number {
      return rows.reduce((acc, x) => Math.max(acc, pick(x)), 0);
    }

    return {
      topOvertime,
      topDeficit,
      topRegularPct,
      maxOvertime: Math.max(1, maxOf(topOvertime, (x) => x.overtimeMinutes)),
      maxDeficit: Math.max(1, maxOf(topDeficit, (x) => x.deficitMinutes)),
    };
  }, [payroll]);

  const pendingSorted = useMemo(() => {
    return [...pending].sort((a, b) => {
      const ta = a.checkOutTime ? new Date(a.checkOutTime).getTime() : 0;
      const tb = b.checkOutTime ? new Date(b.checkOutTime).getTime() : 0;
      return tb - ta;
    });
  }, [pending]);

  async function onApprove(id: number) {
    try {
      await approveCompanyPurpose(id);
      showToast('Approved', 'success');
      await refreshPending();
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Approve failed'), 'error');
    }
  }

  async function onReject(id: number) {
    try {
      await rejectCompanyPurpose(id);
      showToast('Rejected', 'success');
      await refreshPending();
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Reject failed'), 'error');
    }
  }

  return (
    <AppLayout
      title="Payroll"
      sidebarItems={sidebarItems}
      activeSidebarKey={section}
      onSidebarChange={(k) => setSection(k as 'overview' | 'approvals' | 'payroll')}
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="fixed bottom-6 right-6 z-40">
        {helpOpen ? (
          <div className="w-[92vw] sm:w-96 rounded-xl border bg-white shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Payroll Help</div>
                <div className="text-xs text-slate-500">Quick tips (local)</div>
              </div>
              <button type="button" className="h-9 w-9 rounded-md hover:bg-slate-100 text-slate-600" onClick={() => setHelpOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="h-64 overflow-auto p-4 bg-slate-50">
              <div className="space-y-2">
                {helpMessages.map((m) => (
                  <div key={m.id} className={m.from === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={m.from === 'user' ? 'max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-3 py-2 text-sm text-white' : 'max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-sm text-slate-800 border'}>
                      {m.text}
                      <div className={m.from === 'user' ? 'mt-1 text-[10px] text-slate-200' : 'mt-1 text-[10px] text-slate-400'}>
                        {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-3 border-t bg-white">
              <div className="flex items-end gap-2">
                <textarea
                  className="min-h-[40px] max-h-24 flex-1 resize-none rounded-md border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
                  placeholder='Ask: "How is overtime calculated?"'
                  value={helpInput}
                  onChange={(e) => setHelpInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendHelp();
                    }
                  }}
                />
                <button type="button" className="h-10 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800 disabled:opacity-50" onClick={sendHelp} disabled={!helpInput.trim()}>
                  Send
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">Enter to send, Shift+Enter for new line.</div>
            </div>
          </div>
        ) : (
          <button type="button" className="h-12 w-12 rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800" onClick={() => setHelpOpen(true)} aria-label="Help" title="Payroll help">
            ?
          </button>
        )}
      </div>

      {section === 'overview' ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <div className="text-2xl font-bold text-slate-900">Overview</div>
            <div className="text-sm text-slate-600">Performance and payroll trends for the selected range.</div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end w-full lg:w-auto">
                <div>
                  <label className="text-sm font-medium text-slate-700">From</label>
                  <input type="date" value={payrollFrom} onChange={(e) => setPayrollFrom(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">To</label>
                  <input type="date" value={payrollTo} onChange={(e) => setPayrollTo(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={refreshPayroll} disabled={payrollLoading} className="w-full rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60">
                    {payrollLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {payrollLoading ? (
            <div className="rounded-xl border bg-white px-4 py-10 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : payroll ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs text-slate-500">Gross</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">{money(payroll.totalGrossPay)}</div>
                  </div>
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs text-slate-500">Net (75%)</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">{money(payroll.totalNetPay)}</div>
                  </div>
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs text-slate-500">Overtime</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">{(() => {
                      const v = minutesToHourMinute(payroll.totalOvertimeMinutes);
                      return `${v.h}h ${v.m}m`;
                    })()}</div>
                  </div>
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs text-slate-500">Deficit</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">{(() => {
                      const v = minutesToHourMinute(payroll.totalDeficitMinutes);
                      return `${v.h}h ${v.m}m`;
                    })()}</div>
                  </div>
                </div>

                {overviewCharts ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">Top overtime</div>
                        <div className="text-xs text-slate-500">minutes</div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {overviewCharts.topOvertime.map((r) => {
                          const pct = Math.max(0, Math.min(1, r.overtimeMinutes / overviewCharts.maxOvertime));
                          return (
                            <div key={`ot_${r.employeeId}`} className="grid grid-cols-12 items-center gap-2">
                              <div className="col-span-5 text-xs text-slate-700 truncate">{r.firstName} {r.lastName}</div>
                              <div className="col-span-5 h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div className="h-full bg-amber-500" style={{ width: `${pct * 100}%` }} />
                              </div>
                              <div className="col-span-2 text-right text-xs text-slate-600">{r.overtimeMinutes}</div>
                            </div>
                          );
                        })}
                        {overviewCharts.topOvertime.length === 0 ? <div className="text-sm text-slate-600">No overtime in this range.</div> : null}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">Top deficit</div>
                        <div className="text-xs text-slate-500">minutes</div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {overviewCharts.topDeficit.map((r) => {
                          const pct = Math.max(0, Math.min(1, r.deficitMinutes / overviewCharts.maxDeficit));
                          return (
                            <div key={`df_${r.employeeId}`} className="grid grid-cols-12 items-center gap-2">
                              <div className="col-span-5 text-xs text-slate-700 truncate">{r.firstName} {r.lastName}</div>
                              <div className="col-span-5 h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div className="h-full bg-red-500" style={{ width: `${pct * 100}%` }} />
                              </div>
                              <div className="col-span-2 text-right text-xs text-slate-600">{r.deficitMinutes}</div>
                            </div>
                          );
                        })}
                        {overviewCharts.topDeficit.length === 0 ? <div className="text-sm text-slate-600">No deficit in this range.</div> : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4">
                <div className="rounded-xl border bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Insights</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-700">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Employees</div>
                      <div className="mt-1 font-semibold text-slate-900">{payroll.rows.length}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Default rate</div>
                      <div className="mt-1 font-semibold text-slate-900">{payroll.companyHourlyRateDefault != null ? money(payroll.companyHourlyRateDefault) : 'Not set'}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Best target completion</div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {overviewCharts && overviewCharts.topRegularPct.length > 0 ? (
                          <span>
                            {overviewCharts.topRegularPct[0].r.firstName} {overviewCharts.topRegularPct[0].r.lastName} ({Math.round(overviewCharts.topRegularPct[0].pct * 100)}%)
                          </span>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Next actions</div>
                  <div className="mt-2 text-sm text-slate-600">
                    Approve company-purpose clock-outs to include them as paid hours. Use Payroll Summary to export or audit calculations.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-white px-4 py-10 text-center text-sm text-slate-600">
              No payroll data yet. Select a range and click Refresh.
            </div>
          )}
        </div>
      ) : null}

      {section === 'approvals' ? (
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold text-slate-900">Company Purpose Approvals</div>
            <div className="mt-1 text-sm text-slate-600">Approve or reject company-purpose clock-outs. Only approved ones are counted as paid hours.</div>
          </div>

          <div className="rounded-xl border bg-white">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Pending requests</div>
              <button
                type="button"
                onClick={refreshPending}
                disabled={pendingLoading}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            {pendingLoading ? (
              <div className="px-4 py-8 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : pendingSorted.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-600">No pending approvals.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2 text-left">Employee</th>
                      <th className="px-4 py-2 text-left">Check in</th>
                      <th className="px-4 py-2 text-left">Check out</th>
                      <th className="px-4 py-2 text-left">Note</th>
                      <th className="px-4 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingSorted.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-900">
                          {r.employeeFirstName} {r.employeeLastName} ({r.employeeCode})
                        </td>
                        <td className="px-4 py-2 text-slate-700">{r.checkInTime ? new Date(r.checkInTime).toLocaleString() : '-'}</td>
                        <td className="px-4 py-2 text-slate-700">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleString() : '-'}</td>
                        <td className="px-4 py-2 text-slate-700 max-w-[420px]">
                          <div className="truncate" title={r.companyPurposeNote || ''}>{r.companyPurposeNote || '-'}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onApprove(r.id)}
                              className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => onReject(r.id)}
                              className="rounded-md bg-red-600 px-3 py-1.5 text-white hover:bg-red-700"
                            >
                              Reject
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
      ) : section === 'payroll' ? (
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold text-slate-900">Payroll Summary</div>
            <div className="mt-1 text-sm text-slate-600">Totals are calculated from approved worked minutes within the selected date range.</div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end w-full lg:w-auto">
                <div>
                  <label className="text-sm font-medium text-slate-700">From</label>
                  <input
                    type="date"
                    value={payrollFrom}
                    onChange={(e) => setPayrollFrom(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">To</label>
                  <input
                    type="date"
                    value={payrollTo}
                    onChange={(e) => setPayrollTo(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={refreshPayroll}
                    disabled={payrollLoading}
                    className="w-full rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {payrollLoading ? 'Loading…' : 'Calculate'}
                  </button>
                </div>
              </div>
            </div>

            {payroll ? (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-600">Total worked</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {(() => {
                      const v = minutesToHourMinute(payroll.totalWorkedMinutes);
                      return `${v.h}h ${v.m}m`;
                    })()}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-600">Total regular (target)</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {(() => {
                      const v = minutesToHourMinute(payroll.totalRegularMinutes);
                      return `${v.h}h ${v.m}m`;
                    })()}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-600">Total overtime</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {(() => {
                      const v = minutesToHourMinute(payroll.totalOvertimeMinutes);
                      return `${v.h}h ${v.m}m`;
                    })()}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-600">Total deficit</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {(() => {
                      const v = minutesToHourMinute(payroll.totalDeficitMinutes);
                      return `${v.h}h ${v.m}m`;
                    })()}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-600">Company default rate</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {payroll.companyHourlyRateDefault != null ? money(payroll.companyHourlyRateDefault) : 'Not set'}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-600">Total gross</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{money(payroll.totalGrossPay)}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-600">Total net (75%)</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{money(payroll.totalNetPay)}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-600">Total expected</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {(() => {
                      const v = minutesToHourMinute(payroll.totalExpectedMinutes);
                      return `${v.h}h ${v.m}m`;
                    })()}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border bg-white">
            <div className="border-b px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-slate-900">Employees</div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className="w-full sm:w-64 rounded-md border bg-white px-3 py-2 text-sm"
                    placeholder="Search name or code"
                    value={payrollSearch}
                    onChange={(e) => setPayrollSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={!payroll || filteredPayrollRows.length === 0}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    onClick={exportPayrollCsv}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    disabled={!payroll || filteredPayrollRows.length === 0}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    onClick={exportPayrollExcel}
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            </div>

            {payrollLoading ? (
              <div className="px-4 py-8 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : payroll && filteredPayrollRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[1400px] w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">
                        <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSort('employee')}>
                          Employee{sortLabel('employee')}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSort('expected')}>
                          Expected{sortLabel('expected')}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSort('worked')}>
                          Worked{sortLabel('worked')}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSort('regular')}>
                          Regular{sortLabel('regular')}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSort('overtime')}>
                          Overtime{sortLabel('overtime')}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSort('deficit')}>
                          Deficit{sortLabel('deficit')}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSort('hourlyRate')}>
                          Rate{sortLabel('hourlyRate')}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSort('gross')}>
                          Gross{sortLabel('gross')}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <button type="button" className="font-semibold hover:text-slate-900" onClick={() => toggleSort('net')}>
                          Net (75%){sortLabel('net')}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr className="bg-slate-50/60">
                      <td className="px-4 py-2 font-semibold text-slate-900">Filtered total</td>
                      <td className="px-4 py-2 text-slate-700">
                        {(() => {
                          const v = minutesToHourMinute(filteredTotals.expectedMinutes);
                          return `${v.h}h ${v.m}m`;
                        })()}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {(() => {
                          const v = minutesToHourMinute(filteredTotals.workedMinutes);
                          return `${v.h}h ${v.m}m`;
                        })()}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {(() => {
                          const v = minutesToHourMinute(filteredTotals.regularMinutes);
                          return `${v.h}h ${v.m}m`;
                        })()}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {(() => {
                          const v = minutesToHourMinute(filteredTotals.overtimeMinutes);
                          return `${v.h}h ${v.m}m`;
                        })()}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {(() => {
                          const v = minutesToHourMinute(filteredTotals.deficitMinutes);
                          return `${v.h}h ${v.m}m`;
                        })()}
                      </td>
                      <td className="px-4 py-2 text-slate-500">—</td>
                      <td className="px-4 py-2 text-slate-900 font-semibold">{money(filteredTotals.grossPay)}</td>
                      <td className="px-4 py-2 text-slate-900 font-semibold">{money(filteredTotals.netPay)}</td>
                    </tr>

                    {sortedPayrollRows.map((r) => (
                      <tr key={r.employeeId} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-900">
                          <div className="flex flex-col">
                            <div>{r.firstName} {r.lastName}</div>
                            <div className="text-xs text-slate-500">{r.employeeCode}</div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-slate-700">
                          {(() => {
                            const v = minutesToHourMinute(r.expectedMinutes);
                            return `${v.h}h ${v.m}m`;
                          })()}
                        </td>
                        <td className="px-4 py-2 text-slate-700">
                          {(() => {
                            const v = minutesToHourMinute(r.workedMinutes);
                            return `${v.h}h ${v.m}m`;
                          })()}
                        </td>
                        <td className="px-4 py-2 text-slate-700">
                          {(() => {
                            const v = minutesToHourMinute(r.regularMinutes);
                            return `${v.h}h ${v.m}m`;
                          })()}
                        </td>
                        <td className="px-4 py-2 text-slate-700">
                          {r.overtimeMinutes > 0 ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">OT</span>
                              <span>
                                {(() => {
                                  const v = minutesToHourMinute(r.overtimeMinutes);
                                  return `${v.h}h ${v.m}m`;
                                })()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-700">
                          {r.deficitMinutes > 0 ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">DEF</span>
                              <span>
                                {(() => {
                                  const v = minutesToHourMinute(r.deficitMinutes);
                                  return `${v.h}h ${v.m}m`;
                                })()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-700">{r.hourlyRate != null ? money(r.hourlyRate) : 'Not set'}</td>
                        <td className="px-4 py-2 text-slate-900 font-semibold">{money(r.grossPay)}</td>
                        <td className="px-4 py-2 text-slate-900 font-semibold">{money(r.netPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-slate-600">No data for selected range.</div>
            )}
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
