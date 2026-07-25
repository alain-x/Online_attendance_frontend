export type Role = 'SYSTEM_ADMIN' | 'ADMIN' | 'HR' | 'MANAGER' | 'RECORDER' | 'EMPLOYEE' | 'PAYROLL' | 'AUDITOR' | 'CLUB_ADMIN' | 'COACH' | 'TEAM_MANAGER' | 'PLAYER' | 'PARENT';

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
  id?: number | null;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  role: Role;
  companyId: number | null;
  companySlug: string | null;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  profileImageUrl?: string | null;
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
  profileImageUrl?: string | null;
  _profileImageAvailable?: boolean;
  _companyLogoUrl?: string | null;
  username: string;
  email?: string | null;
  role: Role;
  faceEnrolled?: boolean;
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
  email: string;
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
  email?: string;
  password?: string;
  role?: Role;
  enabled?: boolean;
  hourlyRateOverride?: number | null;
};

export type UpdateMyProfileRequest = {
  mobile?: string;
  department?: string;
  designation?: string;
  category?: string;
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
  employeeId?: number | null;
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

export type BulkTimesheetImportRow = {
  employeeId: number;
  checkInTime: string;
  checkOutTime: string;
  locationVerified?: boolean;
  faceVerified?: boolean;
};

export type BulkTimesheetImportRequest = {
  rows: BulkTimesheetImportRow[];
};

export type BulkTimesheetImportResult = {
  index: number;
  employeeId: number | null;
  ok: boolean;
  message: string | null;
  attendanceId: number | null;
};

export type BulkTimesheetImportResponse = {
  ok: number;
  failed: number;
  results: BulkTimesheetImportResult[];
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
  state: 'PRESENT' | 'OFF' | 'HOLIDAY' | 'LEAVE';
  workedMinutes: number;
  overtimeMinutes: number;
  breakMinutes: number;
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
  breakMinutes: number;
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
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role: Role;
  enabled: boolean;
  companyId: number | null;
  companySlug: string | null;
};

export type PesapalEnvironment = 'SANDBOX' | 'LIVE';

export type PesapalSettingsResponse = {
  enabled: boolean;
  environment: PesapalEnvironment;
  consumerKey: string | null;
  consumerSecretMasked: string | null;
  ipnId: string | null;
  ipnUrl: string | null;
  callbackUrl: string | null;
  updatedAt: string | null;
};

export type UpdatePesapalSettingsRequest = {
  enabled: boolean;
  environment: PesapalEnvironment;
  consumerKey?: string;
  consumerSecret?: string;
  ipnUrl?: string;
  callbackUrl?: string;
};

export type SubscriptionPlan = {
  id: number;
  name: string;
  price: number;
  durationMonths: number;
  currency: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type UpsertSubscriptionPlanRequest = {
  name: string;
  price: number;
  durationMonths: number;
  active: boolean;
};

export type CreateUserRequest = {
  username: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  role: Role;
  enabled?: boolean;
};

export type UpdateUserRequest = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  role?: Role;
  enabled?: boolean;
};

// === Sports Club Types ===
export type SportRole = 'CLUB_ADMIN' | 'COACH' | 'TEAM_MANAGER' | 'PLAYER' | 'PARENT';

export type Sport = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
};

export type CreateSportRequest = {
  name: string;
  description?: string;
};

export type UpdateSportRequest = {
  name: string;
  description?: string;
  active: boolean;
};

export type SportsClub = {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  active: boolean;
};

export type CreateClubRequest = {
  name: string;
  slug: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
};

export type Team = {
  id: number;
  name: string;
  ageGroup: string | null;
  sportId: number;
  sportName: string;
  clubId: number;
  clubName: string;
  coachId: number | null;
  coachName: string | null;
  playerCount: number;
  active: boolean;
};

export type CreateTeamRequest = {
  name: string;
  ageGroup?: string;
  sportId: number;
  clubId: number;
  coachId?: number;
  description?: string;
};

export type TeamMember = {
  id: number;
  teamId: number;
  teamName: string;
  playerId: number;
  playerName: string;
  jerseyNumber: number | null;
  position: string | null;
};

export type AddTeamMemberRequest = {
  playerId: number;
  jerseyNumber?: number;
  position?: string;
};

export type PlayerProfile = {
  id: number;
  userId: number;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  clubId: number;
  clubName: string;
  dateOfBirth: string | null;
  height: number | null;
  weight: number | null;
  position: string | null;
  medicalNotes: string | null;
  profileImageUrl: string | null;
  active: boolean;
};

export type CreatePlayerRequest = {
  userId: number;
  clubId: number;
  dateOfBirth?: string;
  height?: number;
  weight?: number;
  position?: string;
  medicalNotes?: string;
};

export type PlayerStatistic = {
  id: number;
  playerId: number;
  matchesPlayed: number;
  triesScored: number;
  assists: number;
  passesCompleted: number;
  tacklesMade: number;
  trainingAttendance: number;
  season: string;
};

export type TrainingSession = {
  id: number;
  teamId: number;
  teamName: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  coachId: number;
  coachName: string;
  status: string;
  attendanceCount: number;
  notes: string | null;
};

export type CreateTrainingSessionRequest = {
  teamId: number;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  coachId: number;
};

export type TrainingAttendance = {
  id: number;
  sessionId: number;
  playerId: number;
  playerName: string;
  status: string;
  notes: string | null;
  checkinReason: string | null;
  checkoutReason: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

export type MarkAttendanceRequest = {
  playerId: number;
  status: string;
  notes?: string;
};

export type TrainingMaterial = {
  id: number;
  teamId: number;
  title: string;
  description: string | null;
  fileUrl: string | null;
  fileType: string;
  uploadedBy: number;
  uploadedByName: string;
  createdAt: string;
};

export type CreateTrainingMaterialRequest = {
  teamId: number;
  title: string;
  description?: string;
  fileUrl?: string;
  fileType: string;
};

export type Match = {
  id: number;
  teamId: number;
  teamName: string;
  opponent: string;
  location: string | null;
  matchDate: string;
  type: string;
  homeAway: string;
  status: string;
  ourScore: number | null;
  opponentScore: number | null;
  lineupCount: number;
  notes: string | null;
};

export type CreateMatchRequest = {
  teamId: number;
  opponent: string;
  location?: string;
  matchDate: string;
  type: string;
  homeAway: string;
};

export type MatchLineup = {
  id: number;
  matchId: number;
  playerId: number;
  playerName: string;
  jerseyNumber: number | null;
  position: string | null;
  isStarter: boolean;
  minutesPlayed: number | null;
};

export type AddLineupRequest = {
  playerId: number;
  jerseyNumber?: number;
  position?: string;
  isStarter: boolean;
};

export type MatchEvent = {
  id: number;
  matchId: number;
  playerId: number;
  playerName: string;
  eventType: string;
  minute: number | null;
  notes: string | null;
};

export type AddMatchEventRequest = {
  playerId: number;
  eventType: string;
  minute?: number;
  notes?: string;
};

export type PlayerEvaluation = {
  id: number;
  playerId: number;
  playerName: string;
  evaluatorId: number;
  evaluatorName: string;
  teamId: number;
  teamName: string;
  period: string;
  overallRating: number;
  coachNotes: string | null;
  goals: string | null;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  totalDistanceKm: number | null;
  totalTrainingMinutes: number | null;
  criteria: EvaluationCriterion[];
  createdAt: string;
};

export type EvaluationCriterion = {
  id: number;
  criterionName: string;
  score: number;
  notes: string | null;
};

export type CreateEvaluationRequest = {
  playerId: number;
  teamId: number;
  period: string;
  overallRating: number;
  coachNotes?: string;
  goals?: string;
  avgSpeedKmh?: number;
  maxSpeedKmh?: number;
  totalDistanceKm?: number;
  totalTrainingMinutes?: number;
};

export type AddCriterionRequest = {
  criterionName: string;
  score: number;
  notes?: string;
};

export type CalendarEvent = {
  id: number;
  teamId: number;
  teamName: string;
  title: string;
  description: string | null;
  eventType: string;
  startDateTime: string;
  endDateTime: string;
  location: string | null;
  allDay: boolean;
  color: string | null;
};

export type CreateCalendarEventRequest = {
  teamId: number;
  title: string;
  description?: string;
  eventType: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  allDay?: boolean;
  color?: string;
};

export type ChatRoom = {
  id: number;
  teamId: number | null;
  teamName: string | null;
  name: string;
  type: string;
  isGroup: boolean;
  createdById: number | null;
  createdByName: string | null;
  createdAt: string;
  participantCount: number;
  lastMessageId: number | null;
  lastMessageContent: string | null;
  lastMessageSenderName: string | null;
  lastMessageAt: string | null;
};

export type CreateChatRoomRequest = {
  teamId?: number;
  name: string;
  type: string;
  isGroup?: boolean;
  participantIds?: number[];
};

export type ChatMessage = {
  id: number;
  roomId: number;
  senderId: number;
  senderName: string;
  content: string;
  messageType: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  parentMessageId: number | null;
  parentContent: string | null;
  parentSenderName: string | null;
};

export type SendMessageRequest = {
  content?: string;
  messageType?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  parentMessageId?: number;
};

export type ChatParticipant = {
  id: number;
  userId: number;
  username: string;
  joinedAt: string;
};

export type FileUploadResponse = {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export type ParentLink = {
  id: number;
  parentUserId: number;
  parentName: string;
  playerId: number;
  playerName: string;
  relationship: string;
};

export type LinkParentRequest = {
  parentUserId: number;
  playerId: number;
  relationship: string;
};

export type MembershipFee = {
  id: number;
  clubId: number;
  teamId: number | null;
  name: string;
  amount: number;
  currency: string;
  frequency: string;
  active: boolean;
  description: string | null;
};

export type CreateFeeRequest = {
  clubId: number;
  teamId?: number;
  name: string;
  amount: number;
  currency?: string;
  frequency: string;
  description?: string;
};

export type PlayerPayment = {
  id: number;
  feeId: number;
  feeName: string;
  playerId: number;
  playerName: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  paidDate: string | null;
  paymentMethod: string | null;
  transactionRef: string | null;
  notes: string | null;
};

export type RecordPaymentRequest = {
  feeId: number;
  playerId: number;
  amount: number;
  dueDate: string;
  notes?: string;
};

export type ClubDashboardStats = {
  totalPlayers: number;
  totalTeams: number;
  upcomingMatches: number;
  upcomingTraining: number;
  recentPayments: number;
};
