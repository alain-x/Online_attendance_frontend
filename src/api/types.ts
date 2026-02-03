export type Role = 'SYSTEM_ADMIN' | 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE' | 'PAYROLL' | 'AUDITOR';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCEPTION';

export type ClockOutType = 'NORMAL' | 'COMPANY_PURPOSE';

export type CompanyPurposeStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type LoginRequest = {
  companySlug: string;
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
};

export type MeResponse = {
  username: string;
  role: Role;
  companyId: number | null;
  companySlug: string | null;
  companyLogoUrl?: string | null;
};

export type RegisterCompanyRequest = {
  companyName: string;
  companySlug: string;
  adminUsername: string;
  adminPassword: string;
};

export type RegisterCompanyResponse = {
  companyId: number;
  companySlug: string;
  adminUsername: string;
};

export type Company = {
  id: number;
  name: string;
  slug: string;
  parentCompanyId?: number | null;
  logoUrl?: string | null;
  hourlyRateDefault?: number | null;
  active?: boolean;
};

export type CreateCompanyRequest = {
  name: string;
  slug: string;
  parentCompanyId?: number | null;
  logoUrl?: string | null;
};

export type UpdateCompanyRequest = {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  hourlyRateDefault?: number | null;
};

export type EmployeeResponse = {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: string | null;
  mobile?: string | null;
  designation?: string | null;
  category?: string | null;
  username: string;
  role: Role;
  hourlyRateOverride?: number | null;
};

export type CreateEmployeeRequest = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: string;
  mobile?: string;
  designation?: string;
  category?: string;
  username: string;
  password: string;
  role: Role;
  hourlyRateOverride?: number | null;
};

export type UpdateEmployeeRequest = {
  firstName: string;
  lastName: string;
  department?: string;
  mobile?: string;
  designation?: string;
  category?: string;
  username?: string;
  password?: string;
  role?: Role;
  enabled?: boolean;
  hourlyRateOverride?: number | null;
};

export type WorkLocation = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  active: boolean;
  company?: unknown;
};

export type CreateWorkLocationRequest = {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  active: boolean;
};

export type UpdateWorkLocationRequest = CreateWorkLocationRequest;

export type AttendanceResponse = {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeFirstName: string;
  employeeLastName: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  locationVerified: boolean;
  faceVerified: boolean;
  status: AttendanceStatus | null;
  clockOutType?: ClockOutType | null;
  companyPurposeStatus?: CompanyPurposeStatus | null;
  companyPurposeNote?: string | null;
  workedMinutes: number;
  breakMinutes: number;
};

export type PayrollRowResponse = {
  employeeId: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workedMinutes: number;
  expectedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  deficitMinutes: number;
  hourlyRate: number | null;
  grossPay: number;
  netPay: number;
};

export type PayrollSummaryResponse = {
  from: string;
  to: string;
  companyId: number;
  companyHourlyRateDefault: number | null;
  totalWorkedMinutes: number;
  totalGrossPay: number;
  totalNetPay: number;
  totalExpectedMinutes: number;
  totalRegularMinutes: number;
  totalOvertimeMinutes: number;
  totalDeficitMinutes: number;
  rows: PayrollRowResponse[];
};

export type AdminUpsertAttendanceRequest = {
  employeeId?: number;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkOutLat?: number | null;
  checkOutLng?: number | null;
  locationVerified?: boolean | null;
  faceVerified?: boolean | null;
  status?: AttendanceStatus | null;
};

export type CheckInRequest = {
  latitude: number;
  longitude: number;
};

export type CheckOutRequest = {
  latitude: number;
  longitude: number;
};

export type VerifyFaceResponse = {
  faceVerified: boolean;
  message: string;
};

export type MessageResponse = {
  message: string;
};

export type DailyCount = {
  day: string;
  count: number;
};

export type HomeAnalyticsResponse = {
  totalStaff: number;
  presentToday: number;
  checkedOutToday: number;
  notInToday: number;
  locationNotVerifiedToday: number;
  faceNotVerifiedToday: number;
  workedMinutesMonth: number;
  overtimeMinutesMonth: number;
  monthClockIns: DailyCount[];
};

export type DayEmployeeRow = {
  employeeId: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: string | null;
  role?: Role | null;
  inTime: string | null;
  outTime: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  status: 'IN' | 'OUT' | 'NOT_IN';
};

export type DayAttendanceResponse = {
  date: string;
  totalStaff: number;
  present: number;
  notIn: number;
  holidays: number;
  weeklyOff: number;
  workedMinutes: number;
  overtimeMinutes: number;
  rows: DayEmployeeRow[];
};

export type TimesheetCell = {
  state: 'PRESENT' | 'OFF';
  workedMinutes: number;
  overtimeMinutes: number;
};

export type TimesheetEmployeeRow = {
  employeeId: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: string | null;
  role?: Role | null;
  days: TimesheetCell[];
  presentDays: number;
  offDays: number;
  workedMinutes: number;
  overtimeMinutes: number;
};

export type TimesheetResponse = {
  year: number;
  month: number;
  from: string;
  to: string;
  days: string[];
  rows: TimesheetEmployeeRow[];
};

export type UserResponse = {
  id: number;
  username: string;
  role: Role;
  enabled: boolean;
  companyId: number | null;
  companySlug: string | null;
};

export type CreateUserRequest = {
  username: string;
  password: string;
  role: Role;
  enabled?: boolean;
};

export type UpdateUserRequest = {
  password?: string;
  role?: Role;
  enabled?: boolean;
};
