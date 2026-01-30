export type Role = 'SYSTEM_ADMIN' | 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE' | 'PAYROLL' | 'AUDITOR';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCEPTION';

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
};

export type UpdateEmployeeRequest = {
  firstName: string;
  lastName: string;
  department?: string;
  mobile?: string;
  designation?: string;
  category?: string;
  password?: string;
  role?: Role;
  enabled?: boolean;
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
  workedMinutes: number;
  breakMinutes: number;
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
