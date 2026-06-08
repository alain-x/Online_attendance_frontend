import http from './http';
import type {
  Sport, CreateSportRequest, UpdateSportRequest,
  SportsClub, CreateClubRequest,
  Team, CreateTeamRequest, TeamMember, AddTeamMemberRequest,
  PlayerProfile, CreatePlayerRequest, PlayerStatistic,
  TrainingSession, CreateTrainingSessionRequest, TrainingAttendance, MarkAttendanceRequest, TrainingMaterial, CreateTrainingMaterialRequest,
  Match, CreateMatchRequest, MatchLineup, AddLineupRequest, MatchEvent, AddMatchEventRequest,
  PlayerEvaluation, CreateEvaluationRequest, AddCriterionRequest,
  CalendarEvent, CreateCalendarEventRequest,
  ChatRoom, CreateChatRoomRequest, ChatMessage, SendMessageRequest, ChatParticipant, FileUploadResponse,
  ParentLink, LinkParentRequest,
  MembershipFee, CreateFeeRequest, PlayerPayment, RecordPaymentRequest,
  ClubDashboardStats
} from './types';

export async function listSports(): Promise<Sport[]> {
  const res = await http.get<Sport[]>('/api/sports/sports');
  return res.data;
}
export async function getSport(id: number): Promise<Sport> {
  const res = await http.get<Sport>(`/api/sports/sports/${id}`);
  return res.data;
}
export async function createSport(data: CreateSportRequest): Promise<Sport> {
  const res = await http.post<Sport>('/api/sports/sports', data);
  return res.data;
}
export async function updateSport(id: number, data: UpdateSportRequest): Promise<Sport> {
  const res = await http.put<Sport>(`/api/sports/sports/${id}`, data);
  return res.data;
}
export async function deleteSport(id: number): Promise<void> {
  await http.delete(`/api/sports/sports/${id}`);
}

export async function listClubs(): Promise<SportsClub[]> {
  const res = await http.get<SportsClub[]>('/api/sports/clubs');
  return res.data;
}
export async function getClub(id: number): Promise<SportsClub> {
  const res = await http.get<SportsClub>(`/api/sports/clubs/${id}`);
  return res.data;
}
export async function createClub(data: CreateClubRequest): Promise<SportsClub> {
  const res = await http.post<SportsClub>('/api/sports/clubs', data);
  return res.data;
}
export async function updateClub(id: number, data: CreateClubRequest): Promise<SportsClub> {
  const res = await http.put<SportsClub>(`/api/sports/clubs/${id}`, data);
  return res.data;
}
export async function deleteClub(id: number): Promise<void> {
  await http.delete(`/api/sports/clubs/${id}`);
}

export async function listTeams(clubId?: number, sportId?: number): Promise<Team[]> {
  const params: Record<string, string> = {};
  if (clubId) params.clubId = String(clubId);
  if (sportId) params.sportId = String(sportId);
  const res = await http.get<Team[]>('/api/sports/teams', { params });
  return res.data;
}
export async function getTeam(id: number): Promise<Team> {
  const res = await http.get<Team>(`/api/sports/teams/${id}`);
  return res.data;
}
export async function createTeam(data: CreateTeamRequest): Promise<Team> {
  const res = await http.post<Team>('/api/sports/teams', data);
  return res.data;
}
export async function updateTeam(id: number, data: CreateTeamRequest): Promise<Team> {
  const res = await http.put<Team>(`/api/sports/teams/${id}`, data);
  return res.data;
}
export async function deleteTeam(id: number): Promise<void> {
  await http.delete(`/api/sports/teams/${id}`);
}
export async function listTeamMembers(teamId: number): Promise<TeamMember[]> {
  const res = await http.get<TeamMember[]>(`/api/sports/teams/${teamId}/members`);
  return res.data;
}
export async function addTeamMember(teamId: number, data: AddTeamMemberRequest): Promise<TeamMember> {
  const res = await http.post<TeamMember>(`/api/sports/teams/${teamId}/members`, data);
  return res.data;
}
export async function removeTeamMember(teamId: number, memberId: number): Promise<void> {
  await http.delete(`/api/sports/teams/${teamId}/members/${memberId}`);
}

export async function listPlayers(clubId?: number, teamId?: number): Promise<PlayerProfile[]> {
  const params: Record<string, string> = {};
  if (clubId) params.clubId = String(clubId);
  if (teamId) params.teamId = String(teamId);
  const res = await http.get<PlayerProfile[]>('/api/sports/players', { params });
  return res.data;
}
export async function getMyPlayerProfile(): Promise<PlayerProfile> {
  const res = await http.get<PlayerProfile>('/api/sports/players/me');
  return res.data;
}
export async function getPlayer(id: number): Promise<PlayerProfile> {
  const res = await http.get<PlayerProfile>(`/api/sports/players/${id}`);
  return res.data;
}
export async function createPlayer(data: CreatePlayerRequest): Promise<PlayerProfile> {
  const res = await http.post<PlayerProfile>('/api/sports/players', data);
  return res.data;
}
export async function updatePlayer(id: number, data: Partial<CreatePlayerRequest>): Promise<PlayerProfile> {
  const res = await http.put<PlayerProfile>(`/api/sports/players/${id}`, data);
  return res.data;
}
export async function deletePlayer(id: number): Promise<void> {
  await http.delete(`/api/sports/players/${id}`);
}
export async function getPlayerStatistics(playerId: number): Promise<PlayerStatistic[]> {
  const res = await http.get<PlayerStatistic[]>(`/api/sports/players/${playerId}/statistics`);
  return res.data;
}
export async function updatePlayerStatistics(playerId: number, data: Partial<PlayerStatistic>): Promise<PlayerStatistic> {
  const res = await http.put<PlayerStatistic>(`/api/sports/players/${playerId}/statistics`, data);
  return res.data;
}

export async function listTrainingSessions(teamId?: number): Promise<TrainingSession[]> {
  const params: Record<string, string> = {};
  if (teamId) params.teamId = String(teamId);
  const res = await http.get<TrainingSession[]>('/api/sports/training/sessions', { params });
  return res.data;
}
export async function getTrainingSession(id: number): Promise<TrainingSession> {
  const res = await http.get<TrainingSession>(`/api/sports/training/sessions/${id}`);
  return res.data;
}
export async function createTrainingSession(data: CreateTrainingSessionRequest): Promise<TrainingSession> {
  const res = await http.post<TrainingSession>('/api/sports/training/sessions', data);
  return res.data;
}
export async function updateTrainingSession(id: number, data: Partial<CreateTrainingSessionRequest>): Promise<TrainingSession> {
  const res = await http.put<TrainingSession>(`/api/sports/training/sessions/${id}`, data);
  return res.data;
}
export async function deleteTrainingSession(id: number): Promise<void> {
  await http.delete(`/api/sports/training/sessions/${id}`);
}
export async function getTrainingAttendance(sessionId: number): Promise<TrainingAttendance[]> {
  const res = await http.get<TrainingAttendance[]>(`/api/sports/training/sessions/${sessionId}/attendance`);
  return res.data;
}
export async function markAttendance(sessionId: number, data: MarkAttendanceRequest[]): Promise<void> {
  await http.post(`/api/sports/training/sessions/${sessionId}/attendance`, data);
}
export async function listTrainingMaterials(teamId: number): Promise<TrainingMaterial[]> {
  const res = await http.get<TrainingMaterial[]>('/api/sports/training/materials', { params: { teamId: String(teamId) } });
  return res.data;
}
export async function createTrainingMaterial(data: CreateTrainingMaterialRequest): Promise<TrainingMaterial> {
  const res = await http.post<TrainingMaterial>('/api/sports/training/materials', data);
  return res.data;
}
export async function deleteTrainingMaterial(id: number): Promise<void> {
  await http.delete(`/api/sports/training/materials/${id}`);
}

export async function listMatches(teamId?: number): Promise<Match[]> {
  const params: Record<string, string> = {};
  if (teamId) params.teamId = String(teamId);
  const res = await http.get<Match[]>('/api/sports/matches', { params });
  return res.data;
}
export async function getMatch(id: number): Promise<Match> {
  const res = await http.get<Match>(`/api/sports/matches/${id}`);
  return res.data;
}
export async function createMatch(data: CreateMatchRequest): Promise<Match> {
  const res = await http.post<Match>('/api/sports/matches', data);
  return res.data;
}
export async function updateMatch(id: number, data: Partial<CreateMatchRequest>): Promise<Match> {
  const res = await http.put<Match>(`/api/sports/matches/${id}`, data);
  return res.data;
}
export async function deleteMatch(id: number): Promise<void> {
  await http.delete(`/api/sports/matches/${id}`);
}
export async function getMatchLineup(matchId: number): Promise<MatchLineup[]> {
  const res = await http.get<MatchLineup[]>(`/api/sports/matches/${matchId}/lineup`);
  return res.data;
}
export async function setMatchLineup(matchId: number, data: AddLineupRequest[]): Promise<MatchLineup[]> {
  const res = await http.post<MatchLineup[]>(`/api/sports/matches/${matchId}/lineup`, data);
  return res.data;
}
export async function removeFromLineup(matchId: number, lineupId: number): Promise<void> {
  await http.delete(`/api/sports/matches/${matchId}/lineup/${lineupId}`);
}
export async function getMatchEvents(matchId: number): Promise<MatchEvent[]> {
  const res = await http.get<MatchEvent[]>(`/api/sports/matches/${matchId}/events`);
  return res.data;
}
export async function addMatchEvent(matchId: number, data: AddMatchEventRequest): Promise<MatchEvent> {
  const res = await http.post<MatchEvent>(`/api/sports/matches/${matchId}/events`, data);
  return res.data;
}

export async function listEvaluations(playerId?: number, teamId?: number): Promise<PlayerEvaluation[]> {
  const params: Record<string, string> = {};
  if (playerId) params.playerId = String(playerId);
  if (teamId) params.teamId = String(teamId);
  const res = await http.get<PlayerEvaluation[]>('/api/sports/evaluations', { params });
  return res.data;
}
export async function getEvaluation(id: number): Promise<PlayerEvaluation> {
  const res = await http.get<PlayerEvaluation>(`/api/sports/evaluations/${id}`);
  return res.data;
}
export async function createEvaluation(data: CreateEvaluationRequest): Promise<PlayerEvaluation> {
  const res = await http.post<PlayerEvaluation>('/api/sports/evaluations', data);
  return res.data;
}
export async function addCriterion(evaluationId: number, data: AddCriterionRequest): Promise<void> {
  await http.post(`/api/sports/evaluations/${evaluationId}/criteria`, data);
}
export async function updateEvaluation(id: number, data: CreateEvaluationRequest): Promise<PlayerEvaluation> {
  const res = await http.put<PlayerEvaluation>(`/api/sports/evaluations/${id}`, data);
  return res.data;
}
export async function deleteEvaluation(id: number): Promise<void> {
  await http.delete(`/api/sports/evaluations/${id}`);
}

export async function listCalendarEvents(teamId?: number, from?: string, to?: string): Promise<CalendarEvent[]> {
  const params: Record<string, string> = {};
  if (teamId) params.teamId = String(teamId);
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await http.get<CalendarEvent[]>('/api/sports/schedule', { params });
  return res.data;
}
export async function createCalendarEvent(data: CreateCalendarEventRequest): Promise<CalendarEvent> {
  const res = await http.post<CalendarEvent>('/api/sports/schedule', data);
  return res.data;
}
export async function deleteCalendarEvent(id: number): Promise<void> {
  await http.delete(`/api/sports/schedule/${id}`);
}

export async function listChatRooms(teamId?: number): Promise<ChatRoom[]> {
  const params: Record<string, string> = {};
  if (teamId) params.teamId = String(teamId);
  const res = await http.get<ChatRoom[]>('/api/sports/chat/rooms', { params });
  return res.data;
}
export async function listAllChatRooms(): Promise<ChatRoom[]> {
  const res = await http.get<ChatRoom[]>('/api/sports/chat/rooms/all');
  return res.data;
}
export async function createChatRoom(data: CreateChatRoomRequest): Promise<ChatRoom> {
  const res = await http.post<ChatRoom>('/api/sports/chat/rooms', data);
  return res.data;
}
export async function createOrGetDirectChat(userId: number): Promise<ChatRoom> {
  const res = await http.post<ChatRoom>('/api/sports/chat/direct', { userId });
  return res.data;
}
export async function getChatMessages(roomId: number): Promise<ChatMessage[]> {
  const res = await http.get<ChatMessage[]>(`/api/sports/chat/rooms/${roomId}/messages`);
  return res.data;
}
export async function sendMessage(roomId: number, data: SendMessageRequest): Promise<ChatMessage> {
  const res = await http.post<ChatMessage>(`/api/sports/chat/rooms/${roomId}/messages`, data);
  return res.data;
}
export async function uploadChatFile(file: File): Promise<FileUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await http.post<FileUploadResponse>('/api/sports/chat/upload', form);
  return res.data;
}
export async function searchChatUsers(query: string): Promise<{ id: number; username: string; email: string | null; role: string }[]> {
  const res = await http.get('/api/sports/chat/users/search', { params: { q: query } });
  return res.data;
}
export async function getChatParticipants(roomId: number): Promise<ChatParticipant[]> {
  const res = await http.get<ChatParticipant[]>(`/api/sports/chat/rooms/${roomId}/participants`);
  return res.data;
}
export async function addChatParticipant(roomId: number, userId: number): Promise<void> {
  await http.post(`/api/sports/chat/rooms/${roomId}/participants`, { userId });
}
export async function removeChatParticipant(roomId: number, userId: number): Promise<void> {
  await http.delete(`/api/sports/chat/rooms/${roomId}/participants/${userId}`);
}

export async function getMyChildren(): Promise<ParentLink[]> {
  const res = await http.get<ParentLink[]>('/api/sports/parents/my-children');
  return res.data;
}
export async function linkParent(data: LinkParentRequest): Promise<ParentLink> {
  const res = await http.post<ParentLink>('/api/sports/parents/link', data);
  return res.data;
}
export async function unlinkParent(id: number): Promise<void> {
  await http.delete(`/api/sports/parents/link/${id}`);
}

export async function listFees(clubId?: number, teamId?: number): Promise<MembershipFee[]> {
  const params: Record<string, string> = {};
  if (clubId) params.clubId = String(clubId);
  if (teamId) params.teamId = String(teamId);
  const res = await http.get<MembershipFee[]>('/api/sports/payments/fees', { params });
  return res.data;
}
export async function createFee(data: CreateFeeRequest): Promise<MembershipFee> {
  const res = await http.post<MembershipFee>('/api/sports/payments/fees', data);
  return res.data;
}
export async function deleteFee(id: number): Promise<void> {
  await http.delete(`/api/sports/payments/fees/${id}`);
}
export async function listPayments(playerId?: number): Promise<PlayerPayment[]> {
  const params: Record<string, string> = {};
  if (playerId) params.playerId = String(playerId);
  const res = await http.get<PlayerPayment[]>('/api/sports/payments', { params });
  return res.data;
}
export async function recordPayment(data: RecordPaymentRequest): Promise<PlayerPayment> {
  const res = await http.post<PlayerPayment>('/api/sports/payments', data);
  return res.data;
}
export async function updatePaymentStatus(id: number, status: string): Promise<PlayerPayment> {
  const res = await http.patch<PlayerPayment>(`/api/sports/payments/${id}/status`, { status });
  return res.data;
}

export async function getClubDashboardStats(): Promise<ClubDashboardStats> {
  const res = await http.get<ClubDashboardStats>('/api/sports/analytics/dashboard');
  return res.data;
}
export async function getPlayerAnalytics(playerId: number): Promise<Record<string, unknown>> {
  const res = await http.get(`/api/sports/analytics/player/${playerId}`);
  return res.data;
}
export async function getTeamAnalytics(teamId: number): Promise<Record<string, unknown>> {
  const res = await http.get(`/api/sports/analytics/team/${teamId}`);
  return res.data;
}
