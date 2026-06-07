import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

export default function SportsClubPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [section, setSection] = useState('dashboard');

  useEffect(() => {
    const state = location.state as { section?: string } | null;
    const next = state?.section;
    if (next && typeof next === 'string') {
      setSection(next);
    }
  }, [location.state]);

  const isSystemOrAdmin = user?.role === 'SYSTEM_ADMIN' || user?.role === 'ADMIN';
  const isClubAdmin = user?.role === 'CLUB_ADMIN';

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
      { key: 'chat', label: 'Chat' },
      { key: 'payments', label: 'Payments' },
      { key: 'attendance', label: 'Attendance' },
    ];
    if (isSystemOrAdmin || isClubAdmin) {
      items.push({ key: 'users', label: 'Users' });
      items.push({ key: 'reports', label: 'Reports' });
      items.push({ key: 'employee_nav', label: 'Employee Dashboard' });
      items.push({ key: 'recorder_nav', label: 'Recorder' });
      items.push({ key: 'hr_nav', label: 'HR' });
      items.push({ key: 'manager_nav', label: 'Manager' });
      items.push({ key: 'payroll_nav', label: 'Payroll' });
      items.push({ key: 'auditor_nav', label: 'Auditor' });
    }
    return items;
  }, [isSystemOrAdmin, isClubAdmin]);

  useEffect(() => {
    const allowed = sidebarItems.some((x) => x.key === section);
    if (!allowed) {
      setSection('dashboard');
    }
  }, [section, sidebarItems]);

  const sectionTitle = sidebarItems.find((x) => x.key === section)?.label || 'Sports Club';

  return (
    <AppLayout
      title="Sports Club"
      sidebarItems={sidebarItems}
      activeSidebarKey={section}
      onSidebarChange={(k) => {
        if (k === 'employee_nav') { navigate('/employee'); return; }
        if (k === 'recorder_nav') { navigate('/recorder'); return; }
        if (k === 'hr_nav') { navigate('/hr'); return; }
        if (k === 'manager_nav') { navigate('/manager'); return; }
        if (k === 'payroll_nav') { navigate('/payroll'); return; }
        if (k === 'auditor_nav') { navigate('/auditor'); return; }
        setSection(k);
      }}
    >
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">{sectionTitle}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {user?.companyName ? `${user.companyName} - ` : ''}Sports Club Management
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
      {section === 'chat' && <ChatPage />}
      {section === 'payments' && <PaymentsPage />}
      {section === 'attendance' && <AttendanceSection />}
      {section === 'users' && <UsersPage />}
      {section === 'reports' && (
        <div className="rounded-xl border bg-white p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Reports & Analytics</h2>
          <p className="text-sm text-slate-600">Advanced reporting features will be available here.</p>
        </div>
      )}
    </AppLayout>
  );
}
