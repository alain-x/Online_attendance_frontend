import React from 'react';
import { useAuth } from '../auth/AuthContext';

type SidebarItem = {
  key: string;
  label: string;
};

type ItemProps = {
  active: boolean;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
};

function Item({ active, label, onClick, icon }: ItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'w-full flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 transition-colors'
          : 'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors'
      }
    >
      {icon && <span className="text-lg">{icon}</span>}
      <span className="truncate">{label}</span>
    </button>
  );
}

type SidebarProps = {
  items: SidebarItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
  showBranding?: boolean;
};

export default function Sidebar({ items, activeKey, onChange, className, showBranding = true }: SidebarProps) {
  const { user } = useAuth();
  const logoLetter = (user?.companySlug || 'A').trim().charAt(0).toUpperCase();
  const logoUrl = user?.companyLogoUrl || null;

  function Icon({ children }: { children: React.ReactNode }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5 text-slate-500"
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  }

  const icons: Record<string, React.ReactNode> = {
    dashboard: (
      <Icon>
        <path d="M3 13h8V3H3v10z" />
        <path d="M13 21h8V11h-8v10z" />
        <path d="M13 3h8v6h-8V3z" />
        <path d="M3 21h8v-6H3v6z" />
      </Icon>
    ),
    reports: (
      <Icon>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 15l3-3 3 2 4-6" />
      </Icon>
    ),
    workforce: (
      <Icon>
        <path d="M16 11a4 4 0 10-8 0" />
        <path d="M4 21a8 8 0 0116 0" />
        <path d="M12 7v1" />
      </Icon>
    ),
    staff: (
      <Icon>
        <path d="M20 21a4 4 0 00-4-4H8a4 4 0 00-4 4" />
        <path d="M12 13a4 4 0 100-8 4 4 0 000 8z" />
      </Icon>
    ),
    settings: (
      <Icon>
        <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
        <path d="M19.4 15a7.8 7.8 0 000-6" />
        <path d="M4.6 9a7.8 7.8 0 000 6" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
      </Icon>
    ),
    history: (
      <Icon>
        <path d="M3 12a9 9 0 101-4" />
        <path d="M3 5v4h4" />
        <path d="M12 7v6l4 2" />
      </Icon>
    ),
    day: (
      <Icon>
        <path d="M8 3v2" />
        <path d="M16 3v2" />
        <path d="M4 7h16" />
        <path d="M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
      </Icon>
    ),
    overview: (
      <Icon>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 17V9" />
        <path d="M12 17V7" />
        <path d="M16 17v-4" />
      </Icon>
    ),
    approvals: (
      <Icon>
        <path d="M20 6L9 17l-5-5" />
      </Icon>
    ),
    payroll: (
      <Icon>
        <path d="M12 1v22" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7H14a3.5 3.5 0 010 7H6" />
      </Icon>
    ),
    record: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
      </Icon>
    ),
    companies: (
      <Icon>
        <path d="M3 21V7l9-4 9 4v14" />
        <path d="M9 21v-8h6v8" />
      </Icon>
    ),
    billing: (
      <Icon>
        <path d="M7 3h10v18H7z" />
        <path d="M9 7h6" />
        <path d="M9 11h6" />
        <path d="M9 15h6" />
      </Icon>
    ),
    team: (
      <Icon>
        <path d="M17 21a4 4 0 00-4-4H7a4 4 0 00-4 4" />
        <path d="M10 13a4 4 0 100-8 4 4 0 000 8z" />
        <path d="M20 21a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </Icon>
    ),
    timesheet: (
      <Icon>
        <path d="M6 3h12" />
        <path d="M6 7h12" />
        <path d="M6 11h12" />
        <path d="M6 15h12" />
        <path d="M6 19h12" />
      </Icon>
    ),
    holidays: (
      <Icon>
        <path d="M12 2l1.5 5h5L14 10l1.5 5L12 12l-3.5 3 1.5-5-4.5-3h5z" />
        <path d="M5 22h14" />
      </Icon>
    ),
    exports: (
      <Icon>
        <path d="M12 3v12" />
        <path d="M8 11l4 4 4-4" />
        <path d="M4 21h16" />
      </Icon>
    ),
    audit_log: (
      <Icon>
        <path d="M10 2h4" />
        <path d="M12 14v-4" />
        <path d="M12 14h3" />
        <path d="M6 6h12" />
        <path d="M6 10h6" />
        <path d="M6 14h4" />
        <path d="M6 18h12" />
      </Icon>
    ),
  };

  return (
    <div className={className || 'w-64 shrink-0 border-r bg-white shadow-sm'}>
      {showBranding ? (
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={user?.companySlug || 'Company logo'}
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                {logoLetter}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-slate-900">Attendance</div>
              <div className="text-xs text-slate-500">Management</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <Item
            key={it.key}
            label={it.label}
            active={it.key === activeKey}
            onClick={() => onChange(it.key)}
            icon={icons[it.key]}
          />
        ))}
      </div>
    </div>
  );
}
