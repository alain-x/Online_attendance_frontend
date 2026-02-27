import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { checkIn, checkOut, checkOutCompanyPurpose, endBreak, myAttendance, startBreak, verifyFace } from '../api/attendance';
import { enrollFace } from '../api/face';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

import type { AttendanceResponse } from '../api/types';
import { detectFaceInFile, detectFaceInImage } from '../utils/faceDetection';

function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

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
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState('day');
  const [history, setHistory] = useState<AttendanceResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastCoords, setLastCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrollImage, setEnrollImage] = useState<File | null>(null);
  const [verifyImage, setVerifyImage] = useState<File | null>(null);
  const [companyPurposeNote, setCompanyPurposeNote] = useState('');
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showCompanyPurposeModal, setShowCompanyPurposeModal] = useState(false);
  const [enrollCameraOn, setEnrollCameraOn] = useState(false);
  const enrollVideoRef = useRef<HTMLVideoElement>(null);
  const enrollStreamRef = useRef<MediaStream | null>(null);
  const enrollFileInputRef = useRef<HTMLInputElement>(null);
  const [verifyCameraOn, setVerifyCameraOn] = useState(false);
  const verifyVideoRef = useRef<HTMLVideoElement>(null);
  const verifyStreamRef = useRef<MediaStream | null>(null);
  const verifyFileInputRef = useRef<HTMLInputElement>(null);
  const [checkInCameraOn, setCheckInCameraOn] = useState(false);
  const checkInVideoRef = useRef<HTMLVideoElement>(null);
  const checkInStreamRef = useRef<MediaStream | null>(null);
  const [checkOutCameraOn, setCheckOutCameraOn] = useState(false);
  const checkOutVideoRef = useRef<HTMLVideoElement>(null);
  const checkOutStreamRef = useRef<MediaStream | null>(null);

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

  async function startEnrollCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      enrollStreamRef.current = stream;
      setEnrollCameraOn(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Camera not available';
      setError(msg);
      showToast(msg, 'error');
    }
  }

  function stopEnrollCamera() {
    if (enrollStreamRef.current) {
      enrollStreamRef.current.getTracks().forEach((t) => t.stop());
      enrollStreamRef.current = null;
    }
    if (enrollVideoRef.current) enrollVideoRef.current.srcObject = null;
    setEnrollCameraOn(false);
  }

  async function startCheckInCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      checkInStreamRef.current = stream;
      setCheckInCameraOn(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Camera not available';
      setError(msg);
      showToast(msg, 'error');
    }
  }

  function stopCheckInCamera() {
    if (checkInStreamRef.current) {
      checkInStreamRef.current.getTracks().forEach((t) => t.stop());
      checkInStreamRef.current = null;
    }
    if (checkInVideoRef.current) checkInVideoRef.current.srcObject = null;
    setCheckInCameraOn(false);
  }

  async function startCheckOutCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      checkOutStreamRef.current = stream;
      setCheckOutCameraOn(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Camera not available';
      setError(msg);
      showToast(msg, 'error');
    }
  }

  function stopCheckOutCamera() {
    if (checkOutStreamRef.current) {
      checkOutStreamRef.current.getTracks().forEach((t) => t.stop());
      checkOutStreamRef.current = null;
    }
    if (checkOutVideoRef.current) checkOutVideoRef.current.srcObject = null;
    setCheckOutCameraOn(false);
  }

  function captureEnrollPhoto() {
    const video = enrollVideoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setEnrollImage(blobToFile(blob, 'enroll-capture.jpg'));
          stopEnrollCamera();
        }
      },
      'image/jpeg',
      0.92
    );
  }

  async function doEnrollFace() {
    setError(null);
    if (!enrollImage) {
      const errorMsg = 'Please take a photo or upload an image to enroll';
      setError(errorMsg);
      showToast(errorMsg, 'warning');
      return;
    }
    setLoading(true);
    try {
      const faceResult = await detectFaceInFile(enrollImage);
      if (!faceResult.face) {
        setError('No face detected. Please use a clear front-facing photo.');
        showToast('No face detected in image', 'error');
        setLoading(false);
        return;
      }
      if (!faceResult.descriptor) {
        const msg = 'AI face models are not installed (public/models). Please install them and try enrolling again.';
        setError(msg);
        showToast(msg, 'error');
        setLoading(false);
        return;
      }
      const descriptorJson = faceResult.descriptor ? JSON.stringify(faceResult.descriptor) : undefined;
      await enrollFace(descriptorJson, enrollImage);
      setEnrollImage(null);
      showToast('Face enrolled successfully', 'success');
      await refreshMe();
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'Face enroll failed');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function startVerifyCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      verifyStreamRef.current = stream;
      setVerifyCameraOn(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Camera not available';
      setError(msg);
      showToast(msg, 'error');
    }
  }

  function stopVerifyCamera() {
    if (verifyStreamRef.current) {
      verifyStreamRef.current.getTracks().forEach((t) => t.stop());
      verifyStreamRef.current = null;
    }
    if (verifyVideoRef.current) verifyVideoRef.current.srcObject = null;
    setVerifyCameraOn(false);
  }

  function captureVerifyPhoto() {
    const video = verifyVideoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setVerifyImage(blobToFile(blob, 'verify-capture.jpg'));
          stopVerifyCamera();
        }
      },
      'image/jpeg',
      0.92
    );
  }

  useEffect(() => {
    if (!enrollCameraOn || !enrollStreamRef.current) return;
    const stream = enrollStreamRef.current;
    const video = enrollVideoRef.current;
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
  }, [enrollCameraOn]);

  useEffect(() => {
    if (!verifyCameraOn || !verifyStreamRef.current) return;
    const stream = verifyStreamRef.current;
    const video = verifyVideoRef.current;
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
  }, [verifyCameraOn]);

  useEffect(() => {
    if (!checkInCameraOn || !checkInStreamRef.current) return;
    const stream = checkInStreamRef.current;
    const video = checkInVideoRef.current;
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
  }, [checkInCameraOn]);

  useEffect(() => {
    if (!checkOutCameraOn || !checkOutStreamRef.current) return;
    const stream = checkOutStreamRef.current;
    const video = checkOutVideoRef.current;
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
  }, [checkOutCameraOn]);

  useEffect(() => {
    return () => {
      enrollStreamRef.current?.getTracks().forEach((t) => t.stop());
      enrollStreamRef.current = null;
      verifyStreamRef.current?.getTracks().forEach((t) => t.stop());
      verifyStreamRef.current = null;
      checkInStreamRef.current?.getTracks().forEach((t) => t.stop());
      checkInStreamRef.current = null;
      checkOutStreamRef.current?.getTracks().forEach((t) => t.stop());
      checkOutStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!verifyImage) return;
    if (!activeRecord) {
      const errorMsg = 'You must be checked in to verify face';
      setError(errorMsg);
      showToast(errorMsg, 'warning');
      return;
    }
    if (loading) return;
    doVerifyFace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyImage]);

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
      const faceResult = await detectFaceInFile(verifyImage);
      if (!faceResult.face) {
        setError('No face detected. Please use a clear front-facing photo.');
        showToast('No face detected in image', 'error');
        setLoading(false);
        return;
      }
      if (!faceResult.descriptor) {
        const msg = 'AI face models are not installed (public/models). Face verification requires the models.';
        setError(msg);
        showToast(msg, 'error');
        setLoading(false);
        return;
      }
      const descriptorJson = faceResult.descriptor ? JSON.stringify(faceResult.descriptor) : undefined;
      await verifyFace(verifyImage, descriptorJson);
      setVerifyImage(null);
      showToast('Face verified successfully', 'success');
      await refresh();
      await refreshMe();
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'Face verify failed');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }

  function openCheckInModal() {
    setError(null);
    setLocationError(null);
    setShowCheckInModal(true);
    requestLocation().catch(() => {});
    startCheckInCamera().catch(() => {});
  }

  function openCheckOutModal() {
    setError(null);
    setLocationError(null);
    setShowCheckOutModal(true);
    requestLocation().catch(() => {});
    startCheckOutCamera().catch(() => {});
  }

  function openCompanyPurposeModal() {
    setError(null);
    setLocationError(null);
    setCompanyPurposeNote('');
    setShowCompanyPurposeModal(true);
    requestLocation().catch(() => {});
    startCheckOutCamera().catch(() => {});
  }

  async function doCheckIn() {
    if (locationLoading) return;
    const coords = lastCoords || (await requestLocation());
    if (!coords) {
      setError('Location permission is required to check in');
      return;
    }

    const video = checkInVideoRef.current;
    if (!video) {
      showToast('Camera not ready. Please allow camera permission.', 'warning');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const faceResult = await detectFaceInImage(video);
      if (!faceResult.face) {
        setError('No face detected. Please use a clear front-facing photo.');
        showToast('No face detected in image', 'error');
        setLoading(false);
        return;
      }
      const descriptorJson = faceResult.descriptor ? JSON.stringify(faceResult.descriptor) : undefined;
      if (!descriptorJson) {
        const msg = 'AI face models are not installed (public/models). Please install them to continue.';
        setError(msg);
        showToast(msg, 'error');
        setLoading(false);
        return;
      }
      const res = await checkIn(coords.latitude, coords.longitude, descriptorJson);
      setShowCheckInModal(false);
      stopCheckInCamera();
      showToast(`Thank you, ${res.employeeFirstName}! You are checked in.`, 'success');
      await refresh();
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'Check-in failed');
      setError(errorMsg);
      if (errorMsg.toLowerCase().includes('face not enrolled')) {
        showToast('Please enroll your face first, then try checking in again.', 'warning');
      } else {
        showToast(errorMsg, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  async function doCheckOut() {
    if (locationLoading) return;
    const coords = lastCoords || (await requestLocation());
    if (!coords) {
      setError('Location permission is required to check out');
      return;
    }

    const video = checkOutVideoRef.current;
    if (!video) {
      showToast('Camera not ready. Please allow camera permission.', 'warning');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const faceResult = await detectFaceInImage(video);
      if (!faceResult.face) {
        setError('No face detected. Please use a clear front-facing photo.');
        showToast('No face detected in image', 'error');
        setLoading(false);
        return;
      }
      const descriptorJson = faceResult.descriptor ? JSON.stringify(faceResult.descriptor) : undefined;
      if (!descriptorJson) {
        const msg = 'AI face models are not installed (public/models). Please install them to continue.';
        setError(msg);
        showToast(msg, 'error');
        setLoading(false);
        return;
      }
      const res = await checkOut(coords.latitude, coords.longitude, descriptorJson);
      setShowCheckOutModal(false);
      stopCheckOutCamera();
      showToast(`Bye, ${res.employeeFirstName}! You are checked out.`, 'success');
      await refresh();
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'Check-out failed');
      setError(errorMsg);
      if (errorMsg.toLowerCase().includes('face not enrolled')) {
        showToast('Please enroll your face first, then try checking out again.', 'warning');
      } else {
        showToast(errorMsg, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  async function doCompanyPurposeCheckOut() {
    if (!companyPurposeNote.trim()) {
      showToast('Please add a note for company purpose clock-out', 'warning');
      return;
    }
    if (locationLoading) return;
    const coords = lastCoords || (await requestLocation());
    if (!coords) {
      setError('Location permission is required to check out');
      return;
    }

    const video = checkOutVideoRef.current;
    if (!video) {
      showToast('Camera not ready. Please allow camera permission.', 'warning');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const faceResult = await detectFaceInImage(video);
      if (!faceResult.face) {
        setError('No face detected. Please use a clear front-facing photo.');
        showToast('No face detected in image', 'error');
        setLoading(false);
        return;
      }
      const descriptorJson = faceResult.descriptor ? JSON.stringify(faceResult.descriptor) : undefined;
      if (!descriptorJson) {
        const msg = 'AI face models are not installed (public/models). Please install them to continue.';
        setError(msg);
        showToast(msg, 'error');
        setLoading(false);
        return;
      }
      const res = await checkOutCompanyPurpose(coords.latitude, coords.longitude, companyPurposeNote.trim(), descriptorJson);
      setShowCompanyPurposeModal(false);
      stopCheckOutCamera();
      setCompanyPurposeNote('');
      showToast(`Bye, ${res.employeeFirstName}! Your request was submitted for approval.`, 'info');
      await refresh();
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'Company purpose check-out failed');
      setError(errorMsg);
      if (errorMsg.toLowerCase().includes('face not enrolled')) {
        showToast('Please enroll your face first, then try again.', 'warning');
      } else {
        showToast(errorMsg, 'error');
      }
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

      {user?.role === 'RECORDER' ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-emerald-900">Recorder access enabled</div>
              <div className="mt-1 text-sm text-emerald-800">You can record your own attendance here, or record other employees one-by-one.</div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/recorder')}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800"
            >
              Open Recorder
            </button>
          </div>
        </div>
      ) : null}

      {showCheckInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="check-in-modal-title">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border bg-white p-5 shadow-lg">
            <h2 id="check-in-modal-title" className="text-lg font-semibold text-slate-900">Check in – verify your identity</h2>
            <p className="mt-1 text-sm text-slate-600">Take a photo that matches your enrolled face. The photo is used locally to generate a face descriptor and is not uploaded.</p>
            <div className="mt-3 text-sm">
              {locationLoading ? (
                <div className="text-slate-500">Requesting location permission…</div>
              ) : lastCoords ? (
                <div className="text-emerald-700">Location ready</div>
              ) : (
                <div className="text-amber-700">Location permission required</div>
              )}
              {locationError ? <div className="mt-1 text-xs text-red-600">{locationError}</div> : null}
            </div>
            <div className="mt-4">
              <div className="overflow-hidden rounded-lg border bg-slate-950">
                <video ref={checkInVideoRef} className="h-56 w-full object-cover" playsInline muted />
              </div>
              {!checkInCameraOn ? (
                <div className="mt-2 text-sm text-amber-700">Camera is off. Click "Turn on camera".</div>
              ) : (
                <div className="mt-2 text-sm text-slate-600">Center your face and keep it still.</div>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  stopCheckInCamera();
                  setShowCheckInModal(false);
                }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startCheckInCamera}
                disabled={loading || checkInCameraOn}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Turn on camera
              </button>
              <button
                type="button"
                onClick={doCheckIn}
                disabled={loading || locationLoading || !lastCoords || !checkInCameraOn}
                className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" className="text-white" />}
                Capture & Check in
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompanyPurposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="company-purpose-modal-title">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border bg-white p-5 shadow-lg">
            <h2 id="company-purpose-modal-title" className="text-lg font-semibold text-slate-900">Company purpose clock-out</h2>
            <p className="mt-1 text-sm text-slate-600">Add a note explaining why you are leaving for company purpose. This request requires approval to count as paid hours.</p>

            <div className="mt-3 text-sm">
              {locationLoading ? (
                <div className="text-slate-500">Requesting location permission…</div>
              ) : lastCoords ? (
                <div className="text-emerald-700">Location ready</div>
              ) : (
                <div className="text-amber-700">Location permission required</div>
              )}
              {locationError ? <div className="mt-1 text-xs text-red-600">{locationError}</div> : null}
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">Note</label>
              <textarea
                value={companyPurposeNote}
                onChange={(e) => setCompanyPurposeNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900"
                placeholder="Example: Client visit / bank / delivery / offsite meeting"
              />
            </div>

            <div className="mt-4">
              <div className="overflow-hidden rounded-lg border bg-slate-950">
                <video ref={checkOutVideoRef} className="h-56 w-full object-cover" playsInline muted />
              </div>
              {!checkOutCameraOn ? (
                <div className="mt-2 text-sm text-amber-700">Camera is off. Click "Turn on camera".</div>
              ) : (
                <div className="mt-2 text-sm text-slate-600">Center your face and keep it still.</div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  stopCheckOutCamera();
                  setShowCompanyPurposeModal(false);
                  setCompanyPurposeNote('');
                }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startCheckOutCamera}
                disabled={loading || checkOutCameraOn}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Turn on camera
              </button>
              <button
                type="button"
                onClick={doCompanyPurposeCheckOut}
                disabled={loading || locationLoading || !lastCoords || !checkOutCameraOn || !companyPurposeNote.trim()}
                className="rounded-md bg-rose-600 px-4 py-2 text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" className="text-white" />}
                Capture & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="check-out-modal-title">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border bg-white p-5 shadow-lg">
            <h2 id="check-out-modal-title" className="text-lg font-semibold text-slate-900">Check out – verify your identity</h2>
            <p className="mt-1 text-sm text-slate-600">Take a photo that matches your enrolled face. The photo is used locally to generate a face descriptor and is not uploaded.</p>
            <div className="mt-3 text-sm">
              {locationLoading ? (
                <div className="text-slate-500">Requesting location permission…</div>
              ) : lastCoords ? (
                <div className="text-emerald-700">Location ready</div>
              ) : (
                <div className="text-amber-700">Location permission required</div>
              )}
              {locationError ? <div className="mt-1 text-xs text-red-600">{locationError}</div> : null}
            </div>
            <div className="mt-4">
              <div className="overflow-hidden rounded-lg border bg-slate-950">
                <video ref={checkOutVideoRef} className="h-56 w-full object-cover" playsInline muted />
              </div>
              {!checkOutCameraOn ? (
                <div className="mt-2 text-sm text-amber-700">Camera is off. Click "Turn on camera".</div>
              ) : (
                <div className="mt-2 text-sm text-slate-600">Center your face and keep it still.</div>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  stopCheckOutCamera();
                  setShowCheckOutModal(false);
                }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startCheckOutCamera}
                disabled={loading || checkOutCameraOn}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Turn on camera
              </button>
              <button
                type="button"
                onClick={doCheckOut}
                disabled={loading || locationLoading || !lastCoords || !checkOutCameraOn}
                className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" className="text-white" />}
                Capture & Check out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-slate-900">Employee Dashboard</div>
          <div className="mt-1 text-sm text-slate-600">Check in/out with GPS and required photo verification (must match enrolled face).</div>
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
            onClick={openCheckInModal}
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
            onClick={openCheckOutModal}
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
            onClick={openCompanyPurposeModal}
            disabled={loading || !activeRecord}
            className="rounded-md bg-rose-600 px-4 py-2 text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
          >
            {loading && <LoadingSpinner size="sm" className="text-white" />}
            Company purpose
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
              <div className="mt-2 text-sm text-slate-600">Take a photo or upload an image. Use a clear front-facing photo.</div>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={enrollCameraOn ? stopEnrollCamera : startEnrollCamera}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
                  >
                    {enrollCameraOn ? 'Cancel camera' : 'Take photo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => enrollFileInputRef.current?.click()}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
                  >
                    Upload image
                  </button>
                  <input
                    ref={enrollFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setEnrollImage(f);
                      e.target.value = '';
                    }}
                  />
                </div>
                {enrollCameraOn ? (
                  <div className="space-y-2">
                    <video
                      ref={enrollVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="max-h-48 w-full rounded-lg border bg-slate-900 object-cover"
                    />
                    <button
                      type="button"
                      onClick={captureEnrollPhoto}
                      className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                    >
                      Capture
                    </button>
                  </div>
                ) : null}
                {enrollImage && !enrollCameraOn ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">{enrollImage.name}</span>
                    <button
                      type="button"
                      onClick={() => setEnrollImage(null)}
                      className="text-sm text-slate-500 underline hover:text-slate-700"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
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
              <div className="mt-2 text-sm text-slate-600">Take a photo or upload an image during an active check-in.</div>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={verifyCameraOn ? stopVerifyCamera : startVerifyCamera}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
                  >
                    {verifyCameraOn ? 'Cancel camera' : 'Take photo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => verifyFileInputRef.current?.click()}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
                  >
                    Upload image
                  </button>
                  <input
                    ref={verifyFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setVerifyImage(f);
                      e.target.value = '';
                    }}
                  />
                </div>
                {verifyCameraOn ? (
                  <div className="space-y-2">
                    <video
                      ref={verifyVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="max-h-48 w-full rounded-lg border bg-slate-900 object-cover"
                    />
                    <button
                      type="button"
                      onClick={captureVerifyPhoto}
                      className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                    >
                      Capture
                    </button>
                  </div>
                ) : null}
                {verifyImage && !verifyCameraOn ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">{verifyImage.name}</span>
                    <button
                      type="button"
                      onClick={() => setVerifyImage(null)}
                      className="text-sm text-slate-500 underline hover:text-slate-700"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={doVerifyFace}
                  disabled={loading || !activeRecord || !verifyImage}
                  className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Verify face
                </button>
                {!activeRecord ? (
                  <div className="text-sm text-slate-500">Check in first to verify.</div>
                ) : !verifyImage ? (
                  <div className="text-sm text-slate-500">Take or upload a photo to verify.</div>
                ) : loading ? (
                  <div className="text-sm text-slate-500">Verifying…</div>
                ) : null}
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
            <table className="w-full min-w-[720px] text-sm">
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
