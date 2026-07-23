import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { getMyProfile, updateMyProfile } from '../api/employees';

import type { AttendanceResponse, EmployeeResponse } from '../api/types';
import { detectFaceInImage, detectFaceInFile } from '../utils/faceDetection';
import { getApiErrorMessage } from '../utils/error';
import { getCurrentPosition } from '../utils/geo';

function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState<'day' | 'history' | 'profile'>('day');
  const [profile, setProfile] = useState<EmployeeResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFormSaving, setProfileFormSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ mobile: '', department: '', designation: '', category: '' });
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
      const enrollResponse = await enrollFace(descriptorJson, enrollImage);
      console.log('Face enrollment response:', enrollResponse);
      setEnrollImage(null);
      stopEnrollCamera();
      setShowFaceModal(false);
      showToast('Face registered successfully! Your profile has been updated.', 'success');
      
      // Wait a moment for backend to process
      await new Promise(r => setTimeout(r, 500));
      
      // Reload profile to show updated image
      const updatedProfile = await getMyProfile();
      console.log('Updated profile after enrollment:', updatedProfile);
      setProfile(updatedProfile);
      
      // Force update image preview with cache buster
      if (updatedProfile.profileImageUrl) {
        const imageUrl = updatedProfile.profileImageUrl;
        // Add cache buster to force fresh image load
        const cacheBustedUrl = imageUrl.includes('?') 
          ? `${imageUrl}&t=${Date.now()}` 
          : `${imageUrl}?t=${Date.now()}`;
        console.log('Setting profile image preview:', cacheBustedUrl);
        setProfileImagePreview(cacheBustedUrl);
      } else {
        console.warn('No profileImageUrl in updated profile');
      }
      
      setProfileForm({
        mobile: updatedProfile.mobile || '',
        department: updatedProfile.department || '',
        designation: updatedProfile.designation || '',
        category: updatedProfile.category || '',
      });
      await refreshMe();
    } catch (e: unknown) {
      const errorMsg = getApiErrorMessage(e, 'Face registration failed');
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

  const sidebarItems = useMemo(() => {
    if (user?.role === 'ADMIN') {
      return [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'employee_nav', label: 'Employee Dashboard' },
        { key: 'recorder_nav', label: 'Recorder (Take Attendance)' },
        { key: 'hr_nav', label: 'HR Dashboard' },
        { key: 'manager_nav', label: 'Manager Dashboard' },
        { key: 'payroll_nav', label: 'Payroll Dashboard' },
        { key: 'auditor_nav', label: 'Auditor Dashboard' },
        { key: 'reports', label: 'Reports & Analytics' },
        { key: 'workforce', label: 'Workforce Plan' },
        { key: 'staff', label: 'Staff Directory' },
        { key: 'settings', label: 'Settings' },
      ];
    }
    return [
      { key: 'day', label: 'Dashboard' },
      { key: 'profile', label: 'My Profile' },
      { key: 'history', label: 'My Attendance' },
    ];
  }, [user?.role]);

  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [showFaceModal, setShowFaceModal] = useState(false);

  useEffect(() => {
    if (section !== 'profile') {
      setProfileImagePreview(null);
    }
  }, [section]);

  useEffect(() => {
    if (!profile) return;
    if (profile.profileImageUrl) {
      // Add cache buster to ensure fresh image load
      const imageUrl = profile.profileImageUrl;
      const cacheBustedUrl = imageUrl.includes('?') 
        ? `${imageUrl}&t=${Date.now()}` 
        : `${imageUrl}?t=${Date.now()}`;
      setProfileImagePreview(cacheBustedUrl);
    } else {
      setProfileImagePreview(null);
    }
  }, [profile?.id, profile?.profileImageUrl]);



  const hasFaceEnrollment = profile && (profile as unknown as { faceEnrolled?: boolean }).faceEnrolled === true;

  useEffect(() => {
    if (section !== 'profile') return;
    let cancelled = false;
    (async () => {
      setProfileLoading(true);
      try {
        const data = await getMyProfile();
        if (cancelled) return;
        setProfile(data);
        setProfileForm({
          mobile: data.mobile || '',
          department: data.department || '',
          designation: data.designation || '',
          category: data.category || '',
        });
      } catch (err: unknown) {
        if (!cancelled) showToast(getApiErrorMessage(err, 'Failed to load profile'), 'error');
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, showToast]);

  useEffect(() => {
    if (profile?.profileImageUrl) {
      setProfileImagePreview(profile.profileImageUrl);
    }
  }, [profile?.profileImageUrl]);

  async function saveProfile() {
    setProfileFormSaving(true);
    try {
      const updated = await updateMyProfile({
        mobile: profileForm.mobile,
        department: profileForm.department,
        designation: profileForm.designation,
        category: profileForm.category,
      });
      setProfile(updated);
      showToast('Profile updated', 'success');
      await refreshMe();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to update profile'), 'error');
    } finally {
      setProfileFormSaving(false);
    }
  }

  if (initialLoading) {
    return (
      <AppLayout
        title="SportClub Pro"
        sidebarItems={sidebarItems}
        activeSidebarKey={user?.role === 'ADMIN' ? 'employee_nav' : section}
        onSidebarChange={(k) => {
          if (user?.role === 'ADMIN') {
            if (k === 'employee_nav') return;
            if (k === 'recorder_nav') {
              navigate('/recorder');
              return;
            }
            if (k === 'hr_nav') {
              navigate('/hr');
              return;
            }
            if (k === 'manager_nav') {
              navigate('/manager');
              return;
            }
            if (k === 'payroll_nav') {
              navigate('/payroll');
              return;
            }
            if (k === 'auditor_nav') {
              navigate('/auditor');
              return;
            }
            navigate('/admin', { state: { section: k } });
            return;
          }
          setSection(k as typeof section);
        }}
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
      activeSidebarKey={user?.role === 'ADMIN' ? 'employee_nav' : section}
      onSidebarChange={(k) => {
        if (user?.role === 'ADMIN') {
          if (k === 'employee_nav') return;
          if (k === 'recorder_nav') {
            navigate('/recorder');
            return;
          }
          if (k === 'hr_nav') {
            navigate('/hr');
            return;
          }
          if (k === 'manager_nav') {
            navigate('/manager');
            return;
          }
          if (k === 'payroll_nav') {
            navigate('/payroll');
            return;
          }
          if (k === 'auditor_nav') {
            navigate('/auditor');
            return;
          }
          navigate('/admin', { state: { section: k } });
          return;
        }
        setSection(k as typeof section);
      }}
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

      {section === 'profile' ? (
        <div className="mt-6 space-y-6">
          {/* Profile Card */}
          <div className="rounded-xl border bg-white overflow-hidden">
            {profileLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : profile ? (
              <>
                {/* Header with background gradient */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-8 sm:px-8">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-6">
                    {/* Profile Image Card */}
                    <div className="flex flex-col items-center">
                      <div className="relative">
                        {profileImagePreview ? (
                          <div className="relative">
                            <img
                              src={profileImagePreview}
                              alt="Profile"
                              className="h-32 w-32 sm:h-40 sm:w-40 rounded-full object-cover border-4 border-white shadow-lg"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                console.error('Profile image failed to load:', profileImagePreview);
                                setProfileImagePreview(null);
                              }}
                              onLoad={() => console.log('Profile image loaded successfully:', profileImagePreview)}
                            />
                            {/* Face enrolled badge */}
                            <div className="absolute bottom-0 right-0 bg-emerald-500 rounded-full p-2 border-4 border-white shadow-lg">
                              <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-slate-600 text-5xl font-bold border-4 border-white shadow-lg">
                              {(profile.firstName || user?.username || '?').charAt(0).toUpperCase()}
                            </div>
                            {/* Not enrolled badge */}
                            <div className="absolute bottom-0 right-0 bg-amber-500 rounded-full p-2 border-4 border-white shadow-lg">
                              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2m0-14h.01M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 text-center text-white">
                        <div className="text-sm font-medium opacity-90">
                          {profileImagePreview ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-600 px-3 py-1 rounded-full text-xs">
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Face Registered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-600 px-3 py-1 rounded-full text-xs">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Not Registered
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 sm:text-left text-center">
                      <h1 className="text-2xl sm:text-3xl font-bold text-white">
                        {profile.firstName} {profile.lastName}
                      </h1>
                      <p className="mt-1 text-slate-300 text-sm">@{profile.username}</p>
                      <p className="mt-1 text-slate-300 text-sm font-medium">{profile.employeeCode}</p>
                      <div className="mt-4 flex flex-wrap gap-3 justify-center sm:justify-start">
                        <button
                          type="button"
                          onClick={() => setShowFaceModal(true)}
                          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors shadow-md"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                          {profileImagePreview ? 'Change Face' : 'Register Face'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-6 sm:p-8">
                  <h2 className="text-lg font-semibold text-slate-900 mb-6">Personal Information</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Mobile Number</label>
                      <input
                        value={profileForm.mobile}
                        onChange={(e) => setProfileForm((p) => ({ ...p, mobile: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                        placeholder="Enter mobile number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
                      <input
                        value={profileForm.department}
                        onChange={(e) => setProfileForm((p) => ({ ...p, department: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                        placeholder="Enter department"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Designation</label>
                      <input
                        value={profileForm.designation}
                        onChange={(e) => setProfileForm((p) => ({ ...p, designation: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                        placeholder="Enter designation"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                      <input
                        value={profileForm.category}
                        onChange={(e) => setProfileForm((p) => ({ ...p, category: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                        placeholder="Enter category"
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex gap-3 justify-end border-t pt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileForm({
                          mobile: profile.mobile || '',
                          department: profile.department || '',
                          designation: profile.designation || '',
                          category: profile.category || '',
                        });
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={profileFormSaving}
                      className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {profileFormSaving && <LoadingSpinner size="sm" className="text-white" />}
                      {profileFormSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-slate-600">Profile not available.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Face Registration Modal */}
      {showFaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="face-modal-title">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 border-b flex items-center justify-between">
              <div>
                <h2 id="face-modal-title" className="text-xl font-bold text-white">Register Your Face</h2>
                <p className="mt-1 text-sm text-slate-300">Update your profile with a clear, front-facing photo</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFaceModal(false);
                  stopEnrollCamera();
                  setEnrollImage(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Take Photo Option */}
                <div className="rounded-lg border-2 border-dashed border-slate-300 p-6">
                  <div className="flex flex-col items-center">
                    <svg className="h-12 w-12 text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h3 className="font-semibold text-slate-900 mb-1">Take a Photo</h3>
                    <p className="text-sm text-slate-600 text-center mb-4">Use your webcam to capture your face</p>
                    
                    {enrollCameraOn ? (
                      <div className="w-full space-y-3">
                        <video
                          ref={enrollVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full rounded-lg border-2 border-slate-300 bg-slate-900 max-h-64 object-cover"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={stopEnrollCamera}
                            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={captureEnrollPhoto}
                            className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                            Capture
                          </button>
                        </div>
                      </div>
                    ) : enrollImage ? (
                      <div className="w-full space-y-3">
                        <div className="text-sm text-emerald-600 font-medium">✓ Photo ready</div>
                        <button
                          type="button"
                          onClick={startEnrollCamera}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Take Another
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={startEnrollCamera}
                        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
                      >
                        Open Camera
                      </button>
                    )}
                  </div>
                </div>

                {/* Upload Image Option */}
                <div className="rounded-lg border-2 border-dashed border-slate-300 p-6">
                  <div className="flex flex-col items-center">
                    <svg className="h-12 w-12 text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
                    </svg>
                    <h3 className="font-semibold text-slate-900 mb-1">Upload Image</h3>
                    <p className="text-sm text-slate-600 text-center mb-4">Choose an image from your device</p>

                    {enrollImage && !enrollCameraOn ? (
                      <div className="w-full space-y-3">
                        <div className="text-sm text-emerald-600 font-medium">✓ Image ready</div>
                        <div className="text-xs text-slate-600 truncate">{enrollImage.name}</div>
                        <button
                          type="button"
                          onClick={() => enrollFileInputRef.current?.click()}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Choose Different
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => enrollFileInputRef.current?.click()}
                        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
                      >
                        Choose File
                      </button>
                    )}
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
                </div>
              </div>

              {/* Preview Section */}
              {enrollImage && !enrollCameraOn && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Preview</h3>
                  <div className="flex justify-center mb-4">
                    <img
                      src={URL.createObjectURL(enrollImage)}
                      alt="Preview"
                      className="max-h-48 rounded-lg border border-slate-300 object-cover"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-6 rounded-lg bg-red-50 border border-red-200 p-4">
                  <div className="flex gap-3">
                    <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="mt-8 flex gap-3 justify-end border-t pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowFaceModal(false);
                    stopEnrollCamera();
                    setEnrollImage(null);
                    setError(null);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={doEnrollFace}
                  disabled={loading || !enrollImage}
                  className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {loading && <LoadingSpinner size="sm" className="text-white" />}
                  {loading ? 'Registering…' : 'Register Face'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'day' ? (
      <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 sm:p-8">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Good day, {user?.username || 'Employee'}</h1>
              <p className="mt-1 text-sm text-slate-300">Check in/out with GPS and face verification.</p>
              {activeRecord && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-medium text-emerald-300">Currently checked in</span>
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
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Check in
              </button>
              <button
                type="button"
                onClick={openCheckOutModal}
                disabled={loading || !activeRecord}
                className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
              >
                {loading && <LoadingSpinner size="sm" className="text-white" />}
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-sm font-medium text-slate-300">Today's Records</div>
              <div className="mt-1 text-2xl font-bold text-white">{history.length}</div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-sm font-medium text-slate-300">Status</div>
              <div className="mt-1 text-2xl font-bold text-white">{activeRecord ? 'Checked In' : 'Not Checked In'}</div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-sm font-medium text-slate-300">Today's Hours</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {activeRecord?.workedMinutes
                  ? `${Math.floor(Number(activeRecord.workedMinutes) / 60)}h ${Number(activeRecord.workedMinutes) % 60}m`
                  : '\u2014'}
              </div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-sm font-medium text-slate-300">Last Action</div>
              <div className="mt-1 text-lg font-bold text-white truncate">
                {history.length > 0 && history[0].checkInTime
                  ? new Date(history[0].checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '\u2014'}
              </div>
            </div>
          </div>
        </div>
      </div>

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
      </>
      ) : null}

      {error && section === 'day' ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

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
