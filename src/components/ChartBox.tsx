import React, { useEffect, useState } from 'react';

export default function ChartBox({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return <div className={className}>{ready ? children : null}</div>;
}
