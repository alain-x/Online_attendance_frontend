import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout';
import { checkIn, checkOut, endBreak, myAttendance, startBreak, verifyFace } from '../api/attendance';
import { enrollFace } from '../api/face';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';

import type { AttendanceResponse } from '../api/types';
import { detectFaceInFile } from '../utils/faceDetection';

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
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState('day');
  const [history, setHistory] = useState<AttendanceResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollImage, setEnrollImage] = useState<File | null>(null);
  const [verifyImage, setVerifyImage] = useState<File | null>(null);
  const [checkInImage, setCheckInImage] = useState<File | null>(null);
  const [checkOutImage, setCheckOutImage] = useState<File | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [enrollCameraOn, setEnrollCameraOn] = useState(false);
  const enrollVideoRef = useRef<HTMLVideoElement>(null);
  const enrollStreamRef = useRef<MediaStream | null>(null);
  const enrollFileInputRef = useRef<HTMLInputElement>(null);
  const [verifyCameraOn, setVerifyCameraOn] = useState(false);
  const verifyVideoRef = useRef<HTMLVideoElement>(null);
  const verifyStreamRef = useRef<MediaStream | null>(null);
  const verifyFileInputRef = useRef<HTMLInputElement>(null);

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
      const descriptorJson = faceResult.descriptor ? JSON.stringify(faceResult.descriptor) : undefined;
      await enrollFace(enrollImage, descriptorJson);
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
    return () => {
      enrollStreamRef.current?.getTracks().forEach((t) => t.stop());
      enrollStreamRef.current = null;
      verifyStreamRef.current?.getTracks().forEach((t) => t.stop());
      verifyStreamRef.current = null;
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
      const descriptorJson = faceResult.descriptor ? JSON.stringify(faceResult.descriptor) : undefined;
      await verifyFace(verifyImage, descriptorJson);
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

  function openCheckInModal() {
    setError(null);
    setCheckInImage(null);
    setShowCheckInModal(true);
  }

  function openCheckOutModal() {
    setError(null);
    setCheckOutImage(null);
    setShowCheckOutModal(true);
  }

  async function doCheckIn() {
    if (!checkInImage) {
      showToast('Please take or choose a photo to verify your identity', 'warning');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const faceResult = await detectFaceInFile(checkInImage);
      if (!faceResult.face) {
        setError('No face detected. Please use a clear front-facing photo.');
        showToast('No face detected in image', 'error');
        setLoading(false);
        return;
      }
      const descriptorJson = faceResult.descriptor ? JSON.stringify(faceResult.descriptor) : undefined;
      const pos = await getCurrentPosition();
      await checkIn(checkInImage, pos.coords.latitude, pos.coords.longitude, descriptorJson);
      setShowCheckInModal(false);
      setCheckInImage(null);
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
    if (!checkOutImage) {
      showToast('Please take or choose a photo to verify your identity', 'warning');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const faceResult = await detectFaceInFile(checkOutImage);
      if (!faceResult.face) {
        setError('No face detected. Please use a clear front-facing photo.');
        showToast('No face detected in image', 'error');
        setLoading(false);
        return;
      }
      const descriptorJson = faceResult.descriptor ? JSON.stringify(faceResult.descriptor) : undefined;
      const pos = await getCurrentPosition();
      await checkOut(checkOutImage, pos.coords.latitude, pos.coords.longitude, descriptorJson);
      setShowCheckOutModal(false);
      setCheckOutImage(null);
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

      {showCheckInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="check-in-modal-title">
          <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-lg">
            <h2 id="check-in-modal-title" className="text-lg font-semibold text-slate-900">Check in – verify your identity</h2>
            <p className="mt-1 text-sm text-slate-600">Take or upload a photo that matches your enrolled face. It will be verified before check-in.</p>
            <div className="mt-4">
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => setCheckInImage(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-emerald-700"
              />
              {checkInImage && (
                <p className="mt-2 text-sm text-emerald-600">Photo selected: {checkInImage.name}</p>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowCheckInModal(false); setCheckInImage(null); }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doCheckIn}
                disabled={loading || !checkInImage}
                className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" className="text-white" />}
                Check in
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="check-out-modal-title">
          <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-lg">
            <h2 id="check-out-modal-title" className="text-lg font-semibold text-slate-900">Check out – verify your identity</h2>
            <p className="mt-1 text-sm text-slate-600">Take or upload a photo that matches your enrolled face. It will be verified before check-out.</p>
            <div className="mt-4">
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => setCheckOutImage(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-indigo-700"
              />
              {checkOutImage && (
                <p className="mt-2 text-sm text-indigo-600">Photo selected: {checkOutImage.name}</p>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowCheckOutModal(false); setCheckOutImage(null); }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doCheckOut}
                disabled={loading || !checkOutImage}
                className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" className="text-white" />}
                Check out
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
