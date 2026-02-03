import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import { createCompany, deleteCompany, listCompanies, updateCompany, uploadCompanyLogo } from '../api/companies';
import { createEmployee, deleteEmployee, listEmployees, updateEmployee } from '../api/employees';
import { createLocation, deleteLocation, listLocations, updateLocation } from '../api/locations';
import { adminCreateAttendance, adminDeleteAttendance, adminUpdateAttendance, listAttendanceByEmployee, todayAttendance } from '../api/attendance';
import { createUser, deleteUser, listUsers, updateUser } from '../api/users';
import { getDayAnalytics, getHomeAnalytics, getTimesheet } from '../api/analytics';
import { downloadDailyAttendanceCsv } from '../api/reports';
import { useAuth } from '../auth/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';

import type {
  AttendanceResponse,
  AttendanceStatus,
  AdminUpsertAttendanceRequest,
  Company,
  CreateCompanyRequest,
  CreateEmployeeRequest,
  CreateUserRequest,
  EmployeeResponse,
  DayAttendanceResponse,
  HomeAnalyticsResponse,
  Role,
  TimesheetResponse,
  UpdateCompanyRequest,
  UpdateEmployeeRequest,
  UpdateUserRequest,
  UserResponse,
  WorkLocation,
} from '../api/types';

type ReportItem = {
  key: string;
  title: string;
  description: string;
  format: string;
};

function getMonthRangeLabel(year: number, month1Based: number): string {
  const from = new Date(Date.UTC(year, month1Based - 1, 1));
  const to = new Date(Date.UTC(year, month1Based, 0));
  const fmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return `${fmt.format(from)} - ${fmt.format(to)}`;
}

function minutesToHourMinute(mins: number): { h: number; m: number } {
  const n = Number(mins || 0);
  const h = Math.floor(n / 60);
  const m = n % 60;
  return { h, m };
}

function utcDateString(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message || fallback;
}

type TabButtonProps = {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
};

function TabButton({ active, children, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white'
          : 'rounded-md bg-white px-3 py-1.5 text-sm text-slate-700 border hover:bg-slate-50'
      }
    >
      {children}
    </button>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState('dashboard');
  const [dashboardTab, setDashboardTab] = useState('home');

  const companyLogoLetter = (user?.companySlug || 'A').trim().charAt(0).toUpperCase();
  const companyLogoUrl = user?.companyLogoUrl || null;

  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getUTCFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getUTCMonth() + 1);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedRoleScope, setSelectedRoleScope] = useState<'ALL' | 'MANAGERS'>('ALL');

  const [dayDate, setDayDate] = useState<string>(() => utcDateString(new Date()));
  const [dayAnalytics, setDayAnalytics] = useState<DayAttendanceResponse | null>(null);
  const [dayAnalyticsLoading, setDayAnalyticsLoading] = useState(false);

  const [timesheet, setTimesheet] = useState<TimesheetResponse | null>(null);
  const [timesheetLoading, setTimesheetLoading] = useState(false);

  const [expandedReportKey, setExpandedReportKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'ALL' | 'IN' | 'OUT' | 'NOT_IN'>('ALL');
  const [staffSearch, setStaffSearch] = useState('');

  type ChatMessage = {
    id: string;
    from: 'user' | 'support';
    text: string;
    ts: number;
  };

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      from: 'support',
      text: 'Hi! How can we help you today?',
      ts: Date.now(),
    },
  ]);

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text) return;

    const now = Date.now();
    setChatMessages((prev) => [
      ...prev,
      {
        id: `u_${now}`,
        from: 'user',
        text,
        ts: now,
      },
    ]);
    setChatInput('');

    window.setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `s_${Date.now()}`,
          from: 'support',
          text: 'Thanks — we received your message. A support agent will reply soon.',
          ts: Date.now(),
        },
      ]);
    }, 600);
  };

  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [attendance, setAttendance] = useState<AttendanceResponse[]>([]);
  const [users, setUsers] = useState<(UserResponse & { newPassword?: string })[]>([]);

  const filteredEmployees = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return employees;

    return employees.filter((emp) => {
      const haystack = [
        emp.employeeCode,
        emp.firstName,
        emp.lastName,
        emp.mobile,
        emp.designation,
        emp.department,
        emp.category,
        emp.username,
        emp.role,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [employees, staffSearch]);

  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [employeeModalMode, setEmployeeModalMode] = useState<'create' | 'edit'>('create');
  const [employeeEditTarget, setEmployeeEditTarget] = useState<EmployeeResponse | null>(null);
  const [employeeModalPassword, setEmployeeModalPassword] = useState('');

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedEmployeeAttendance, setSelectedEmployeeAttendance] = useState<AttendanceResponse[]>([]);
  const [employeeAttendanceLoading, setEmployeeAttendanceLoading] = useState(false);

  const [attendanceUpsert, setAttendanceUpsert] = useState<AdminUpsertAttendanceRequest>({});
  const [attendanceUpsertBusy, setAttendanceUpsertBusy] = useState(false);
  const [editingAttendanceId, setEditingAttendanceId] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [homeAnalytics, setHomeAnalytics] = useState<HomeAnalyticsResponse | null>(null);

  useEffect(() => {
    if (section !== 'dashboard') return;
    if (dashboardTab !== 'day') return;

    let cancelled = false;
    setDayAnalyticsLoading(true);
    getDayAnalytics({
      date: dayDate,
      department: selectedDepartment,
      roleScope: selectedRoleScope,
      search,
    })
      .then((data) => {
        if (!cancelled) setDayAnalytics(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          showToast(getApiErrorMessage(err, 'Failed to load day analytics'), 'error');
          setDayAnalytics(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDayAnalyticsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dashboardTab, dayDate, search, section, selectedDepartment, selectedRoleScope, showToast]);

  useEffect(() => {
    if (section !== 'dashboard') return;
    if (dashboardTab !== 'timesheet') return;

    let cancelled = false;
    setTimesheetLoading(true);
    getTimesheet({
      year: selectedYear,
      month: selectedMonth,
      department: selectedDepartment,
      roleScope: selectedRoleScope,
      search,
    })
      .then((data) => {
        if (!cancelled) setTimesheet(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          showToast(getApiErrorMessage(err, 'Failed to load timesheet'), 'error');
          setTimesheet(null);
        }
      })
      .finally(() => {
        if (!cancelled) setTimesheetLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dashboardTab, search, section, selectedDepartment, selectedMonth, selectedRoleScope, selectedYear, showToast]);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [branchForm, setBranchForm] = useState<{ name: string; slug: string; logoUrl: string; asBranch: boolean }>({ name: '', slug: '', logoUrl: '', asBranch: true });
  const [branchFormBusy, setBranchFormBusy] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editCompanyForm, setEditCompanyForm] = useState<{ name: string; slug: string; logoUrl: string; hourlyRateDefault: string }>({ name: '', slug: '', logoUrl: '', hourlyRateDefault: '' });
  const [editCompanyBusy, setEditCompanyBusy] = useState(false);
  const [editCompanyLogoFile, setEditCompanyLogoFile] = useState<File | null>(null);
  const [editCompanyLogoBusy, setEditCompanyLogoBusy] = useState(false);
  const [deleteCompanyId, setDeleteCompanyId] = useState<number | null>(null);
  const [deleteCompanyBusy, setDeleteCompanyBusy] = useState(false);

  const reportItems = useMemo<ReportItem[]>(
    () => [
      {
        key: 'daily_attendance',
        title: 'Daily Attendance Summary',
        description: 'Attendance status by employee for a selected day.',
        format: 'CSV',
      },
      {
        key: 'late_arrivals',
        title: 'Late Arrivals',
        description: 'Employees who checked-in after shift start (placeholder).',
        format: 'CSV',
      },
      {
        key: 'overtime',
        title: 'Overtime Summary',
        description: 'Overtime hours by employee (placeholder).',
        format: 'CSV',
      },
      {
        key: 'absences',
        title: 'Absence Report',
        description: 'Missing check-in for a given date range (placeholder).',
        format: 'CSV',
      },
    ],
    []
  );

  async function downloadReport(item: ReportItem) {
    try {
      if (item.key === 'daily_attendance') {
        // default: today (UTC date on server side)
        await downloadDailyAttendanceCsv();
        showToast('Daily attendance report downloaded', 'success');
        return;
      }

      showToast('This report will be enabled next (API not connected yet).', 'info');
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to download report'), 'error');
    }
  }

  const [newEmployee, setNewEmployee] = useState<CreateEmployeeRequest>({
    employeeCode: '',
    firstName: '',
    lastName: '',
    department: '',
    mobile: '',
    designation: '',
    category: '',
    username: '',
    password: '',
    role: 'EMPLOYEE',
    hourlyRateOverride: null,
  });

  const [newEmployeeCompanyId, setNewEmployeeCompanyId] = useState<number | null>(null);

  const [newLocation, setNewLocation] = useState({
    name: '',
    latitude: 0,
    longitude: 0,
    radiusMeters: 100,
    active: true,
  });

  const [geofenceSite, setGeofenceSite] = useState<string>('ALL');
  const [geofenceSearch, setGeofenceSearch] = useState<string>('');
  const [showGeofenceForm, setShowGeofenceForm] = useState(false);

  const [newUser, setNewUser] = useState<Pick<CreateUserRequest, 'username' | 'password' | 'role'> & { enabled: boolean }>({
    username: '',
    password: '',
    role: 'EMPLOYEE',
    enabled: true,
  });

  const roleOptions = useMemo<Role[]>(() => ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'], []);
  const userRoleOptions = useMemo<Role[]>(() => ['SYSTEM_ADMIN', 'ADMIN', 'HR', 'MANAGER', 'EMPLOYEE', 'PAYROLL', 'AUDITOR'], []);
  const canManage = user && (user.role === 'ADMIN' || user.role === 'HR');
  const canManageUsers = user && (user.role === 'SYSTEM_ADMIN' || user.role === 'ADMIN');

  const isOwnerAdmin = user?.role === 'ADMIN' && user?.companyId != null;

  const [companyContextId, setCompanyContextId] = useState<number | null>(() => {
    const raw = localStorage.getItem('companyContextId');
    if (!raw) return null;
    const n = Number(raw);
    if (Number.isNaN(n) || n <= 0) return null;
    return n;
  });

  const currentCompany = useMemo(() => {
    if (!user?.companyId) return null;
    return companies.find((c) => c.id === user.companyId) || null;
  }, [companies, user?.companyId]);

  const viewableCompanies = useMemo(() => {
    if (!user?.companyId) return [] as Company[];
    // Owner admin can view their own company and its direct branches.
    const list = companies.filter((c) => c.id === user.companyId || c.parentCompanyId === user.companyId);
    // Always ensure current company is present even if companies list isn't loaded yet.
    return list;
  }, [companies, user?.companyId]);

  const effectiveCompanyId = useMemo(() => {
    if (!user?.companyId) return null;
    if (!companyContextId) return user.companyId;
    const allowed = viewableCompanies.some((c) => c.id === companyContextId);
    return allowed ? companyContextId : user.companyId;
  }, [companyContextId, user?.companyId, viewableCompanies]);

  const workforceDays = useMemo(() => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], []);
  const workforcePeople = useMemo(
    () => [
      { id: 'p1', name: 'Employee A', dept: 'Operations' },
      { id: 'p2', name: 'Employee B', dept: 'Sales' },
      { id: 'p3', name: 'Employee C', dept: 'HR' },
      { id: 'p4', name: 'Employee D', dept: 'IT' },
    ],
    []
  );

  const uniqueAttendance = useMemo(() => {
    const seen = new Set<number>();
    const result: AttendanceResponse[] = [];
    for (const r of attendance) {
      if (seen.has(r.employeeId)) continue;
      seen.add(r.employeeId);
      result.push(r);
    }
    return result;
  }, [attendance]);

  const dashboardStats = useMemo(() => {
    const totalStaff = employees.length;
    const present = uniqueAttendance.filter((r) => !!r.checkInTime).length;
    const notIn = Math.max(0, totalStaff - present);
    const holidays = 0;
    const weeklyOff = 0;

    const totalWorkedMinutesDay = uniqueAttendance.reduce((sum, r) => sum + Number(r.workedMinutes || 0), 0);
    const totalOvertimeMinutesDay = uniqueAttendance.reduce((sum, r) => {
      const worked = Number(r.workedMinutes || 0);
      const extra = worked - 8 * 60;
      return sum + Math.max(0, extra);
    }, 0);

    return { totalStaff, present, notIn, holidays, weeklyOff, totalWorkedMinutesDay, totalOvertimeMinutesDay };
  }, [employees, uniqueAttendance]);

  const effectiveHome = homeAnalytics
    ? {
        totalStaff: homeAnalytics.totalStaff ?? dashboardStats.totalStaff,
        presentToday: homeAnalytics.presentToday ?? dashboardStats.present,
        checkedOutToday: homeAnalytics.checkedOutToday ?? 0,
        notInToday: homeAnalytics.notInToday ?? dashboardStats.notIn,
        locationNotVerifiedToday: homeAnalytics.locationNotVerifiedToday ?? 0,
        faceNotVerifiedToday: homeAnalytics.faceNotVerifiedToday ?? 0,
        workedMinutesMonth: homeAnalytics.workedMinutesMonth ?? 0,
        overtimeMinutesMonth: homeAnalytics.overtimeMinutesMonth ?? 0,
        monthClockIns: homeAnalytics.monthClockIns || [],
      }
    : {
        totalStaff: dashboardStats.totalStaff,
        presentToday: dashboardStats.present,
        checkedOutToday: 0,
        notInToday: dashboardStats.notIn,
        locationNotVerifiedToday: 0,
        faceNotVerifiedToday: 0,
        workedMinutesMonth: 0,
        overtimeMinutesMonth: 0,
        monthClockIns: [],
      };

  const workedMonthDisplay = useMemo(() => {
    const mins = Number(effectiveHome.workedMinutesMonth || 0);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return { h, m };
  }, [effectiveHome.workedMinutesMonth]);

  const overtimeMonthDisplay = useMemo(() => {
    const mins = Number(effectiveHome.overtimeMinutesMonth || 0);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return { h, m };
  }, [effectiveHome.overtimeMinutesMonth]);

  const employeeById = useMemo(() => {
    const map = new Map<number, EmployeeResponse>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      const d = (e.department || '').trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filteredAttendance = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    const base = uniqueAttendance.filter((r) => {
      const emp = employeeById.get(r.employeeId);
      if (selectedDepartment !== 'ALL') {
        const dep = (emp?.department || '').trim();
        if (dep !== selectedDepartment) return false;
      }
      if (selectedRoleScope === 'MANAGERS') {
        if (emp?.role !== 'MANAGER') return false;
      }

      if (attendanceStatusFilter === 'ALL') return true;
      const inStatus = !!r.checkInTime && !r.checkOutTime;
      const checkedOut = !!r.checkInTime && !!r.checkOutTime;
      if (attendanceStatusFilter === 'IN') return inStatus;
      if (attendanceStatusFilter === 'OUT') return checkedOut;
      if (attendanceStatusFilter === 'NOT_IN') return !r.checkInTime;
      return true;
    });

    if (!q) return base;
    return base.filter((r) => {
      const name = `${r.employeeCode || ''} ${r.employeeFirstName || ''} ${r.employeeLastName || ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [attendanceStatusFilter, employeeById, search, selectedDepartment, selectedRoleScope, uniqueAttendance]);

  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return employeeById.get(selectedEmployeeId) || null;
  }, [employeeById, selectedEmployeeId]);

  async function openEmployeeAttendance(employeeId: number) {
    setSelectedEmployeeId(employeeId);
    setEmployeeAttendanceLoading(true);
    try {
      const rows = await listAttendanceByEmployee(employeeId);
      setSelectedEmployeeAttendance(rows);
      setEditingAttendanceId(null);
      setAttendanceUpsert({ employeeId });
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load employee attendance'), 'error');
      setSelectedEmployeeAttendance([]);
    } finally {
      setEmployeeAttendanceLoading(false);
    }
  }

  function closeEmployeeAttendance() {
    setSelectedEmployeeId(null);
    setSelectedEmployeeAttendance([]);
    setEmployeeAttendanceLoading(false);
    setEditingAttendanceId(null);
    setAttendanceUpsert({});
  }

  function toDatetimeLocalValue(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function datetimeLocalToIso(value: string): string | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function submitAttendanceUpsert() {
    if (!selectedEmployeeId) return;
    setAttendanceUpsertBusy(true);
    try {
      const payload: AdminUpsertAttendanceRequest = {
        ...attendanceUpsert,
        employeeId: selectedEmployeeId,
      };

      if (editingAttendanceId) {
        await adminUpdateAttendance(editingAttendanceId, payload);
        showToast('Attendance updated', 'success');
      } else {
        await adminCreateAttendance(payload);
        showToast('Attendance created', 'success');
      }

      const rows = await listAttendanceByEmployee(selectedEmployeeId);
      setSelectedEmployeeAttendance(rows);
      await refreshAll();

      setEditingAttendanceId(null);
      setAttendanceUpsert({ employeeId: selectedEmployeeId });
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to save attendance'), 'error');
    } finally {
      setAttendanceUpsertBusy(false);
    }
  }

  function startEditAttendance(x: AttendanceResponse) {
    setEditingAttendanceId(x.id);
    setAttendanceUpsert({
      employeeId: x.employeeId,
      checkInTime: x.checkInTime,
      checkOutTime: x.checkOutTime,
      checkInLat: x.checkInLat,
      checkInLng: x.checkInLng,
      checkOutLat: x.checkOutLat,
      checkOutLng: x.checkOutLng,
      locationVerified: x.locationVerified,
      faceVerified: x.faceVerified,
      status: x.status,
    });
  }

  async function deleteAttendance(id: number) {
    if (!selectedEmployeeId) return;
    setAttendanceUpsertBusy(true);
    try {
      await adminDeleteAttendance(id);
      showToast('Attendance deleted', 'success');
      const rows = await listAttendanceByEmployee(selectedEmployeeId);
      setSelectedEmployeeAttendance(rows);
      await refreshAll();
      if (editingAttendanceId === id) {
        setEditingAttendanceId(null);
        setAttendanceUpsert({ employeeId: selectedEmployeeId });
      }
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to delete attendance'), 'error');
    } finally {
      setAttendanceUpsertBusy(false);
    }
  }

  async function refreshAll() {
    try {
      setLoading(true);
      const [e, l, a] = await Promise.all([listEmployees(), listLocations(), todayAttendance()]);
      setEmployees(e);
      setLocations(l);
      setAttendance(a);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load data'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function refreshHomeAnalytics(year: number, month: number) {
    try {
      const data = await getHomeAnalytics(year, month);
      setHomeAnalytics(data);
    } catch (e) {
      // keep analytics optional; table CRUD should continue working
    }
  }

  async function refreshUsers() {
    if (!canManageUsers) {
      setUsers([]);
      return;
    }
    const u = await listUsers();
    setUsers(u);
  }

  useEffect(() => {
    refreshAll();
    refreshUsers();
    refreshHomeAnalytics(selectedYear, selectedMonth);
  }, []);

  useEffect(() => {
    if (!isOwnerAdmin) {
      localStorage.removeItem('companyContextId');
      setCompanyContextId(null);
      return;
    }
    // Owner admins need companies list available for branch selector.
    refreshCompanies();
  }, [isOwnerAdmin]);

  useEffect(() => {
    if (!user?.companyId) return;
    if (!isOwnerAdmin) return;
    // Persist selected company context. If selecting own company, clear override.
    if (effectiveCompanyId && effectiveCompanyId !== user.companyId) {
      localStorage.setItem('companyContextId', String(effectiveCompanyId));
      const selected = viewableCompanies.find((c) => c.id === effectiveCompanyId) || null;
      if (selected) {
        localStorage.setItem('companyContextLabel', `${selected.name} (${selected.slug})`);
      } else {
        localStorage.setItem('companyContextLabel', String(effectiveCompanyId));
      }
    } else {
      localStorage.removeItem('companyContextId');
      localStorage.removeItem('companyContextLabel');
    }
    // Reload data so all filters reflect the selected company.
    refreshAll();
    refreshUsers();
    refreshHomeAnalytics(selectedYear, selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCompanyId]);

  useEffect(() => {
    if (!isOwnerAdmin) {
      setNewEmployeeCompanyId(null);
      return;
    }
    // default employee creation to whatever company is currently being viewed
    setNewEmployeeCompanyId(effectiveCompanyId);
  }, [effectiveCompanyId, isOwnerAdmin]);

  useEffect(() => {
    refreshHomeAnalytics(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    if (section === 'settings') {
      refreshUsers();
    }
  }, [section]);

  async function refreshCompanies() {
    setCompaniesLoading(true);
    try {
      const list = await listCompanies();
      setCompanies(list);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load companies'), 'error');
    } finally {
      setCompaniesLoading(false);
    }
  }

  useEffect(() => {
    if (section === 'companies') {
      refreshCompanies();
    }
  }, [section]);

  async function onCreateEmployee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const employeeUsername = (newEmployee.username || '').trim();
    if (employeeUsername) {
      const uname = employeeUsername.toLowerCase();
      const existsInEmployees = employees.some((x) => (x.username || '').trim().toLowerCase() === uname);
      const existsInUsers = users.some((x) => (x.username || '').trim().toLowerCase() === uname);
      if (existsInEmployees || existsInUsers) {
        const msg = 'Username already exists';
        setError(msg);
        showToast(msg, 'error');
        return;
      }
    }

    setBusy(true);
    try {
      await createEmployee(newEmployee, isOwnerAdmin ? newEmployeeCompanyId : undefined);
      setNewEmployee({
        employeeCode: '',
        firstName: '',
        lastName: '',
        department: '',
        mobile: '',
        designation: '',
        category: '',
        username: '',
        password: '',
        role: 'EMPLOYEE',
        hourlyRateOverride: null,
      });
      showToast('Employee created successfully', 'success');
      await refreshAll();
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to create employee');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setBusy(false);
    }
  }

  function openCreateEmployeeModal() {
    setEmployeeModalMode('create');
    setEmployeeEditTarget(null);
    setEmployeeModalPassword('');
    setNewEmployee({
      employeeCode: '',
      firstName: '',
      lastName: '',
      department: '',
      mobile: '',
      designation: '',
      category: '',
      username: '',
      password: '',
      role: 'EMPLOYEE',
      hourlyRateOverride: null,
    });
    setEmployeeModalOpen(true);
  }

  function openEditEmployeeModal(emp: EmployeeResponse) {
    setEmployeeModalMode('edit');
    setEmployeeEditTarget(emp);
    setEmployeeModalPassword('');
    setNewEmployee({
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      department: emp.department || '',
      mobile: emp.mobile || '',
      designation: emp.designation || '',
      category: emp.category || '',
      username: emp.username,
      password: '',
      role: emp.role,
      hourlyRateOverride: emp.hourlyRateOverride != null ? emp.hourlyRateOverride : null,
    });
    setEmployeeModalOpen(true);
  }

  async function submitEmployeeModal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (employeeModalMode === 'create') {
        const employeeUsername = (newEmployee.username || '').trim();
        if (employeeUsername) {
          const uname = employeeUsername.toLowerCase();
          const existsInEmployees = employees.some((x) => (x.username || '').trim().toLowerCase() === uname);
          const existsInUsers = users.some((x) => (x.username || '').trim().toLowerCase() === uname);
          if (existsInEmployees || existsInUsers) {
            const msg = 'Username already exists';
            setError(msg);
            showToast(msg, 'error');
            return;
          }
        }

        await createEmployee(newEmployee, isOwnerAdmin ? newEmployeeCompanyId : undefined);
        showToast('Employee created successfully', 'success');
        setEmployeeModalOpen(false);
        await refreshAll();
        return;
      }

      if (!employeeEditTarget) {
        showToast('No employee selected', 'error');
        return;
      }

      const employeeUsername = (newEmployee.username || '').trim();
      if (employeeUsername) {
        const uname = employeeUsername.toLowerCase();
        const otherEmployees = employees.filter((x) => x.id !== employeeEditTarget.id);
        const existsInEmployees = otherEmployees.some((x) => (x.username || '').trim().toLowerCase() === uname);
        const existsInUsers = users.some((x) => (x.username || '').trim().toLowerCase() === uname);
        if (existsInEmployees || existsInUsers) {
          const msg = 'Username already exists';
          setError(msg);
          showToast(msg, 'error');
          return;
        }
      }

      const payload: UpdateEmployeeRequest = {
        firstName: newEmployee.firstName,
        lastName: newEmployee.lastName,
        department: newEmployee.department || undefined,
        mobile: newEmployee.mobile || undefined,
        designation: newEmployee.designation || undefined,
        category: newEmployee.category || undefined,
        username: employeeUsername || undefined,
        role: newEmployee.role,
        password: employeeModalPassword.trim() ? employeeModalPassword : undefined,
        hourlyRateOverride: newEmployee.hourlyRateOverride != null ? newEmployee.hourlyRateOverride : undefined,
      };
      await updateEmployee(employeeEditTarget.id, payload);
      showToast('Employee updated successfully', 'success');
      setEmployeeModalOpen(false);
      await refreshAll();
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, employeeModalMode === 'create' ? 'Failed to create employee' : 'Failed to update employee');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteUser(id: number) {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await deleteUser(id);
      showToast('User deleted successfully', 'success');
      await refreshUsers();
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to delete user');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setBusy(false);
    }
  }

  function canManageCompany(company: Company): boolean {
    if (user?.role === 'SYSTEM_ADMIN') return true;
    if (!user?.companyId) return false;
    if (user.companyId === company.id) return true;
    return company.parentCompanyId != null && company.parentCompanyId === user.companyId;
  }

  function openEditCompany(c: Company) {
    setEditingCompany(c);
    setEditCompanyForm({
      name: c.name,
      slug: c.slug,
      logoUrl: (c.logoUrl || '').trim(),
      hourlyRateDefault: c.hourlyRateDefault != null ? String(c.hourlyRateDefault) : '',
    });
    setEditCompanyLogoFile(null);
  }

  async function uploadEditCompanyLogo() {
    if (!editingCompany) return;
    if (!editCompanyLogoFile) return;
    setEditCompanyLogoBusy(true);
    try {
      const updated = await uploadCompanyLogo(editingCompany.id, editCompanyLogoFile);
      setEditCompanyForm((f) => ({ ...f, logoUrl: (updated.logoUrl || '').trim() }));
      await refreshCompanies();
      showToast('Logo uploaded successfully', 'success');
      setEditCompanyLogoFile(null);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to upload logo'), 'error');
    } finally {
      setEditCompanyLogoBusy(false);
    }
  }

  async function onSaveEditCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingCompany) return;
    setError(null);
    setEditCompanyBusy(true);
    try {
      const payload: UpdateCompanyRequest = {};
      if (editCompanyForm.name.trim()) payload.name = editCompanyForm.name.trim();
      if (editCompanyForm.slug.trim()) payload.slug = editCompanyForm.slug.trim().toLowerCase().replace(/\s+/g, '-');
      payload.logoUrl = editCompanyForm.logoUrl.trim() ? editCompanyForm.logoUrl.trim() : null;
      if (editCompanyForm.hourlyRateDefault.trim()) {
        const n = Number(editCompanyForm.hourlyRateDefault);
        if (!Number.isNaN(n) && n >= 0) {
          payload.hourlyRateDefault = n;
        }
      } else {
        payload.hourlyRateDefault = null;
      }
      await updateCompany(editingCompany.id, payload);
      setEditingCompany(null);
      showToast('Company updated successfully', 'success');
      await refreshCompanies();
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to update company');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setEditCompanyBusy(false);
    }
  }

  async function onConfirmDeleteCompany() {
    if (deleteCompanyId == null) return;
    setError(null);
    setDeleteCompanyBusy(true);
    try {
      await deleteCompany(deleteCompanyId);
      setDeleteCompanyId(null);
      showToast('Company deleted successfully', 'success');
      await refreshCompanies();
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to delete company');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setDeleteCompanyBusy(false);
    }
  }

  async function onCreateBranch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBranchFormBusy(true);
    try {
      const payload: CreateCompanyRequest = {
        name: branchForm.name.trim(),
        slug: branchForm.slug.trim().toLowerCase().replace(/\s+/g, '-'),
        logoUrl: branchForm.logoUrl.trim() ? branchForm.logoUrl.trim() : null,
      };
      if (branchForm.asBranch && user?.companyId) {
        payload.parentCompanyId = user.companyId;
      }
      await createCompany(payload);
      setBranchForm({ name: '', slug: '', logoUrl: '', asBranch: true });
      showToast(branchForm.asBranch ? 'Branch company created successfully' : 'Company created successfully', 'success');
      await refreshCompanies();
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to create company/branch');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setBranchFormBusy(false);
    }
  }

  async function onCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const username = (newUser.username || '').trim();
    if (username) {
      const uname = username.toLowerCase();
      const existsInUsers = users.some((x) => (x.username || '').trim().toLowerCase() === uname);
      const existsInEmployees = employees.some((x) => (x.username || '').trim().toLowerCase() === uname);
      if (existsInUsers || existsInEmployees) {
        const msg = 'Username already exists';
        setError(msg);
        showToast(msg, 'error');
        return;
      }
    }

    setBusy(true);
    try {
      await createUser({
        username: username,
        password: newUser.password,
        role: newUser.role,
        enabled: !!newUser.enabled,
      });
      setNewUser({ username: '', password: '', role: 'EMPLOYEE', enabled: true });
      await refreshUsers();
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to create user');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onQuickUpdateUser(u: UserResponse & { newPassword?: string }) {
    setError(null);
    setBusy(true);
    try {
      const payload: UpdateUserRequest = {
        role: u.role,
        enabled: !!u.enabled,
        password: u.newPassword || undefined,
      };
      await updateUser(u.id, payload);
      await refreshUsers();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update user'));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteEmployee(id: number) {
    if (!window.confirm('Are you sure you want to delete this employee?')) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await deleteEmployee(id);
      showToast('Employee deleted successfully', 'success');
      await refreshAll();
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to delete employee');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onQuickUpdateEmployee(emp: EmployeeResponse) {
    setError(null);
    setBusy(true);
    try {
      const payload: UpdateEmployeeRequest = {
        firstName: emp.firstName,
        lastName: emp.lastName,
        department: emp.department ?? undefined,
        mobile: emp.mobile ?? undefined,
        designation: emp.designation ?? undefined,
        category: emp.category ?? undefined,
        role: emp.role,
      };
      await updateEmployee(emp.id, payload);
      await refreshAll();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update employee'));
    } finally {
      setBusy(false);
    }
  }

  async function onCreateLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const name = (newLocation.name || '').trim();
      const lat = Number(newLocation.latitude);
      const lng = Number(newLocation.longitude);
      const radius = Number(newLocation.radiusMeters);
      if (!name) {
        setError('Location name is required');
        return;
      }
      if (Number.isNaN(lat) || lat < -90 || lat > 90) {
        setError('Latitude must be a number between -90 and 90');
        return;
      }
      if (Number.isNaN(lng) || lng < -180 || lng > 180) {
        setError('Longitude must be a number between -180 and 180');
        return;
      }
      if (Number.isNaN(radius) || radius <= 0) {
        setError('Radius must be a positive number (meters)');
        return;
      }

      await createLocation({
        ...newLocation,
        name,
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
      });
      setNewLocation({ name: '', latitude: 0, longitude: 0, radiusMeters: 100, active: true });
      await refreshAll();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to create location'));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteLocation(id: number) {
    setError(null);
    setBusy(true);
    try {
      await deleteLocation(id);
      await refreshAll();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to delete location'));
    } finally {
      setBusy(false);
    }
  }

  const geofenceSiteOptions = useMemo(() => {
    const names = Array.from(new Set(locations.map((l) => (l.name || '').trim()).filter(Boolean)));
    names.sort((a, b) => a.localeCompare(b));
    return names;
  }, [locations]);

  const filteredGeofences = useMemo(() => {
    const q = (geofenceSearch || '').trim().toLowerCase();
    return locations.filter((l) => {
      if (geofenceSite !== 'ALL') {
        if ((l.name || '').trim() !== geofenceSite) return false;
      }
      if (!q) return true;
      const hay = `${l.name} ${l.latitude} ${l.longitude} ${l.radiusMeters}`.toLowerCase();
      return hay.includes(q);
    });
  }, [geofenceSearch, geofenceSite, locations]);

  function downloadGeofencesCsv() {
    const header = ['Location name', 'Latitude', 'Longitude', 'Radius (m)', 'Active'].join(',');
    const rows = filteredGeofences.map((l) =>
      [l.name, l.latitude, l.longitude, l.radiusMeters, l.active ? 'true' : 'false']
        .map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geofencing_locations.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onQuickUpdateLocation(loc: WorkLocation) {
    setError(null);
    setBusy(true);
    try {
      await updateLocation(loc.id, {
        name: loc.name,
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        radiusMeters: Number(loc.radiusMeters),
        active: !!loc.active,
      });
      await refreshAll();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update location'));
    } finally {
      setBusy(false);
    }
  }

  const sidebarItems = useMemo(
    () => [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'companies', label: 'Companies & Branches' },
      { key: 'reports', label: 'Reports & Analytics' },
      { key: 'workforce', label: 'Workforce Plan' },
      { key: 'staff', label: 'Staff Directory' },
      { key: 'settings', label: 'Settings' },
    ],
    []
  );

  if (loading && employees.length === 0) {
    return (
      <AppLayout
        title="Dashboard"
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
      title="Attendance Management System"
      sidebarItems={sidebarItems}
      activeSidebarKey={section}
      onSidebarChange={setSection}
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <div>
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-2xl font-bold text-slate-900">{sidebarItems.find((x) => x.key === section)?.label}</div>
              <div className="mt-1 text-sm text-slate-600">Manage your company's attendance and workforce efficiently.</div>
            </div>

            {isOwnerAdmin && viewableCompanies.length > 1 ? (
              <div className="flex items-center gap-2">
                <div className="text-sm text-slate-600">Viewing company</div>
                <select
                  className="rounded-md border bg-white px-3 py-2 text-sm text-slate-900"
                  value={effectiveCompanyId ?? ''}
                  onChange={(e) => setCompanyContextId(Number(e.target.value))}
                >
                  {viewableCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.slug})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>

        {section === 'dashboard' ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <TabButton active={dashboardTab === 'home'} onClick={() => setDashboardTab('home')}>Home</TabButton>
              <TabButton active={dashboardTab === 'day'} onClick={() => setDashboardTab('day')}>Day</TabButton>
              <TabButton active={dashboardTab === 'timesheet'} onClick={() => setDashboardTab('timesheet')}>Timesheet</TabButton>
              <TabButton active={dashboardTab === 'global'} onClick={() => setDashboardTab('global')}>Global Summary</TabButton>
            </div>

            {dashboardTab === 'home' ? (
              <>
              <div className="mt-4 grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-9 grid gap-4">
                  <div className="rounded-xl border bg-white">
                    <div className="px-4 py-3 border-b">
                      <div className="font-medium text-slate-900">Workforce Insights</div>
                    </div>
                    <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg border bg-white p-4">
                        <div className="text-2xl font-semibold text-slate-900">{effectiveHome.locationNotVerifiedToday}</div>
                        <div className="mt-1 text-xs text-slate-500">Out of Location</div>
                        <div className="text-xs text-slate-400">Blocked</div>
                      </div>
                      <div className="rounded-lg border bg-white p-4">
                        <div className="text-2xl font-semibold text-slate-900">{effectiveHome.faceNotVerifiedToday}</div>
                        <div className="mt-1 text-xs text-slate-500">Face</div>
                        <div className="text-xs text-slate-400">Not Verified</div>
                      </div>
                      <div className="rounded-lg border bg-white p-4">
                        <div className="text-2xl font-semibold text-slate-900">{effectiveHome.presentToday}</div>
                        <div className="mt-1 text-xs text-slate-500">Present</div>
                        <div className="text-xs text-slate-400">Today</div>
                      </div>
                      <div className="rounded-lg border bg-white p-4">
                        <div className="text-2xl font-semibold text-slate-900">{effectiveHome.checkedOutToday}</div>
                        <div className="mt-1 text-xs text-slate-500">Checked Out</div>
                        <div className="text-xs text-slate-400">Today</div>
                      </div>
                      <div className="rounded-lg border bg-white p-4">
                        <div className="text-2xl font-semibold text-slate-900">{effectiveHome.notInToday}</div>
                        <div className="mt-1 text-xs text-slate-500">Not In</div>
                        <div className="text-xs text-slate-400">Today</div>
                      </div>
                      <div className="rounded-lg border bg-white p-4">
                        <div className="text-2xl font-semibold text-slate-900">{effectiveHome.totalStaff}</div>
                        <div className="mt-1 text-xs text-slate-500">Staff</div>
                        <div className="text-xs text-slate-400">Total</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-600">Monthly</div>
                      <select
                        className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                      >
                        {Array.from({ length: 6 }).map((_, i) => {
                          const y = new Date().getUTCFullYear() - 2 + i;
                          return (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          );
                        })}
                      </select>
                      <select
                        className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }).map((_, i) => {
                          const m = i + 1;
                          const label = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(Date.UTC(2000, i, 1)));
                          return (
                            <option key={m} value={m}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-600">{getMonthRangeLabel(selectedYear, selectedMonth)}</div>
                      <select
                        className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                      >
                        <option value="ALL">All Departments</option>
                        {departmentOptions.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                        value={selectedRoleScope}
                        onChange={(e) => setSelectedRoleScope(e.target.value as 'ALL' | 'MANAGERS')}
                      >
                        <option value="ALL">All Roles</option>
                        <option value="MANAGERS">Managers</option>
                      </select>
                      <div className="flex-1" />
                      <input
                        className="rounded-md border px-3 py-2 text-sm"
                        placeholder="Search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border bg-white">
                    <div className="px-4 py-3 border-b">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-slate-900">Clock-ins ({getMonthRangeLabel(selectedYear, selectedMonth)})</div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Clock-ins</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">Hours</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 grid gap-4 lg:grid-cols-12">
                      <div className="lg:col-span-3">
                        <div className="text-xs text-slate-500">Worked Hrs</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">
                          {workedMonthDisplay.h}
                          <span className="text-sm font-normal text-slate-500"> h {workedMonthDisplay.m} m</span>
                        </div>
                        <div className="mt-3 text-xs text-slate-500">Overtime Hrs</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">
                          {overtimeMonthDisplay.h}
                          <span className="text-sm font-normal text-slate-500"> h {overtimeMonthDisplay.m} m</span>
                        </div>
                      </div>
                      <div className="lg:col-span-9">
                        <div className="h-48 w-full rounded-lg border bg-white p-3">
                          <div className="h-full flex items-end gap-2">
                            {(effectiveHome.monthClockIns.length ? effectiveHome.monthClockIns : [{ day: 'n/a', count: 0 }]).slice(-18).map((x, idx) => {
                              const label = String(x.day || '').slice(5);
                              return (
                                <div key={idx} className="flex-1 flex flex-col justify-end">
                                  <div className="w-full rounded-sm bg-blue-600" style={{ height: `${Math.min(120, Number(x.count || 0) * 10)}px` }} />
                                  <div className="mt-1 text-[10px] text-slate-400 text-center whitespace-nowrap" style={{ transform: 'rotate(-35deg)', transformOrigin: 'center' }}>
                                    {label}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">Date</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-white">
                    <div className="px-4 py-3 border-b">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="font-medium text-slate-900">Today attendance</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                            value={attendanceStatusFilter}
                            onChange={(e) => setAttendanceStatusFilter(e.target.value as 'ALL' | 'IN' | 'OUT' | 'NOT_IN')}
                          >
                            <option value="ALL">All</option>
                            <option value="IN">In</option>
                            <option value="OUT">Out</option>
                            <option value="NOT_IN">Not In</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-12">
                      <div className={selectedEmployeeId ? 'lg:col-span-8 overflow-x-auto' : 'lg:col-span-12 overflow-x-auto'}>
                        <table className="w-full min-w-[720px] text-sm">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-4 py-2 text-left">Name</th>
                              <th className="px-4 py-2 text-left">In-Time</th>
                              <th className="px-4 py-2 text-left">Out-Time</th>
                              <th className="px-4 py-2 text-left">Location</th>
                              <th className="px-4 py-2 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAttendance.map((r) => {
                              const inStatus = !!r.checkInTime && !r.checkOutTime;
                              const checkedOut = !!r.checkInTime && !!r.checkOutTime;
                              const statusLabel = checkedOut ? 'Out' : inStatus ? 'In' : (r.status || 'Not In');
                              const active = selectedEmployeeId === r.employeeId;

                              return (
                                <tr
                                  key={r.id}
                                  className={
                                    active
                                      ? 'border-t bg-blue-50 cursor-pointer'
                                      : 'border-t hover:bg-slate-50 transition-colors cursor-pointer'
                                  }
                                  onClick={() => openEmployeeAttendance(r.employeeId)}
                                >
                                  <td className="px-4 py-3 font-medium text-slate-900">{r.employeeFirstName} {r.employeeLastName}</td>
                                  <td className="px-4 py-3 text-slate-700">{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : <span className="text-slate-400">-</span>}</td>
                                  <td className="px-4 py-3 text-slate-700">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : <span className="text-slate-400">-</span>}</td>
                                  <td className="px-4 py-3">
                                    <StatusBadge status={r.locationVerified ? 'verified' : 'not verified'}>
                                      {r.locationVerified ? 'Verified' : 'Not verified'}
                                    </StatusBadge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <StatusBadge status={statusLabel.toLowerCase()}>{statusLabel}</StatusBadge>
                                  </td>
                                </tr>
                              );
                            })}
                            {filteredAttendance.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-12">
                                  <EmptyState
                                    title="No attendance records"
                                    description="No attendance records found for today. Employees can check in using the employee dashboard."
                                  />
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>

                      {selectedEmployeeId ? (
                        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l">
                          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-slate-900">Employee</div>
                              <div className="text-xs text-slate-600">
                                {selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : `#${selectedEmployeeId}`}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={closeEmployeeAttendance}
                              className="rounded-md border px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              Close
                            </button>
                          </div>

                          <div className="p-4">
                            <div className="rounded-lg border bg-white p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-slate-900">
                                  {editingAttendanceId ? 'Edit Attendance' : 'Add Attendance'}
                                </div>
                                {editingAttendanceId ? (
                                  <button
                                    type="button"
                                    disabled={attendanceUpsertBusy}
                                    className="rounded-md border px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                    onClick={() => {
                                      if (selectedEmployeeId) {
                                        setEditingAttendanceId(null);
                                        setAttendanceUpsert({ employeeId: selectedEmployeeId });
                                      }
                                    }}
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                              </div>

                              <div className="mt-3 grid gap-2">
                                <div>
                                  <div className="text-xs font-medium text-slate-700">Check-in time</div>
                                  <input
                                    type="datetime-local"
                                    value={toDatetimeLocalValue(attendanceUpsert.checkInTime)}
                                    onChange={(e) => setAttendanceUpsert((p) => ({ ...p, checkInTime: datetimeLocalToIso(e.target.value) }))}
                                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                  />
                                </div>

                                <div>
                                  <div className="text-xs font-medium text-slate-700">Check-out time</div>
                                  <input
                                    type="datetime-local"
                                    value={toDatetimeLocalValue(attendanceUpsert.checkOutTime)}
                                    onChange={(e) => setAttendanceUpsert((p) => ({ ...p, checkOutTime: datetimeLocalToIso(e.target.value) }))}
                                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <div className="text-xs font-medium text-slate-700">Status</div>
                                    <select
                                      value={(attendanceUpsert.status || 'PRESENT') as AttendanceStatus}
                                      onChange={(e) => setAttendanceUpsert((p) => ({ ...p, status: e.target.value as AttendanceStatus }))}
                                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                                    >
                                      {(['PRESENT', 'LATE', 'ABSENT', 'EXCEPTION'] as AttendanceStatus[]).map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <div className="text-xs font-medium text-slate-700">Location verified</div>
                                    <select
                                      value={String(attendanceUpsert.locationVerified ?? false)}
                                      onChange={(e) => setAttendanceUpsert((p) => ({ ...p, locationVerified: e.target.value === 'true' }))}
                                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                                    >
                                      <option value="false">No</option>
                                      <option value="true">Yes</option>
                                    </select>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  disabled={attendanceUpsertBusy}
                                  onClick={submitAttendanceUpsert}
                                  className="mt-2 w-full rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                                >
                                  {attendanceUpsertBusy ? 'Saving…' : editingAttendanceId ? 'Save Changes' : 'Create Record'}
                                </button>
                              </div>
                            </div>

                            {employeeAttendanceLoading ? (
                              <div className="flex items-center justify-center py-10">
                                <LoadingSpinner />
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {selectedEmployeeAttendance.map((x) => (
                                  <div key={x.id} className="rounded-lg border bg-white p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-sm font-medium text-slate-900">
                                        {x.checkInTime ? new Date(x.checkInTime).toLocaleDateString() : '—'}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <StatusBadge status={(x.status || '').toLowerCase() || 'unknown'}>{x.status || '—'}</StatusBadge>
                                        <button
                                          type="button"
                                          disabled={attendanceUpsertBusy}
                                          className="rounded-md border px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                          onClick={() => startEditAttendance(x)}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          disabled={attendanceUpsertBusy}
                                          className="rounded-md border px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-60"
                                          onClick={() => deleteAttendance(x.id)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                                      <div>
                                        <div className="text-slate-500">In</div>
                                        <div>{x.checkInTime ? new Date(x.checkInTime).toLocaleString() : '-'}</div>
                                      </div>
                                      <div>
                                        <div className="text-slate-500">Out</div>
                                        <div>{x.checkOutTime ? new Date(x.checkOutTime).toLocaleString() : '-'}</div>
                                      </div>
                                    </div>
                                  </div>
                                ))}

                                {selectedEmployeeAttendance.length === 0 ? (
                                  <EmptyState
                                    title="No history"
                                    description="No attendance history found for this employee."
                                  />
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-3 grid gap-4">
                  <div className="rounded-xl border bg-white">
                    <div className="px-4 py-3 border-b font-medium text-slate-900">Quick Links</div>
                    <div className="divide-y">
                      {['Scheduler', 'Add Contractor Agency', 'Geofencing', 'Kiosk Settings'].map((x) => (
                        <button key={x} type="button" className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between">
                          <span>{x}</span>
                          <span className="text-slate-400">›</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {chatOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-50 bg-black/30 sm:hidden"
                    onClick={() => setChatOpen(false)}
                    aria-label="Close chat"
                  />
                  <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-96">
                    <div className="bg-white shadow-2xl border sm:rounded-xl rounded-t-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Support</div>
                          <div className="text-xs text-slate-500">We typically reply within a few minutes</div>
                        </div>
                        <button
                          type="button"
                          className="h-9 w-9 rounded-md hover:bg-slate-100 text-slate-600"
                          onClick={() => setChatOpen(false)}
                          aria-label="Close"
                          title="Close"
                        >
                          ×
                        </button>
                      </div>

                      <div className="h-[52vh] sm:h-80 overflow-auto p-4 bg-slate-50">
                        <div className="space-y-3">
                          {chatMessages.map((m) => (
                            <div key={m.id} className={m.from === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                              <div
                                className={
                                  m.from === 'user'
                                    ? 'max-w-[80%] rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-sm text-white shadow'
                                    : 'max-w-[80%] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-sm text-slate-800 border shadow-sm'
                                }
                              >
                                {m.text}
                                <div className={m.from === 'user' ? 'mt-1 text-[10px] text-blue-100' : 'mt-1 text-[10px] text-slate-400'}>
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
                            placeholder="Type your message..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendChatMessage();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="h-10 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                            onClick={sendChatMessage}
                            disabled={!chatInput.trim()}
                          >
                            Send
                          </button>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">Press Enter to send, Shift+Enter for new line.</div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              <button
                type="button"
                className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700"
                onClick={() => setChatOpen((v) => !v)}
                aria-label="Chat"
                title="Chat"
              >
                💬
              </button>
              </>
            ) : dashboardTab === 'day' ? (
              <div className="mt-4 grid gap-4">
                <div className="rounded-xl border bg-white">
                  <div className="px-4 py-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        <div className="text-lg font-semibold text-slate-900">{dayAnalytics?.totalStaff ?? dashboardStats.totalStaff}</div>
                        <div className="text-xs text-slate-500">Staff</div>
                      </div>
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        <div className="text-lg font-semibold text-slate-900">{dayAnalytics?.present ?? dashboardStats.present}</div>
                        <div className="text-xs text-slate-500">Present</div>
                      </div>
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        <div className="text-lg font-semibold text-slate-900">{dayAnalytics?.notIn ?? dashboardStats.notIn}</div>
                        <div className="text-xs text-slate-500">Not In</div>
                      </div>
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        <div className="text-lg font-semibold text-slate-900">{dayAnalytics?.holidays ?? 0}</div>
                        <div className="text-xs text-slate-500">Holidays</div>
                      </div>
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        <div className="text-lg font-semibold text-slate-900">{dayAnalytics?.weeklyOff ?? 0}</div>
                        <div className="text-xs text-slate-500">Weekly-Off</div>
                      </div>
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        {(() => {
                          const x = minutesToHourMinute(dayAnalytics?.workedMinutes ?? dashboardStats.totalWorkedMinutesDay);
                          return (
                            <>
                              <div className="text-lg font-semibold text-slate-900">{x.h}.{String(x.m).padStart(2, '0')}</div>
                              <div className="text-xs text-slate-500">Worked Hrs</div>
                            </>
                          );
                        })()}
                      </div>
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        {(() => {
                          const x = minutesToHourMinute(dayAnalytics?.overtimeMinutes ?? dashboardStats.totalOvertimeMinutesDay);
                          return (
                            <>
                              <div className="text-lg font-semibold text-slate-900">{x.h}.{String(x.m).padStart(2, '0')}</div>
                              <div className="text-xs text-slate-500">Overtime Hrs</div>
                            </>
                          );
                        })()}
                      </div>
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        <div className="text-lg font-semibold text-slate-900">{dayAnalytics?.rows?.length ?? 0}</div>
                        <div className="text-xs text-slate-500">Records</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700" value={dayDate} onChange={(e) => setDayDate(e.target.value)}>
                      <option value={utcDateString(new Date())}>Today</option>
                      <option value={dayDate}>{dayDate}</option>
                    </select>
                    <input
                      type="date"
                      className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                      value={dayDate}
                      onChange={(e) => setDayDate(e.target.value)}
                    />
                    <select
                      className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                    >
                      <option value="ALL">All Departments</option>
                      {departmentOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                      value={selectedRoleScope}
                      onChange={(e) => setSelectedRoleScope(e.target.value as 'ALL' | 'MANAGERS')}
                    >
                      <option value="ALL">All Roles</option>
                      <option value="MANAGERS">Managers</option>
                    </select>
                    <div className="flex-1" />
                    <input
                      className="rounded-md border px-3 py-2 text-sm"
                      placeholder="Search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-white overflow-x-auto">
                  <div className="px-4 py-3 border-b flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="font-medium text-slate-900">Day attendance</div>
                    {dayAnalyticsLoading ? <div className="text-sm text-slate-500">Loading…</div> : null}
                  </div>
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">In-Time</th>
                        <th className="px-4 py-2 text-left">Out-Time</th>
                        <th className="px-4 py-2 text-left">Worked Hrs</th>
                        <th className="px-4 py-2 text-left">Overtime</th>
                        <th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dayAnalytics?.rows || []).map((r) => {
                        const worked = minutesToHourMinute(r.workedMinutes);
                        const overtime = minutesToHourMinute(r.overtimeMinutes);
                        return (
                          <tr key={r.employeeId} className="border-t hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900">{r.firstName} {r.lastName}</td>
                            <td className="px-4 py-3 text-slate-700">{r.inTime ? new Date(r.inTime).toLocaleTimeString() : <span className="text-slate-400">-</span>}</td>
                            <td className="px-4 py-3 text-slate-700">{r.outTime ? new Date(r.outTime).toLocaleTimeString() : <span className="text-slate-400">-</span>}</td>
                            <td className="px-4 py-3 text-slate-700">{r.workedMinutes ? `${worked.h}h ${worked.m}m` : <span className="text-slate-400">-</span>}</td>
                            <td className="px-4 py-3 text-slate-700">{r.overtimeMinutes ? `${overtime.h}h ${overtime.m}m` : <span className="text-slate-400">-</span>}</td>
                            <td className="px-4 py-3">
                              <StatusBadge status={r.status.toLowerCase()}>{r.status === 'NOT_IN' ? 'Not In' : r.status}</StatusBadge>
                            </td>
                          </tr>
                        );
                      })}
                      {!dayAnalyticsLoading && (dayAnalytics?.rows?.length ?? 0) === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12">
                            <EmptyState title="No employees" description="No employees found for the selected filters." />
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                <div className="rounded-xl border bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-600">Monthly</div>
                    <select
                      className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                      {Array.from({ length: 6 }).map((_, i) => {
                        const y = new Date().getUTCFullYear() - 2 + i;
                        return (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        );
                      })}
                    </select>
                    <select
                      className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    >
                      {Array.from({ length: 12 }).map((_, i) => {
                        const m = i + 1;
                        const label = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(Date.UTC(2000, i, 1)));
                        return (
                          <option key={m} value={m}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-600">{getMonthRangeLabel(selectedYear, selectedMonth)}</div>
                    <select
                      className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                    >
                      <option value="ALL">All Departments</option>
                      {departmentOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                      value={selectedRoleScope}
                      onChange={(e) => setSelectedRoleScope(e.target.value as 'ALL' | 'MANAGERS')}
                    >
                      <option value="ALL">All Roles</option>
                      <option value="MANAGERS">Managers</option>
                    </select>
                    <div className="flex-1" />
                    <input
                      className="rounded-md border px-3 py-2 text-sm"
                      placeholder="Search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-white overflow-x-auto">
                  <div className="px-4 py-3 border-b flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="font-medium text-slate-900">Timesheet</div>
                    {timesheetLoading ? <div className="text-sm text-slate-500">Loading…</div> : null}
                  </div>

                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-2 text-left">Name</th>
                        {(timesheet?.days || []).map((d) => {
                          const dt = new Date(`${d}T00:00:00Z`);
                          const dayNum = dt.getUTCDate();
                          const wk = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(dt);
                          const isSun = dt.getUTCDay() === 0;
                          return (
                            <th key={d} className={isSun ? 'px-2 py-2 text-center text-xs text-red-600' : 'px-2 py-2 text-center text-xs'}>
                              <div>{dayNum}</div>
                              <div className="text-[10px]">{wk}</div>
                            </th>
                          );
                        })}
                        <th className="px-3 py-2 text-right">Present</th>
                        <th className="px-3 py-2 text-right">Off</th>
                        <th className="px-3 py-2 text-right">Worked Hrs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(timesheet?.rows || []).map((r) => {
                        const worked = minutesToHourMinute(r.workedMinutes);
                        return (
                          <tr key={r.employeeId} className="border-t">
                            <td className="px-4 py-2 font-medium text-slate-900 whitespace-nowrap">{r.firstName} {r.lastName}</td>
                            {r.days.map((c, idx) => {
                              const bg = c.state === 'PRESENT' ? 'bg-emerald-50' : 'bg-rose-50';
                              const text = c.state === 'PRESENT'
                                ? c.workedMinutes
                                  ? `${minutesToHourMinute(c.workedMinutes).h}h ${minutesToHourMinute(c.workedMinutes).m}m`
                                  : 'P'
                                : '-';
                              return (
                                <td key={idx} className={`px-2 py-2 text-center text-xs ${bg} border-l`}>
                                  {text}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-right">{r.presentDays}</td>
                            <td className="px-3 py-2 text-right">{r.offDays}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{r.workedMinutes ? `${worked.h}h ${worked.m}m` : '-'}</td>
                          </tr>
                        );
                      })}

                      {!timesheetLoading && (timesheet?.rows?.length ?? 0) === 0 ? (
                        <tr>
                          <td colSpan={(timesheet?.days?.length || 0) + 4} className="px-4 py-12">
                            <EmptyState title="No employees" description="No employees found for the selected filters." />
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {section === 'companies' ? (
          <div className="mt-6 grid gap-4">
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-slate-900">Current company</div>
                  <div className="mt-1 text-sm text-slate-600">This section is scoped to your logged-in company.</div>
                </div>
                {currentCompany && canManageCompany(currentCompany) ? (
                  <button
                    type="button"
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                    onClick={() => openEditCompany(currentCompany)}
                  >
                    Edit
                  </button>
                ) : null}
              </div>

              <div className="mt-4 flex items-center gap-4">
                {companyLogoUrl ? (
                  <img
                    src={companyLogoUrl}
                    alt={user?.companySlug || 'Company logo'}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                    {companyLogoLetter}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{currentCompany?.name || user?.companySlug || '—'}</div>
                  <div className="mt-0.5 text-xs text-slate-500">Slug: {currentCompany?.slug || user?.companySlug || '—'}</div>
                  <div className="mt-0.5 text-xs text-slate-500">Company ID: {user?.companyId ?? '—'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <div className="font-medium text-slate-900">Create branch company</div>
              <div className="mt-2 text-sm text-slate-600">
                One parent company (e.g. PRI) can have multiple branch companies (e.g. PowerX, PowerM, PowerS). Create a new branch under your current company.
              </div>
              <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={onCreateBranch}>
                <input
                  className="rounded-md border px-3 py-2"
                  placeholder="Branch name (e.g. PowerX)"
                  value={branchForm.name}
                  onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))}
                />
                <input
                  className="rounded-md border px-3 py-2"
                  placeholder="Slug (e.g. powerx)"
                  value={branchForm.slug}
                  onChange={(e) => setBranchForm((f) => ({ ...f, slug: e.target.value }))}
                />
                <input
                  className="rounded-md border px-3 py-2"
                  placeholder="Logo URL (optional)"
                  value={branchForm.logoUrl}
                  onChange={(e) => setBranchForm((f) => ({ ...f, logoUrl: e.target.value }))}
                />
                {user?.companyId ? (
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={branchForm.asBranch}
                      onChange={(e) => setBranchForm((f) => ({ ...f, asBranch: e.target.checked }))}
                    />
                    Create as branch of current company
                  </label>
                ) : null}
                <button type="submit" disabled={branchFormBusy || !branchForm.name.trim() || !branchForm.slug.trim()} className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2">
                  {branchFormBusy && <LoadingSpinner size="sm" />}
                  {branchFormBusy ? 'Creating...' : branchForm.asBranch ? 'Create branch' : 'Create company'}
                </button>
              </form>
            </div>
            <div className="rounded-xl border bg-white overflow-x-auto">
              <div className="px-4 py-3 border-b font-medium text-slate-900">All companies</div>
              {companiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Slug</th>
                      <th className="px-4 py-2 text-left">Parent</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => {
                      const parent = c.parentCompanyId ? companies.find((p) => p.id === c.parentCompanyId) : null;
                      const canManage = canManageCompany(c);
                      const isCurrent = user?.companyId === c.id;
                      const isBranch = c.parentCompanyId != null;
                      const logoLetter = (c.name || c.slug || 'A').trim().charAt(0).toUpperCase();
                      return (
                        <tr key={c.id} className={isCurrent ? 'border-t bg-blue-50/50' : 'border-t'}>
                          <td className="px-4 py-2 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              {c.logoUrl ? (
                                <img src={c.logoUrl} alt={c.name} className="h-8 w-8 rounded-lg object-cover" />
                              ) : (
                                <div className="h-8 w-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 text-sm font-semibold">
                                  {logoLetter}
                                </div>
                              )}
                              <span>{c.name}</span>
                              {isCurrent ? (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Current</span>
                              ) : null}
                              {isBranch ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">Branch</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-slate-600">{c.slug}</td>
                          <td className="px-4 py-2 text-slate-600">{parent ? `${parent.name} (${parent.slug})` : '—'}</td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            {canManage ? (
                              <>
                                <button
                                  type="button"
                                  className="rounded-md border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50 mr-1"
                                  onClick={() => openEditCompany(c)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                                  onClick={() => setDeleteCompanyId(c.id)}
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {companies.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12">
                          <EmptyState
                            title="No companies"
                            description="Register a company from the public registration page, or create a branch here when logged in as admin."
                          />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              )}
            </div>

            {editingCompany ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-company-title">
                <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-lg">
                  <h2 id="edit-company-title" className="text-lg font-semibold text-slate-900">Edit company</h2>
                  <p className="mt-1 text-sm text-slate-600">{editingCompany.name} ({editingCompany.slug})</p>
                  <form className="mt-4 space-y-3" onSubmit={onSaveEditCompany}>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Name</label>
                      <input
                        className="mt-1 w-full rounded-md border px-3 py-2"
                        value={editCompanyForm.name}
                        onChange={(e) => setEditCompanyForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Slug</label>
                      <input
                        className="mt-1 w-full rounded-md border px-3 py-2"
                        value={editCompanyForm.slug}
                        onChange={(e) => setEditCompanyForm((f) => ({ ...f, slug: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Logo URL (optional)</label>
                      <input
                        className="mt-1 w-full rounded-md border px-3 py-2"
                        value={editCompanyForm.logoUrl}
                        onChange={(e) => setEditCompanyForm((f) => ({ ...f, logoUrl: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Hourly rate default (per hour)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="mt-1 w-full rounded-md border px-3 py-2"
                        value={editCompanyForm.hourlyRateDefault}
                        onChange={(e) => setEditCompanyForm((f) => ({ ...f, hourlyRateDefault: e.target.value }))}
                        placeholder="e.g. 10"
                      />
                      <div className="mt-1 text-xs text-slate-500">Used for payroll if employee override is not set.</div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Or upload logo (from PC)</label>
                      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="file"
                          accept="image/*"
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          onChange={(e) => setEditCompanyLogoFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                        />
                        <button
                          type="button"
                          disabled={!editCompanyLogoFile || editCompanyLogoBusy}
                          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
                          onClick={uploadEditCompanyLogo}
                        >
                          {editCompanyLogoBusy && <LoadingSpinner size="sm" />}
                          {editCompanyLogoBusy ? 'Uploading...' : 'Upload'}
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Uploading will set Logo URL automatically.</div>
                    </div>
                    <div className="flex gap-2 justify-end mt-4">
                      <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50" onClick={() => setEditingCompany(null)}>
                        Cancel
                      </button>
                      <button type="submit" disabled={editCompanyBusy || !editCompanyForm.name.trim() || !editCompanyForm.slug.trim()} className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2">
                        {editCompanyBusy && <LoadingSpinner size="sm" />}
                        {editCompanyBusy ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            {deleteCompanyId != null ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-company-title">
                <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-lg">
                  <h2 id="delete-company-title" className="text-lg font-semibold text-slate-900">Delete company</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Are you sure you want to delete this company? This cannot be undone. The company must have no users.
                  </p>
                  <div className="mt-4 flex gap-2 justify-end">
                    <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50" onClick={() => setDeleteCompanyId(null)}>
                      Cancel
                    </button>
                    <button type="button" disabled={deleteCompanyBusy} className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2" onClick={onConfirmDeleteCompany}>
                      {deleteCompanyBusy && <LoadingSpinner size="sm" />}
                      {deleteCompanyBusy ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {section === 'reports' ? (
          <div className="mt-6 grid gap-4">
            <div className="rounded-xl border bg-white">
              <div className="px-4 py-3 border-b">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-slate-900">Reports & Analytics</div>
                    <div className="mt-0.5 text-sm text-slate-600">Generate and download reports (placeholder data for now).</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-600">All locations</div>
                    <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-600">This month</div>
                  </div>
                </div>
              </div>

              <div className="divide-y">
                {reportItems.map((item) => {
                  const expanded = expandedReportKey === item.key;
                  return (
                    <div key={item.key} className="px-4 py-3">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setExpandedReportKey(expanded ? null : item.key)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">{item.title}</div>
                            <div className="mt-0.5 text-sm text-slate-600">{item.description}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{item.format}</span>
                            <span className="text-sm text-slate-500">{expanded ? 'Hide' : 'View'}</span>
                          </div>
                        </div>
                      </button>

                      {expanded ? (
                        <div className="mt-3 rounded-lg border bg-slate-50 p-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700">Date range: This month</div>
                            <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700">Location: All</div>
                            <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700">Format: {item.format}</div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-md border px-3 py-1.5 hover:bg-white"
                              onClick={() => setExpandedReportKey(null)}
                            >
                              Close
                            </button>
                            <button
                              type="button"
                              className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-800"
                              onClick={() => downloadReport(item)}
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <div className="font-medium text-slate-900">Coming next</div>
              <div className="mt-1 text-sm text-slate-600">
                We will connect these to real company-scoped reporting APIs (daily/monthly, late/overtime/absence) and add PDF/Excel export.
              </div>
            </div>
          </div>
        ) : null}

        {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        {section === 'staff' ? (
          <div className="mt-6 grid gap-4">
            <div className="rounded-xl border bg-white">
              <div className="px-4 py-3 border-b">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-slate-900">Staff Directory</div>
                    <div className="mt-0.5 text-sm text-slate-600">Create, update, and manage employees.</div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <input
                      className="w-full sm:w-72 rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="Search staff..."
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={!canManage}
                      className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                      onClick={openCreateEmployeeModal}
                    >
                      Add employee
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Mobile</th>
                      <th className="px-4 py-2 text-left">Designation</th>
                      <th className="px-4 py-2 text-left">Department</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-left">Username</th>
                      <th className="px-4 py-2 text-left">Role</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => (
                      <tr key={emp.id} className="border-t">
                        <td className="px-4 py-2">{emp.employeeCode}</td>
                        <td className="px-4 py-2">{emp.firstName} {emp.lastName}</td>
                        <td className="px-4 py-2">{emp.mobile || '-'}</td>
                        <td className="px-4 py-2">{emp.designation || '-'}</td>
                        <td className="px-4 py-2">{emp.department || '-'}</td>
                        <td className="px-4 py-2">{emp.category || '-'}</td>
                        <td className="px-4 py-2">{emp.username}</td>
                        <td className="px-4 py-2">{emp.role}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          {canManage ? (
                            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                              <button
                                type="button"
                                disabled={busy}
                                className="rounded-md border px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60"
                                onClick={() => openEditEmployeeModal(emp)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                className="rounded-md bg-red-600 px-3 py-1.5 text-white hover:bg-red-500 disabled:opacity-60"
                                onClick={() => onDeleteEmployee(emp.id)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400">Read-only</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12">
                          <EmptyState title="No employees" description={staffSearch.trim() ? 'No employees match your search.' : 'Create your first employee to get started.'} />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {employeeModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true">
            <div className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl bg-white shadow-lg border">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-900">{employeeModalMode === 'create' ? 'Add employee' : 'Edit employee'}</div>
                  <div className="mt-0.5 text-sm text-slate-600">Fill employee details and save changes.</div>
                </div>
                <button
                  type="button"
                  className="h-9 w-9 rounded-md hover:bg-slate-100 text-slate-600"
                  onClick={() => setEmployeeModalOpen(false)}
                  aria-label="Close"
                  title="Close"
                >
                  ×
                </button>
              </div>

              <form className="p-4" onSubmit={submitEmployeeModal}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {isOwnerAdmin && viewableCompanies.length > 1 ? (
                    <label className="block">
                      <div className="text-xs font-medium text-slate-600">Company</div>
                      <select
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        value={newEmployeeCompanyId ?? ''}
                        disabled={employeeModalMode === 'edit'}
                        onChange={(e) => setNewEmployeeCompanyId(Number(e.target.value))}
                      >
                        {viewableCompanies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.slug})
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Employee code</div>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={newEmployee.employeeCode} onChange={(e) => setNewEmployee({ ...newEmployee, employeeCode: e.target.value })} required />
                  </label>
                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Department</div>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={newEmployee.department} onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })} />
                  </label>
                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">First name</div>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={newEmployee.firstName} onChange={(e) => setNewEmployee({ ...newEmployee, firstName: e.target.value })} required />
                  </label>
                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Last name</div>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={newEmployee.lastName} onChange={(e) => setNewEmployee({ ...newEmployee, lastName: e.target.value })} required />
                  </label>
                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Mobile</div>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={newEmployee.mobile} onChange={(e) => setNewEmployee({ ...newEmployee, mobile: e.target.value })} />
                  </label>
                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Designation</div>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={newEmployee.designation} onChange={(e) => setNewEmployee({ ...newEmployee, designation: e.target.value })} />
                  </label>
                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Category</div>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={newEmployee.category} onChange={(e) => setNewEmployee({ ...newEmployee, category: e.target.value })} />
                  </label>
                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Username</div>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={newEmployee.username} onChange={(e) => setNewEmployee({ ...newEmployee, username: e.target.value })} required />
                  </label>

                  {employeeModalMode === 'create' ? (
                    <label className="block">
                      <div className="text-xs font-medium text-slate-600">Password</div>
                      <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" type="password" value={newEmployee.password} onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })} required />
                    </label>
                  ) : (
                    <label className="block">
                      <div className="text-xs font-medium text-slate-600">Reset password (optional)</div>
                      <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" type="password" value={employeeModalPassword} onChange={(e) => setEmployeeModalPassword(e.target.value)} />
                    </label>
                  )}

                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Role</div>
                    <select className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" value={newEmployee.role} onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value as Role })}>
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Hourly rate override (optional)</div>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      value={newEmployee.hourlyRateOverride ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v.trim()) {
                          setNewEmployee({ ...newEmployee, hourlyRateOverride: null });
                          return;
                        }
                        const n = Number(v);
                        setNewEmployee({ ...newEmployee, hourlyRateOverride: Number.isNaN(n) ? null : n });
                      }}
                      placeholder="Leave empty to use company default"
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50" onClick={() => setEmployeeModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={busy} className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2">
                    {busy && <LoadingSpinner size="sm" />}
                    {busy ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {section === 'workforce' ? (
          <div className="mt-6 grid gap-4">
            <div className="rounded-xl border bg-white">
              <div className="px-4 py-3 border-b">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-slate-900">Geofencing Locations</div>
                    <div className="mt-0.5 text-sm text-slate-600">GPS location for clock in / clock out.</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!canManage}
                      className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                      onClick={() => setShowGeofenceForm((v) => !v)}
                    >
                      Add New Geolocation
                    </button>
                    <button type="button" className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => showToast('Bulk add will be added next', 'success')}>
                      Bulk Add
                    </button>
                    <button type="button" className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={downloadGeofencesCsv}>
                      Download
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs text-slate-500">Select site</div>
                    <select
                      className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                      value={geofenceSite}
                      onChange={(e) => setGeofenceSite(e.target.value)}
                    >
                      <option value="ALL">All</option>
                      {geofenceSiteOptions.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-72">
                    <input
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="Search"
                      value={geofenceSearch}
                      onChange={(e) => setGeofenceSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {showGeofenceForm && canManage ? (
                <div className="border-b p-4">
                  <form onSubmit={onCreateLocation}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="text-sm font-medium text-slate-700">Location name</label>
                        <input
                          className="mt-1 w-full rounded-md border px-3 py-2"
                          placeholder="e.g. Kigali office"
                          value={newLocation.name}
                          onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Latitude</label>
                        <input
                          type="number"
                          min={-90}
                          max={90}
                          step="any"
                          className="mt-1 w-full rounded-md border px-3 py-2"
                          value={newLocation.latitude}
                          onChange={(e) => setNewLocation({ ...newLocation, latitude: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Longitude</label>
                        <input
                          type="number"
                          min={-180}
                          max={180}
                          step="any"
                          className="mt-1 w-full rounded-md border px-3 py-2"
                          value={newLocation.longitude}
                          onChange={(e) => setNewLocation({ ...newLocation, longitude: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Geofence radius (m)</label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="mt-1 w-full rounded-md border px-3 py-2"
                          value={newLocation.radiusMeters}
                          onChange={(e) => setNewLocation({ ...newLocation, radiusMeters: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Active</label>
                        <div className="mt-2">
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={!!newLocation.active} onChange={(e) => setNewLocation({ ...newLocation, active: e.target.checked })} />
                            Enabled
                          </label>
                        </div>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
                    >
                      {busy && <LoadingSpinner size="sm" />}
                      {busy ? 'Creating...' : 'Create Location'}
                    </button>
                  </form>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2 text-left">Location Name</th>
                      <th className="px-4 py-2 text-left">Latitude</th>
                      <th className="px-4 py-2 text-left">Longitude</th>
                      <th className="px-4 py-2 text-left">Geofenced Radius (m)</th>
                      <th className="px-4 py-2 text-left">Active</th>
                      <th className="px-4 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGeofences.map((loc) => (
                      <tr key={loc.id} className="border-t">
                        <td className="px-4 py-2">
                          <input className="w-full rounded-md border px-2 py-1" value={loc.name} onChange={(e) => setLocations((prev) => prev.map((x) => (x.id === loc.id ? { ...x, name: e.target.value } : x)))} />
                        </td>
                        <td className="px-4 py-2">
                          <input className="w-full rounded-md border px-2 py-1" value={loc.latitude} onChange={(e) => setLocations((prev) => prev.map((x) => (x.id === loc.id ? { ...x, latitude: Number(e.target.value) } : x)))} />
                        </td>
                        <td className="px-4 py-2">
                          <input className="w-full rounded-md border px-2 py-1" value={loc.longitude} onChange={(e) => setLocations((prev) => prev.map((x) => (x.id === loc.id ? { ...x, longitude: Number(e.target.value) } : x)))} />
                        </td>
                        <td className="px-4 py-2">
                          <input className="w-full rounded-md border px-2 py-1" value={loc.radiusMeters} onChange={(e) => setLocations((prev) => prev.map((x) => (x.id === loc.id ? { ...x, radiusMeters: Number(e.target.value) } : x)))} />
                        </td>
                        <td className="px-4 py-2">
                          <input type="checkbox" checked={!!loc.active} onChange={(e) => setLocations((prev) => prev.map((x) => (x.id === loc.id ? { ...x, active: e.target.checked } : x)))} />
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          {canManage ? (
                            <>
                              <button type="button" disabled={busy} className="rounded-md border px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60" onClick={() => onQuickUpdateLocation(loc)}>
                                Save
                              </button>
                              <button type="button" disabled={busy} className="ml-2 rounded-md bg-red-600 px-3 py-1.5 text-white hover:bg-red-500 disabled:opacity-60" onClick={() => onDeleteLocation(loc.id)}>
                                Delete
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-400">Read-only</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {filteredGeofences.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12">
                          <EmptyState
                            title="No geofencing locations"
                            description="Add a geofence so employees can be location-verified during check-in/out."
                          />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {section === 'settings' ? (
          <div className="mt-6 grid gap-4">
            {canManageUsers ? (
              <form className="rounded-xl border bg-white p-5" onSubmit={onCreateUser}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-slate-900">Create user</div>
                    <div className="mt-1 text-sm text-slate-600">Create a login account for your organization. Usernames must be unique.</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Username</div>
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="e.g. john"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Password</div>
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="Set a strong password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs font-medium text-slate-600">Role</div>
                    <select
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
                    >
                      {userRoleOptions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2">
                    <input type="checkbox" checked={!!newUser.enabled} onChange={(e) => setNewUser({ ...newUser, enabled: e.target.checked })} />
                    <span className="text-sm text-slate-700">Enabled</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={busy || !newUser.username.trim() || !newUser.password.trim()}
                  className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
                >
                  {busy && <LoadingSpinner size="sm" />}
                  {busy ? 'Creating...' : 'Create User'}
                </button>
              </form>
            ) : (
              <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">
                You do not have permission to manage users.
              </div>
            )}

            <div className="rounded-xl border bg-white overflow-x-auto">
              <div className="px-4 py-3 border-b font-medium text-slate-900">Users</div>
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 text-left">Username</th>
                    <th className="px-4 py-2 text-left">Role</th>
                    <th className="px-4 py-2 text-left">Enabled</th>
                    <th className="px-4 py-2 text-left">Reset password</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-4 py-2">{u.username}</td>
                      <td className="px-4 py-2">
                        <select
                          className="w-full sm:w-auto rounded-md border px-2 py-1 bg-white"
                          value={u.role}
                          disabled={!canManageUsers}
                          onChange={(e) => setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: e.target.value as Role } : x)))}
                        >
                          {userRoleOptions.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={!!u.enabled}
                          disabled={!canManageUsers}
                          onChange={(e) => setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, enabled: e.target.checked } : x)))}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className="w-full min-w-[180px] rounded-md border px-2 py-1"
                          placeholder="New password (optional)"
                          type="password"
                          disabled={!canManageUsers}
                          value={u.newPassword || ''}
                          onChange={(e) => setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, newPassword: e.target.value } : x)))}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        {canManageUsers ? (
                          <>
                            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                              <button type="button" disabled={busy} className="rounded-md border px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60" onClick={() => onQuickUpdateUser(u)}>
                                Save
                              </button>
                              <button type="button" disabled={busy} className="rounded-md bg-red-600 px-3 py-1.5 text-white hover:bg-red-500 disabled:opacity-60" onClick={() => onDeleteUser(u.id)}>
                                Delete
                              </button>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">Read-only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12">
                        <EmptyState
                          title="No users"
                          description="Create system users to manage access and permissions for your attendance system."
                        />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
