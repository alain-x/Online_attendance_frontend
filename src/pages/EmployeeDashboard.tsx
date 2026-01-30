import React, { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import { checkIn, checkOut, endBreak, myAttendance, startBreak, verifyFace } from '../api/attendance';
import { enrollFace } from '../api/face';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';

import type { AttendanceResponse } from '../api/types';

function getApiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export default function EmployeeDashboard() {
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState('day');
  const [history, setHistory] = useState<AttendanceResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollImage, setEnrollImage] = useState<File | null>(null);
  const [verifyImage, setVerifyImage] = useState<File | null>(null);

  async function refresh() {
    try {
      setInitialLoading(true);
      const data = await myAttendance();
      setHistory(data);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load attendance data'), 'error');
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const activeRecord: AttendanceResponse | null = history.find((r) => !r.checkOutTime) || null;

  async function doStartBreak() {
    setError(null);
    setLoading(true);
    try {
      await startBreak();
      showToast('Break started successfully', 'success');
      await refresh();
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'Start break failed');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function doEndBreak() {
    setError(null);
    setLoading(true);
    try {
      await endBreak();
      showToast('Break ended successfully', 'success');
      await refresh();
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'End break failed');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function doEnrollFace() {
    setError(null);
    if (!enrollImage) {
      const errorMsg = 'Please choose an image to enroll';
      setError(errorMsg);
      showToast(errorMsg, 'warning');
      return;
    }
    setLoading(true);
    try {
      await enrollFace(enrollImage);
      setEnrollImage(null);
      showToast('Face enrolled successfully', 'success');
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'Face enroll failed');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function doVerifyFace() {
    setError(null);
    if (!activeRecord) {
      const errorMsg = 'You must be checked in to verify face';
      setError(errorMsg);
      showToast(errorMsg, 'warning');
      return;
    }
    if (!verifyImage) {
      const errorMsg = 'Please choose an image to verify';
      setError(errorMsg);
      showToast(errorMsg, 'warning');
      return;
    }
    setLoading(true);
    try {
      await verifyFace(verifyImage);
      setVerifyImage(null);
      showToast('Face verified successfully', 'success');
      await refresh();
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'Face verify failed');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function doCheckIn() {
    setError(null);
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      await checkIn(pos.coords.latitude, pos.coords.longitude);
      showToast('Checked in successfully', 'success');
      await refresh();
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'Check-in failed');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function doCheckOut() {
    setError(null);
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      await checkOut(pos.coords.latitude, pos.coords.longitude);
      showToast('Checked out successfully', 'success');
      await refresh();
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'Check-out failed');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }

  const sidebarItems = [
    { key: 'day', label: 'Dashboard' },
    { key: 'history', label: 'My Attendance' },
  ];

  if (initialLoading) {
    return (
      <AppLayout
        title="Employee Dashboard"
        sidebarItems={sidebarItems}
        activeSidebarKey={section}
        onSidebarChange={setSection}
      >
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Employee Dashboard"
      sidebarItems={sidebarItems}
      activeSidebarKey={section}
      onSidebarChange={setSection}
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-slate-900">Employee Dashboard</div>
          <div className="mt-1 text-sm text-slate-600">Check in/out with GPS and face verification.</div>
          {activeRecord && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-emerald-700">Currently checked in</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={doCheckIn}
            disabled={loading || !!activeRecord}
            className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
          >
            {loading && <LoadingSpinner size="sm" className="text-white" />}
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Check in
          </button>
          <button
            type="button"
            onClick={doCheckOut}
            disabled={loading || !activeRecord}
            className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
          >
            {loading && <LoadingSpinner size="sm" className="text-white" />}
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Check out
          </button>
          <button
            type="button"
            onClick={doStartBreak}
            disabled={loading || !activeRecord}
            className="rounded-md bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
          >
            {loading && <LoadingSpinner size="sm" className="text-white" />}
            Start break
          </button>
          <button
            type="button"
            onClick={doEndBreak}
            disabled={loading || !activeRecord}
            className="rounded-md bg-amber-700 px-4 py-2 text-white hover:bg-amber-800 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
          >
            {loading && <LoadingSpinner size="sm" className="text-white" />}
            End break
          </button>
        </div>
      </div>

      {section === 'day' ? (
        <div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-white p-4">
              <div className="font-medium text-slate-900">Face enrollment</div>
              <div className="mt-2 text-sm text-slate-600">Upload one reference image (employee only).</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEnrollImage(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                />
                <button
                  type="button"
                  onClick={doEnrollFace}
                  disabled={loading || !enrollImage}
                  className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Enroll face
                </button>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <div className="font-medium text-slate-900">Face verification</div>
              <div className="mt-2 text-sm text-slate-600">Verify during an active check-in session.</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setVerifyImage(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                />
                <button
                  type="button"
                  onClick={doVerifyFace}
                  disabled={loading || !activeRecord || !verifyImage}
                  className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Verify face
                </button>

                {activeRecord ? (
                  activeRecord.faceVerified ? (
                    <StatusBadge status="verified">Face verified</StatusBadge>
                  ) : (
                    <StatusBadge status="not verified">Face not verified</StatusBadge>
                  )
                ) : (
                  <span className="text-sm text-slate-500">Not checked in</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {section === 'history' ? (
        <div className="mt-6 rounded-xl border bg-white">
          <div className="px-4 py-3 border-b">
            <div className="font-medium text-slate-900">My attendance</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">Check in</th>
                  <th className="px-4 py-2 text-left">Check out</th>
                  <th className="px-4 py-2 text-left">Worked Hrs</th>
                  <th className="px-4 py-2 text-left">Location verified</th>
                  <th className="px-4 py-2 text-left">Face verified</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.checkInTime ? new Date(r.checkInTime).toLocaleString() : <span className="text-slate-400">-</span>}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleString() : <span className="text-slate-400">-</span>}</td>
                    <td className="px-4 py-3">
                      {r.workedMinutes ? (
                        <span className="text-slate-800">
                          {Math.floor(Number(r.workedMinutes) / 60)}h {Number(r.workedMinutes) % 60}m
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.locationVerified ? 'verified' : 'not verified'}>
                        {r.locationVerified ? 'Yes' : 'No'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.faceVerified ? 'verified' : 'not verified'}>
                        {r.faceVerified ? 'Yes' : 'No'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status?.toLowerCase()}>{r.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
                {history.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12" colSpan={6}>
                      <EmptyState
                        title="No attendance records"
                        description="Your attendance history will appear here once you start checking in and out."
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
