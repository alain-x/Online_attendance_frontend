import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { listEmployees } from '../api/employees';
import { recorderCheckIn, recorderCheckOut, todayAttendance } from '../api/attendance';
import { enrollFaceForEmployee } from '../api/face';
import type { EmployeeResponse } from '../api/types';
import { detectFaceInImage } from '../utils/faceDetection';

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

export default function RecorderDashboard() {
  const { toast, showToast, hideToast } = useToast();

  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const [mode, setMode] = useState<'quick' | 'single'>('quick');
  const [todayRows, setTodayRows] = useState<import('../api/types').AttendanceResponse[]>([]);

  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastCoords, setLastCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const selectedEmployee = useMemo(() => employees.find((e) => e.id === selectedEmployeeId) || null, [employees, selectedEmployeeId]);

  const readiness = useMemo(
    () => ({
      employee: !!selectedEmployee,
      location: !!lastCoords,
      camera: cameraOn,
    }),
    [selectedEmployee, lastCoords, cameraOn]
  );

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const haystack = [emp.employeeCode, emp.firstName, emp.lastName, emp.department || '', emp.username].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [employees, search]);

  const todayByEmployeeId = useMemo(() => {
    const map = new Map<number, import('../api/types').AttendanceResponse>();
    for (const row of todayRows || []) {
      const id = Number(row.employeeId);
      if (!id) continue;
      const prev = map.get(id);
      if (!prev) {
        map.set(id, row);
        continue;
      }
      // Prefer the latest by checkInTime then by id.
      const prevKey = prev.checkInTime || '';
      const nextKey = row.checkInTime || '';
      if (nextKey > prevKey) {
        map.set(id, row);
        continue;
      }
      if (nextKey === prevKey && Number(row.id) > Number(prev.id)) {
        map.set(id, row);
      }
    }
    return map;
  }, [todayRows]);

  async function refresh() {
    try {
      setInitialLoading(true);
      const [empData, attendanceData] = await Promise.all([listEmployees(), todayAttendance()]);
      setEmployees(empData);
      setTodayRows(attendanceData);
    } catch (e: unknown) {
      showToast(getApiErrorMessage(e, 'Failed to load employees'), 'error');
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!cameraOn || !streamRef.current) return;
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    const onLoaded = () => {
      video.play().catch(() => {});
    };
    video.addEventListener('loadedmetadata', onLoaded);
    onLoaded();
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [cameraOn]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function requestLocation(): Promise<{ latitude: number; longitude: number } | null> {
    setLocationError(null);
    setLocationLoading(true);
    try {
      const pos = await getCurrentPosition();
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLastCoords(coords);
      return coords;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Location permission is required';
      setLastCoords(null);
      setLocationError(msg);
      showToast('Please allow location permission to continue', 'warning');
      return null;
    } finally {
      setLocationLoading(false);
    }
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Camera not available';
      setError(msg);
      showToast(msg, 'error');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function captureDescriptor(): Promise<string | null> {
    const video = videoRef.current;
    if (!video) {
      showToast('Camera not ready. Please allow camera permission.', 'warning');
      return null;
    }

    const faceResult = await detectFaceInImage(video);
    if (!faceResult.face) {
      showToast('No face detected. Please center the employee face and try again.', 'error');
      return null;
    }
    if (!faceResult.descriptor) {
      showToast('AI face models are not installed (public/models). Please install them to continue.', 'error');
      return null;
    }
    return JSON.stringify(faceResult.descriptor);
  }

  async function doEnrollFace() {
    if (!selectedEmployee) {
      showToast('Please select an employee first', 'warning');
      return;
    }
    if (!cameraOn) {
      showToast('Please start the camera', 'warning');
      return;
    }

    setEnrollError(null);
    setEnrolling(true);
    try {
      const descriptorJson = await captureDescriptor();
      if (!descriptorJson) {
        setEnrolling(false);
        return;
      }
      await enrollFaceForEmployee(selectedEmployee.id, descriptorJson);
      showToast(`Face registered for ${selectedEmployee.firstName} ${selectedEmployee.lastName}`, 'success');
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, 'Face registration failed');
      setEnrollError(msg);
      showToast(msg, 'error');
    } finally {
      setEnrolling(false);
    }
  }

  async function doRecorderCheckIn() {
    if (!selectedEmployee) {
      showToast('Please select an employee first', 'warning');
      return;
    }
    if (locationLoading) return;
    const coords = lastCoords || (await requestLocation());
    if (!coords) {
      setError('Location permission is required to check in');
      return;
    }
    if (!cameraOn) {
      showToast('Please turn on the camera', 'warning');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const descriptorJson = await captureDescriptor();
      if (!descriptorJson) {
        setLoading(false);
        return;
      }
      const res = await recorderCheckIn(selectedEmployee.id, coords.latitude, coords.longitude, descriptorJson);
      showToast(`Recorded check-in for ${res.employeeFirstName} ${res.employeeLastName}`, 'success');
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, 'Recorder check-in failed');
      setError(msg);
      showToast(msg, msg.toLowerCase().includes('face not enrolled') ? 'warning' : 'error');
    } finally {
      setLoading(false);
    }
  }

  async function doRecorderCheckOut() {
    if (!selectedEmployee) {
      showToast('Please select an employee first', 'warning');
      return;
    }
    if (locationLoading) return;
    const coords = lastCoords || (await requestLocation());
    if (!coords) {
      setError('Location permission is required to check out');
      return;
    }
    if (!cameraOn) {
      showToast('Please turn on the camera', 'warning');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const descriptorJson = await captureDescriptor();
      if (!descriptorJson) {
        setLoading(false);
        return;
      }
      const res = await recorderCheckOut(selectedEmployee.id, coords.latitude, coords.longitude, descriptorJson);
      showToast(`Recorded check-out for ${res.employeeFirstName} ${res.employeeLastName}`, 'success');
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, 'Recorder check-out failed');
      setError(msg);
      showToast(msg, msg.toLowerCase().includes('face not enrolled') ? 'warning' : 'error');
    } finally {
      setLoading(false);
    }
  }

  async function doQuickCheckIn(employeeId: number) {
    if (locationLoading) return;
    const coords = lastCoords || (await requestLocation());
    if (!coords) {
      setError('Location permission is required to check in');
      return;
    }
    if (!cameraOn) {
      showToast('Please start the camera', 'warning');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const descriptorJson = await captureDescriptor();
      if (!descriptorJson) {
        setLoading(false);
        return;
      }
      const res = await recorderCheckIn(employeeId, coords.latitude, coords.longitude, descriptorJson);
      setTodayRows((p) => [res, ...(p || [])]);
      showToast(`Recorded check-in for ${res.employeeFirstName} ${res.employeeLastName}`, 'success');
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, 'Recorder check-in failed');
      setError(msg);
      showToast(msg, msg.toLowerCase().includes('face not enrolled') ? 'warning' : 'error');
    } finally {
      setLoading(false);
    }
  }

  async function doQuickCheckOut(employeeId: number) {
    if (locationLoading) return;
    const coords = lastCoords || (await requestLocation());
    if (!coords) {
      setError('Location permission is required to check out');
      return;
    }
    if (!cameraOn) {
      showToast('Please start the camera', 'warning');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const descriptorJson = await captureDescriptor();
      if (!descriptorJson) {
        setLoading(false);
        return;
      }
      const res = await recorderCheckOut(employeeId, coords.latitude, coords.longitude, descriptorJson);
      setTodayRows((p) => [res, ...(p || [])]);
      showToast(`Recorded check-out for ${res.employeeFirstName} ${res.employeeLastName}`, 'success');
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, 'Recorder check-out failed');
      setError(msg);
      showToast(msg, msg.toLowerCase().includes('face not enrolled') ? 'warning' : 'error');
    } finally {
      setLoading(false);
    }
  }

  const sidebarItems = [{ key: 'record', label: 'Recorder' }];

  if (initialLoading) {
    return (
      <AppLayout title="Recorder" sidebarItems={sidebarItems} activeSidebarKey="record" onSidebarChange={() => {}}>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Recorder" sidebarItems={sidebarItems} activeSidebarKey="record" onSidebarChange={() => {}}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">Record attendance</div>
            <div className="mt-1 text-sm text-slate-600">Select an employee and record check-in / check-out one by one. Camera image stays on-device.</div>
          </div>
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
            <button
              type="button"
              onClick={requestLocation}
              disabled={locationLoading}
              className="w-full sm:w-auto rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {locationLoading ? 'Getting location…' : 'Refresh location'}
            </button>
            <button
              type="button"
              onClick={cameraOn ? stopCamera : startCamera}
              className="w-full sm:w-auto rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {cameraOn ? 'Stop camera' : 'Start camera'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className={readiness.employee ? 'inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200' : 'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200'}>
            {readiness.employee ? 'Employee selected' : 'Select employee'}
          </span>
          <span className={readiness.location ? 'inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200' : 'inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200'}>
            {readiness.location ? 'Location ready' : 'Location required'}
          </span>
          <span className={readiness.camera ? 'inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200' : 'inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200'}>
            {readiness.camera ? 'Camera on' : 'Camera required'}
          </span>
        </div>

        {locationError ? <div className="mt-3 text-sm text-amber-700">{locationError}</div> : null}
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
        {enrollError ? <div className="mt-2 text-sm text-red-600">{enrollError}</div> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('quick')}
            className={mode === 'quick'
              ? 'rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800'
              : 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50'}
          >
            Quick record
          </button>
          <button
            type="button"
            onClick={() => setMode('single')}
            className={mode === 'single'
              ? 'rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800'
              : 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50'}
          >
            Single record
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={refresh}
            disabled={initialLoading}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Refresh list
          </button>
        </div>

        {mode === 'quick' ? (
          <div className="mt-4 rounded-lg border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">Employees (Quick record)</div>
              <div className="mt-1 text-xs text-slate-600">Use Check In / Check Out without selecting an employee first.</div>
            </div>

            <div className="p-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, code, username…"
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="px-4 pb-3">
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Camera</div>
                    <div className="mt-1 text-xs text-slate-600">Live preview used for quick In / Out verification.</div>
                  </div>
                </div>

                <div className="mt-3 overflow-hidden rounded-lg border bg-slate-950">
                  <video ref={videoRef} className="h-48 w-full object-cover" playsInline muted />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 text-left">Employee</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Last in</th>
                    <th className="px-4 py-2 text-left">Last out</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const row = todayByEmployeeId.get(emp.id) || null;
                    const inStatus = !!row?.checkInTime && !row?.checkOutTime;
                    const outStatus = !!row?.checkInTime && !!row?.checkOutTime;
                    const statusLabel = inStatus ? 'In' : outStatus ? 'Out' : 'Not In';
                    const statusClass = inStatus
                      ? 'inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200'
                      : outStatus
                        ? 'inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200'
                        : 'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200';

                    return (
                      <tr key={emp.id} className="border-t">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{emp.firstName} {emp.lastName}</div>
                          <div className="text-xs text-slate-600">{emp.employeeCode} • {emp.username}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={statusClass}>{statusLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row?.checkInTime ? new Date(row.checkInTime).toLocaleTimeString() : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row?.checkOutTime ? new Date(row.checkOutTime).toLocaleTimeString() : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => doQuickCheckIn(emp.id)}
                              disabled={loading || !cameraOn || !lastCoords || inStatus}
                              className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Check In
                            </button>
                            <button
                              type="button"
                              onClick={() => doQuickCheckOut(emp.id)}
                              disabled={loading || !cameraOn || !lastCoords || !inStatus}
                              className="rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Check Out
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!lastCoords ? <div className="px-4 py-3 text-xs text-amber-700 border-t">Location is required (tap “Refresh location”).</div> : null}
            {!cameraOn ? <div className="px-4 py-3 text-xs text-amber-700 border-t">Camera is required (tap “Start camera”).</div> : null}
          </div>
        ) : null}

        {mode === 'single' ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-900">Employee</div>
            <div className="mt-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, code, username…"
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-2 max-h-80 overflow-y-auto rounded-md border bg-white">
              {filteredEmployees.length === 0 ? (
                <div className="p-3 text-sm text-slate-600">No employees found. Try clearing search or add employees in Admin → Settings.</div>
              ) : (
                filteredEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${selectedEmployeeId === emp.id ? 'bg-emerald-50' : ''}`}
                  >
                    <div className="font-medium text-slate-900">{emp.firstName} {emp.lastName}</div>
                    <div className="text-xs text-slate-600">{emp.employeeCode} • {emp.username}</div>
                  </button>
                ))
              )}
            </div>

            {selectedEmployee ? (
              <div className="mt-3 rounded-md border bg-white p-3">
                <div className="text-xs font-medium text-slate-500">Selected employee</div>
                <div className="mt-1 font-semibold text-slate-900">{selectedEmployee.firstName} {selectedEmployee.lastName}</div>
                <div className="mt-1 text-xs text-slate-600">{selectedEmployee.employeeCode} • {selectedEmployee.username}</div>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Camera</div>
                <div className="mt-1 text-xs text-slate-600">
                  {selectedEmployee ? (
                    <>Selected: <span className="font-medium">{selectedEmployee.firstName} {selectedEmployee.lastName}</span></>
                  ) : (
                    'Select an employee'
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border bg-slate-950">
              <video ref={videoRef} className="h-64 w-full object-cover" playsInline muted />
            </div>

            <div className="mt-3 grid grid-cols-1 sm:flex sm:flex-wrap gap-2 sm:justify-end">
              <button
                type="button"
                onClick={doRecorderCheckIn}
                disabled={loading || !selectedEmployee || !cameraOn || !lastCoords}
                className="w-full sm:w-auto rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" className="text-white" />}
                Record check-in
              </button>
              <button
                type="button"
                onClick={doRecorderCheckOut}
                disabled={loading || !selectedEmployee || !cameraOn || !lastCoords}
                className="w-full sm:w-auto rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" className="text-white" />}
                Record check-out
              </button>
              <button
                type="button"
                onClick={doEnrollFace}
                disabled={enrolling || !selectedEmployee || !cameraOn}
                className="w-full sm:w-auto rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {enrolling && <LoadingSpinner size="sm" />}
                Register face
              </button>
            </div>

            {!lastCoords ? <div className="mt-2 text-xs text-amber-700">Location is required (click “Refresh location”).</div> : null}
            {!cameraOn ? <div className="mt-1 text-xs text-amber-700">Camera is required (click “Start camera”).</div> : null}
          </div>
        </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
