import { useState, useEffect } from 'react';

const DEFAULT_NAME = 'SportClub Pro';

export function useBranding() {
  const [systemName, setSystemName] = useState(
    () => localStorage.getItem('systemName')?.trim() || DEFAULT_NAME
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'systemName') {
        setSystemName(e.newValue?.trim() || DEFAULT_NAME);
      }
    };
    window.addEventListener('storage', onStorage);

    const interval = setInterval(() => {
      const name = localStorage.getItem('systemName')?.trim() || DEFAULT_NAME;
      setSystemName((prev) => (prev !== name ? name : prev));
    }, 2000);

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  return { systemName };
}
