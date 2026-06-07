import React, { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { listFees, createFee, deleteFee, listPayments, recordPayment, listTeams } from '../../api/sports';
import type { MembershipFee, CreateFeeRequest, PlayerPayment, RecordPaymentRequest, Team } from '../../api/types';
import { getApiErrorMessage } from '../../utils/error';

type TabType = 'fees' | 'payments';

export default function PaymentsPage() {
  const { toast, showToast, hideToast } = useToast();
  const [tab, setTab] = useState<TabType>('fees');
  const [fees, setFees] = useState<MembershipFee[]>([]);
  const [payments, setPayments] = useState<PlayerPayment[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [feeForm, setFeeForm] = useState<CreateFeeRequest>({ clubId: 1, teamId: undefined, name: '', amount: 0, currency: 'USD', frequency: 'MONTHLY', description: '' });
  const [paymentForm, setPaymentForm] = useState<RecordPaymentRequest>({ feeId: 0, playerId: 0, amount: 0, dueDate: '', notes: '' });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [f, p, t] = await Promise.all([listFees(), listPayments(), listTeams()]);
      setFees(f);
      setPayments(p);
      setTeams(t);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load payments data'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleCreateFee(e: React.FormEvent) {
    e.preventDefault();
    if (!feeForm.name.trim() || !feeForm.amount) { showToast('Name and amount are required', 'error'); return; }
    setSaving(true);
    try {
      await createFee(feeForm);
      setShowFeeModal(false);
      setFeeForm({ clubId: 1, teamId: undefined, name: '', amount: 0, currency: 'USD', frequency: 'MONTHLY', description: '' });
      showToast('Fee created', 'success');
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to create fee'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFee(id: number) {
    if (!window.confirm('Delete this fee?')) return;
    try {
      await deleteFee(id);
      showToast('Fee deleted', 'success');
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to delete fee'), 'error');
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentForm.feeId || !paymentForm.playerId || !paymentForm.amount || !paymentForm.dueDate) {
      showToast('Fee, player, amount and due date are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await recordPayment(paymentForm);
      setShowPaymentModal(false);
      setPaymentForm({ feeId: 0, playerId: 0, amount: 0, dueDate: '', notes: '' });
      showToast('Payment recorded', 'success');
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to record payment'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-600">Manage membership fees and payments</p>
        </div>
        <div className="flex gap-2">
          {tab === 'fees' && (
            <button type="button" onClick={() => setShowFeeModal(true)} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">+ New Fee</button>
          )}
          {tab === 'payments' && (
            <button type="button" onClick={() => setShowPaymentModal(true)} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">+ Record Payment</button>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setTab('fees')} className={`rounded-md px-4 py-2 text-sm ${tab === 'fees' ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700 hover:bg-slate-50'}`}>Fees</button>
        <button type="button" onClick={() => setTab('payments')} className={`rounded-md px-4 py-2 text-sm ${tab === 'payments' ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700 hover:bg-slate-50'}`}>Payments</button>
      </div>

      {tab === 'fees' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fees.map((fee) => (
            <div key={fee.id} className="rounded-xl border bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{fee.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{fee.frequency}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${fee.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {fee.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold text-slate-900">{fee.currency} {fee.amount.toLocaleString()}</span>
              </div>
              {fee.description && <p className="mt-2 text-xs text-slate-600">{fee.description}</p>}
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => { setTab('payments'); }} className="flex-1 rounded-md border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">View Payments</button>
                <button type="button" onClick={() => handleDeleteFee(fee.id)} className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </div>
          ))}
          {fees.length === 0 && (
            <div className="md:col-span-2 lg:col-span-3">
              <EmptyState title="No fees defined" description="Create membership fees for your club." action={
                <button type="button" onClick={() => setShowFeeModal(true)} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">Create Fee</button>
              } />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-3 text-left">Player</th>
                <th className="px-5 py-3 text-left">Fee</th>
                <th className="px-5 py-3 text-left">Amount</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Due Date</th>
                <th className="px-5 py-3 text-left">Paid Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{p.playerName}</td>
                  <td className="px-5 py-3 text-slate-600">{p.feeName}</td>
                  <td className="px-5 py-3 font-medium">{p.currency} {p.amount.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                      p.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                      p.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '-'}</td>
                  <td className="px-5 py-3 text-slate-600">{p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={6}><EmptyState title="No payments" description="Record your first payment." action={
                  <button type="button" onClick={() => setShowPaymentModal(true)} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">Record Payment</button>
                } /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showFeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Create Fee</h2>
            <form onSubmit={handleCreateFee} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Fee Name</label>
                <input value={feeForm.name} onChange={(e) => setFeeForm(p => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Amount</label>
                  <input type="number" value={feeForm.amount || ''} onChange={(e) => setFeeForm(p => ({ ...p, amount: Number(e.target.value) }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Currency</label>
                  <select value={feeForm.currency} onChange={(e) => setFeeForm(p => ({ ...p, currency: e.target.value }))} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="KES">KES</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Frequency</label>
                  <select value={feeForm.frequency} onChange={(e) => setFeeForm(p => ({ ...p, frequency: e.target.value }))} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
                    <option value="ONE_TIME">One Time</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUAL">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Team (optional)</label>
                  <select value={feeForm.teamId || ''} onChange={(e) => setFeeForm(p => ({ ...p, teamId: e.target.value ? Number(e.target.value) : undefined }))} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
                    <option value="">All Teams</option>
                    {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea value={feeForm.description || ''} onChange={(e) => setFeeForm(p => ({ ...p, description: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={2} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowFeeModal(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60">
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Record Payment</h2>
            <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Fee</label>
                  <select value={paymentForm.feeId || ''} onChange={(e) => setPaymentForm(p => ({ ...p, feeId: Number(e.target.value) }))} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" required>
                    <option value="">Select fee</option>
                    {fees.map((f) => (<option key={f.id} value={f.id}>{f.name} ({f.currency} {f.amount})</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Player ID</label>
                  <input type="number" value={paymentForm.playerId || ''} onChange={(e) => setPaymentForm(p => ({ ...p, playerId: Number(e.target.value) }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Amount</label>
                  <input type="number" value={paymentForm.amount || ''} onChange={(e) => setPaymentForm(p => ({ ...p, amount: Number(e.target.value) }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Due Date</label>
                  <input type="date" value={paymentForm.dueDate} onChange={(e) => setPaymentForm(p => ({ ...p, dueDate: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Notes</label>
                <textarea value={paymentForm.notes || ''} onChange={(e) => setPaymentForm(p => ({ ...p, notes: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={2} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60">
                  {saving ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
