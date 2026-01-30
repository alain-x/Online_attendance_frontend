import React from 'react';

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
};

export default function Sidebar({ items, activeKey, onChange }: SidebarProps) {
  const icons: Record<string, React.ReactNode> = {
    dashboard: '📊',
    reports: '📈',
    workforce: '👥',
    staff: '👤',
    settings: '⚙️',
    history: '📋',
    day: '📅',
  };

  return (
    <div className="w-64 shrink-0 border-r bg-white shadow-sm">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
            A
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Attendance</div>
            <div className="text-xs text-slate-500">Management</div>
          </div>
        </div>
      </div>
      <div className="px-3 py-4 space-y-1">
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
