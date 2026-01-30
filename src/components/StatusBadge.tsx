import React from 'react';

type StatusBadgeProps = {
  status?: string;
  children?: React.ReactNode;
};

export default function StatusBadge({ status, children }: StatusBadgeProps) {
  const statusClasses = {
    present: 'bg-emerald-100 text-emerald-700',
    in: 'bg-emerald-100 text-emerald-700',
    out: 'bg-slate-200 text-slate-700',
    'not in': 'bg-rose-100 text-rose-700',
    absent: 'bg-rose-100 text-rose-700',
    verified: 'bg-emerald-100 text-emerald-700',
    'not verified': 'bg-amber-100 text-amber-700',
    default: 'bg-slate-100 text-slate-700',
  };

  const key = (status || '').toLowerCase();
  const className = (statusClasses as Record<string, string>)[key] || statusClasses.default;

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children || status}
    </span>
  );
}
