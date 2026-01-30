import React from 'react';
import ShellHeader from './ShellHeader';
import Sidebar from './Sidebar';

type SidebarItem = {
  key: string;
  label: string;
};

type AppLayoutProps = {
  title?: string;
  sidebarItems: SidebarItem[];
  activeSidebarKey: string;
  onSidebarChange: (key: string) => void;
  children: React.ReactNode;
};

export default function AppLayout({ title, sidebarItems, activeSidebarKey, onSidebarChange, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <ShellHeader title={title} />
      <div className="flex">
        <Sidebar items={sidebarItems} activeKey={activeSidebarKey} onChange={onSidebarChange} />
        <div className="flex-1 min-w-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
