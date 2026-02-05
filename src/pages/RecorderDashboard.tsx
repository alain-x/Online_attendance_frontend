import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { listEmployees } from '../api/employees';
import { recorderCheckIn, recorderCheckOut } from '../api/attendance';
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

  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastCoords, setLastCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const selectedEmployee = useMemo(() => employees.find((e) => e.id === selectedEmployeeId) || null, [employees, selectedEmployeeId]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const haystack = [emp.employeeCode, emp.firstName, emp.lastName, emp.department || '', emp.username].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [employees, search]);

  async function refresh() {
    try {
      setInitialLoading(true);
      const data = await listEmployees();
      setEmployees(data);
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={requestLocation}
              disabled={locationLoading}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {locationLoading ? 'Getting location…' : 'Refresh location'}
            </button>
            <button
              type="button"
              onClick={cameraOn ? stopCamera : startCamera}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {cameraOn ? 'Stop camera' : 'Start camera'}
            </button>
          </div>
        </div>

        {locationError ? <div className="mt-3 text-sm text-amber-700">{locationError}</div> : null}
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}

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
                <div className="p-3 text-sm text-slate-600">No employees found.</div>
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

            <div className="mt-3 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={doRecorderCheckIn}
                disabled={loading || !selectedEmployee || !cameraOn || !lastCoords}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" className="text-white" />}
                Record check-in
              </button>
              <button
                type="button"
                onClick={doRecorderCheckOut}
                disabled={loading || !selectedEmployee || !cameraOn || !lastCoords}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" className="text-white" />}
                Record check-out
              </button>
            </div>

            {!lastCoords ? <div className="mt-2 text-xs text-amber-700">Location is required (click “Refresh location”).</div> : null}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
