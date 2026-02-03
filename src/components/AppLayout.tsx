import React, { useState } from 'react';
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <ShellHeader title={title} onMenuClick={() => setMobileSidebarOpen(true)} />

      <div className="flex">
        <div className="hidden md:block">
          <Sidebar items={sidebarItems} activeKey={activeSidebarKey} onChange={onSidebarChange} />
        </div>

        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-4 h-14">
                <div className="text-sm font-semibold text-slate-900">Menu</div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
              <Sidebar
                items={sidebarItems}
                activeKey={activeSidebarKey}
                onChange={(k) => {
                  onSidebarChange(k);
                  setMobileSidebarOpen(false);
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex-1 min-w-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
