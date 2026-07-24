import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import { useAuth } from '../../auth/AuthContext';
import ClubDashboardPage from './ClubDashboardPage';
import TeamsPage from './TeamsPage';
import PlayersPage from './PlayersPage';
import TrainingPage from './TrainingPage';
import MatchesPage from './MatchesPage';
import EvaluationsPage from './EvaluationsPage';
import SchedulePage from './SchedulePage';
import ChatPage from './ChatPage';
import PaymentsPage from './PaymentsPage';
import UsersPage from './UsersPage';
import AttendanceSection from './AttendanceSection';
import SportsPage from './SportsPage';
import { useChatNotifier } from './useChatNotifier';
import { useBranding } from '../../hooks/useBranding';

export default function SportsClubPage() {
  const { user } = useAuth();
  const { systemName } = useBranding();
  const location = useLocation();
  const [section, setSection] = useState('dashboard');
  const { totalUnread, clearUnread } = useChatNotifier();

  useEffect(() => {
    const state = location.state as { section?: string } | null;
    const next = state?.section;
    if (next && typeof next === 'string') {
      setSection(next);
    }
  }, [location.state]);

  const isSystemOrAdmin = user?.role === 'SYSTEM_ADMIN' || user?.role === 'ADMIN';

  const sidebarItems = useMemo(() => {
    const items = [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'sports', label: 'Sports' },
      { key: 'teams', label: 'Teams' },
      { key: 'players', label: 'Players' },
      { key: 'training', label: 'Training' },
      { key: 'matches', label: 'Matches' },
      { key: 'evaluations', label: 'Evaluations' },
      { key: 'schedule', label: 'Schedule' },
      { key: 'chat', label: 'Chat', badge: totalUnread },
      { key: 'payments', label: 'Payments' },
      { key: 'attendance', label: 'Attendance' },
    ];
    if (isSystemOrAdmin) {
      items.push({ key: 'users', label: 'Users' });
    }
    return items;
  }, [isSystemOrAdmin, totalUnread]);

  useEffect(() => {
    const allowed = sidebarItems.some((x) => x.key === section);
    if (!allowed) {
      setSection('dashboard');
    }
  }, [section, sidebarItems]);

  const sectionTitle = sidebarItems.find((x) => x.key === section)?.label || 'Sports Club';

  return (
    <AppLayout
      title=""
      sidebarItems={sidebarItems}
      activeSidebarKey={section}
      onSidebarChange={(k) => {
        setSection(k);
      }}
    >
        <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">{sectionTitle}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {user?.companyName ? `${user.companyName} - ` : ''}{systemName}
        </p>
      </div>

      {section === 'dashboard' && <ClubDashboardPage onNavigate={setSection} />}
      {section === 'sports' && <SportsPage />}
      {section === 'teams' && <TeamsPage />}
      {section === 'players' && <PlayersPage />}
      {section === 'training' && <TrainingPage />}
      {section === 'matches' && <MatchesPage />}
      {section === 'evaluations' && <EvaluationsPage />}
      {section === 'schedule' && <SchedulePage />}
      {section === 'chat' && <ChatPage onUnreadCleared={clearUnread} />}
      {section === 'payments' && <PaymentsPage />}
      {section === 'attendance' && <AttendanceSection />}
      {section === 'users' && <UsersPage />}
    </AppLayout>
  );
}
