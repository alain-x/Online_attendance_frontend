import React from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';

type LoadingSpinnerProps = {
  size?: SpinnerSize;
  className?: string;
};

export default function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`inline-block ${className}`}>
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-slate-200 border-t-slate-600`}
      />
    </div>
  );
}
